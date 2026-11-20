import base64
import json
import os
import random
import time
import uuid
from datetime import date

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

# Shared with the frontend.
with open(os.path.join(os.path.dirname(__file__), "limits.json")) as f:
    LIMITS = json.load(f)
USER_LIMITS = {
    "LIST": LIMITS["listsPerUser"],
    "TASK": LIMITS["tasksPerUser"],
    "STEP": LIMITS["stepsPerUser"],
}
TASKS_PER_LIST = LIMITS["tasksPerList"]
STEPS_PER_TASK = LIMITS["stepsPerTask"]
LIST_NAME_MAX = LIMITS["listNameMax"]
TITLE_MAX = LIMITS["titleMax"]


class Stale(Exception):
    pass


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def response(status, body=None):
    if body is None:
        return {"statusCode": status}
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def parse_json(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw)
    try:
        return json.loads(raw)
    except ValueError:
        raise ApiError(400, "Invalid JSON.")


def parse_body(event):
    body = parse_json(event)
    if not isinstance(body, dict):
        raise ApiError(400, "Body must be an object.")
    return body


# DynamoDB transactions cap at 100 actions and the META bump takes one slot.
MAX_BATCH = LIMITS["batchMax"]
RETRY_BASE_DELAY = 0.05
RETRY_JITTER = 0.05


def check_ids(ids):
    if not (
        isinstance(ids, list)
        and 1 <= len(ids) <= MAX_BATCH
        and all(isinstance(i, str) for i in ids)
        and len(set(ids)) == len(ids)
    ):
        raise ApiError(400, f"IDs must be 1-{MAX_BATCH} unique strings.")


def parse_ids(event):
    ids = parse_body(event).get("ids")
    check_ids(ids)
    return ids


def parse_patches(event, fields):
    body = parse_json(event)
    if not isinstance(body, list) or not all(isinstance(p, dict) for p in body):
        raise ApiError(400, "Body must be an array of objects.")
    check_ids([p.get("id") for p in body])
    return [
        (p["id"], validate(fields, {k: v for k, v in p.items() if k != "id"}, partial=True))
        for p in body
    ]


# Validation

REQUIRED = object()


def text(max_len):
    return lambda v: isinstance(v, str) and v.strip() != "" and len(v) <= max_len


def one_of(*options):
    return lambda v: isinstance(v, str) and v in options


def is_bool(v):
    return isinstance(v, bool)


def is_str(v):
    return isinstance(v, str)


def optional_str(v):
    return v is None or isinstance(v, str)


def optional_date(v):
    if v is None:
        return True
    try:
        # Only YYYY-MM-DD; fromisoformat also accepts forms like 20240101.
        return date.fromisoformat(v).isoformat() == v
    except (TypeError, ValueError):
        return False


# field -> (check, default)
LIST_FIELDS = {"name": (text(LIST_NAME_MAX), REQUIRED)}
TASK_FIELDS = {
    "title": (text(TITLE_MAX), REQUIRED),
    "stage": (one_of("open", "inProgress", "waiting", "done", "cancelled"), "open"),
    "due": (optional_date, None),
    "priority": (one_of("low", "medium", "high"), "medium"),
    "addedToToday": (is_bool, False),
    "listId": (optional_str, None),
}
STEP_FIELDS = {
    "taskId": (is_str, REQUIRED),
    "title": (text(TITLE_MAX), REQUIRED),
    "completed": (is_bool, False),
}
STEP_EDITABLE = {k: v for k, v in STEP_FIELDS.items() if k != "taskId"}


def validate(fields, body, partial=False):
    for name in body:
        if name not in fields:
            raise ApiError(400, f"Unknown field: {name}.")
    data = {}
    for name, (check, default) in fields.items():
        if name in body:
            if not check(body[name]):
                raise ApiError(400, f"Invalid {name}.")
            data[name] = body[name]
        elif not partial:
            if default is REQUIRED:
                raise ApiError(400, f"Missing {name}.")
            data[name] = default
    return data


# Storage


def key(user_id, kind, item_id):
    return {"PK": user_id, "SK": f"{kind}#{item_id}"}


def kind_of(item):
    return item["SK"].split("#", 1)[0]


def id_of(item):
    return item["SK"].split("#", 1)[1]


def to_api(item):
    data = {k: v for k, v in item.items() if k not in ("PK", "SK")}
    return {"id": id_of(item), **data}


def load_all(user_id):
    return table.query(KeyConditionExpression=Key("PK").eq(user_id), ConsistentRead=True)["Items"]


def by_id(items, kind, ids):
    found = {id_of(i): i for i in items if kind_of(i) == kind}
    if any(i not in found for i in ids):
        raise ApiError(404, "Not found.")
    return {i: found[i] for i in ids}


def matching(items, kind, ids):
    return [i for i in items if kind_of(i) == kind and id_of(i) in ids]


def bump(user_id, items):
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


def create(user_id, kind, data, items):
    item = {**key(user_id, kind, str(uuid.uuid7())), **data}
    transact([{"Put": {"TableName": table.name, "Item": item}}, bump(user_id, items)])
    return response(201, to_api(item))


# Overlapping writes to the same item (e.g. two quick edits to one task) cancel
# the transaction with TransactionConflict, and AWS SDKs don't retry it. Retry
# with exponential backoff, plus jitter so colliding requests don't retry in sync.
def transact(writes, retries=3):
    delay = RETRY_BASE_DELAY
    for attempt in range(retries + 1):
        try:
            return table.meta.client.transact_write_items(TransactItems=writes)
        except ClientError as e:
            reasons = [r.get("Code") for r in e.response.get("CancellationReasons", [])]
            for write, reason in zip(writes, reasons):
                if reason == "ConditionalCheckFailed":
                    if write["Update"]["Key"]["SK"] == "META":
                        raise Stale()
                    raise ApiError(404, "Not found.")
            if "TransactionConflict" not in reasons or attempt == retries:
                raise
            time.sleep(delay + random.uniform(0, RETRY_JITTER))
            delay *= 2


def update_many(user_id, kind, patches, items, checks=()):
    by_id(items, kind, [i for i, _ in patches])
    writes = list(checks) + [
        {
            "Update": {
                "TableName": table.name,
                "Key": key(user_id, kind, item_id),
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
    updated = by_id(load_all(user_id), kind, [i for i, _ in patches])
    return response(200, [to_api(updated[i]) for i, _ in patches])


# Groups go children first (steps, tasks, lists), each flushed before the next,
# so a failure partway never orphans children; retrying the DELETE finishes it.
def delete(*groups):
    for items in groups:
        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
    return response(204)


def delete_parents(user_id, items, parents, *children):
    delete(*children)
    deletes = [{"Delete": {"TableName": table.name, "Key": {"PK": p["PK"], "SK": p["SK"]}}} for p in parents]
    transact([bump(user_id, items)] + deletes)
    return response(204)


# Limits


def check_user_limit(items, kind):
    if sum(kind_of(i) == kind for i in items) >= USER_LIMITS[kind]:
        raise ApiError(409, f"{kind.capitalize()} limit reached.")


def check_parent(items, parent_kind, parent_id, child_field, limit):
    sk = f"{parent_kind}#{parent_id}"
    if not any(i["SK"] == sk for i in items):
        raise ApiError(404, f"{parent_kind.capitalize()} not found.")
    if sum(i.get(child_field) == parent_id for i in items) >= limit:
        raise ApiError(409, f"{parent_kind.capitalize()} is full.")
