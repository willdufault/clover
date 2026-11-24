import os
import random
import time
import uuid
from collections.abc import Collection, Iterable

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from api import ApiError, Stale

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

RETRY_BASE_DELAY = 0.05
TRANSACTION_RETRIES = 3
RETRY_JITTER = 0.05


def build_key(user_id: str, kind: str, item_id: str) -> dict:
    return {"PK": user_id, "SK": f"{kind}#{item_id}"}


def key_of(item: dict) -> dict:
    return {"PK": item["PK"], "SK": item["SK"]}


def kind_of(item: dict) -> str:
    return item["SK"].split("#", 1)[0]


def id_of(item: dict) -> str:
    return item["SK"].split("#", 1)[1]


def to_api(item: dict) -> dict:
    data = {k: v for k, v in item.items() if k not in ("PK", "SK")}
    return {"id": id_of(item), **data}


def load_all(user_id: str) -> list:
    return table.query(KeyConditionExpression=Key("PK").eq(user_id), ConsistentRead=True)["Items"]


def by_id(items: list, kind: str, ids: list) -> dict:
    found = {id_of(i): i for i in items if kind_of(i) == kind}
    if any(i not in found for i in ids):
        raise ApiError(404, f"{kind.capitalize()} not found")
    return {i: found[i] for i in ids}


def matching(items: list, kind: str, ids: Collection) -> list:
    return [i for i in items if kind_of(i) == kind and id_of(i) in ids]


def children(items: list, kind: str, field: str, parent_ids: Collection) -> list:
    return [i for i in items if kind_of(i) == kind and i[field] in parent_ids]


def orphan_steps(items: list) -> list:
    tasks = {id_of(i) for i in items if kind_of(i) == "TASK"}
    return [i for i in items if kind_of(i) == "STEP" and i["taskId"] not in tasks]


def bump(user_id: str, items: list) -> dict:
    seen = next((i["version"] for i in items if i["SK"] == "META"), 0)
    return {
        "Update": {
            "TableName": table.name,
            "Key": {"PK": user_id, "SK": "META"},
            "UpdateExpression": "SET version = if_not_exists(version, :zero) + :one",
            "ConditionExpression": "attribute_not_exists(PK) OR version = :seen",
            "ExpressionAttributeValues": {":zero": 0, ":one": 1, ":seen": seen},
        }
    }


# Overlapping writes to the same item (e.g. two quick edits to one task) cancel
# the transaction with TransactionConflict, and AWS SDKs don't retry it. Retry
# with exponential backoff, plus jitter so colliding requests don't retry in sync.
def transact(writes: list) -> None:
    delay = RETRY_BASE_DELAY
    for attempt in range(TRANSACTION_RETRIES + 1):
        try:
            table.meta.client.transact_write_items(TransactItems=writes)
            return
        except ClientError as e:
            reasons = [r.get("Code") for r in e.response.get("CancellationReasons", [])]
            for write, reason in zip(writes, reasons, strict=False):
                if reason == "ConditionalCheckFailed":
                    sk = write["Update"]["Key"]["SK"]
                    if sk == "META":
                        raise Stale() from e
                    raise ApiError(404, f"{sk.split('#')[0].capitalize()} not found") from e
            if "TransactionConflict" not in reasons:
                raise
            if attempt == TRANSACTION_RETRIES:
                raise ApiError(409, "Concurrent update") from e
            time.sleep(delay + random.uniform(0, RETRY_JITTER))
            delay *= 2


def create(user_id: str, kind: str, data: dict, items: list) -> dict:
    item = {**build_key(user_id, kind, str(uuid.uuid7())), **data}
    transact([{"Put": {"TableName": table.name, "Item": item}}, bump(user_id, items)])
    return to_api(item)


def update_many(user_id: str, kind: str, patches: list, items: list, checks: Iterable = ()) -> list:
    found = by_id(items, kind, [i for i, _ in patches])
    writes = list(checks) + [
        {
            "Update": {
                "TableName": table.name,
                "Key": build_key(user_id, kind, item_id),
                "UpdateExpression": "SET " + ", ".join(f"#{k} = :{k}" for k in data),
                "ExpressionAttributeNames": {f"#{k}": k for k in data},
                "ExpressionAttributeValues": {f":{k}": v for k, v in data.items()},
                "ConditionExpression": "attribute_exists(PK)",
            }
        }
        for item_id, data in patches
        if data
    ]
    if writes:
        transact(writes)
    return [to_api({**found[i], **data}) for i, data in patches]


def delete(*groups: list) -> None:
    for items in groups:
        with table.batch_writer(overwrite_by_pkeys=["PK", "SK"]) as batch:
            for item in items:
                batch.delete_item(Key=key_of(item))


# Parents go first with the META bump, so the children read is current when they
# commit and no new child can be added after. A crash before the children are
# deleted orphans them; DELETE /steps sweeps orphan steps.
def delete_parents(user_id: str, items: list, parents: list, *children: list) -> None:
    deletes = [{"Delete": {"TableName": table.name, "Key": key_of(p)}} for p in parents]
    transact([bump(user_id, items), *deletes])
    delete(*children)
