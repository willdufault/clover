import base64
import json
import os
import uuid
from datetime import date

import boto3
from boto3.dynamodb.conditions import Key

table = boto3.resource("dynamodb", region_name=os.environ["TABLE_REGION"]).Table(
    os.environ["TABLE_NAME"]
)

USER_LIMITS = {"LIST": 10, "TASK": 100, "STEP": 100}
TASKS_PER_LIST = 20
STEPS_PER_TASK = 10


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


def parse_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw)
    try:
        body = json.loads(raw)
    except ValueError:
        raise ApiError(400, "invalid JSON")
    if not isinstance(body, dict):
        raise ApiError(400, "body must be an object")
    return body


def path_id(event):
    return event["pathParameters"]["id"]


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
        date.fromisoformat(v)
        return True
    except (TypeError, ValueError):
        return False


# field -> (check, default)
LIST_FIELDS = {"name": (text(50), REQUIRED)}
TASK_FIELDS = {
    "title": (text(100), REQUIRED),
    "stage": (one_of("open", "inProgress", "waiting", "done", "cancelled"), "open"),
    "due": (optional_date, None),
    "priority": (one_of("low", "medium", "high"), "medium"),
    "addedToToday": (is_bool, False),
    "listId": (optional_str, None),
}
STEP_FIELDS = {
    "taskId": (is_str, REQUIRED),
    "title": (text(100), REQUIRED),
    "completed": (is_bool, False),
}
STEP_EDITABLE = {k: v for k, v in STEP_FIELDS.items() if k != "taskId"}


def validate(fields, body, partial=False):
    for name in body:
        if name not in fields:
            raise ApiError(400, f"unknown field: {name}")
    data = {}
    for name, (check, default) in fields.items():
        if name in body:
            if not check(body[name]):
                raise ApiError(400, f"invalid {name}")
            data[name] = body[name]
        elif not partial:
            if default is REQUIRED:
                raise ApiError(400, f"missing {name}")
            data[name] = default
    return data


# Storage


def key(user_id, kind, item_id):
    return {"PK": user_id, "SK": f"{kind}#{item_id}"}


def kind_of(item):
    return item["SK"].split("#", 1)[0]


def to_api(item):
    data = {k: v for k, v in item.items() if k not in ("PK", "SK")}
    return {"id": item["SK"].split("#", 1)[1], **data}


def load_all(user_id):
    return table.query(KeyConditionExpression=Key("PK").eq(user_id))["Items"]


def get(user_id, kind, item_id):
    item = table.get_item(Key=key(user_id, kind, item_id)).get("Item")
    if item is None:
        raise ApiError(404, "not found")
    return item


def create(user_id, kind, data):
    item = {**key(user_id, kind, str(uuid.uuid7())), **data}
    table.put_item(Item=item)
    return response(201, to_api(item))


def update(item, data):
    item.update(data)
    table.put_item(Item=item)
    return response(200, to_api(item))


def delete(items):
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
    return response(204)


# Limits


def check_user_limit(items, kind):
    if sum(kind_of(i) == kind for i in items) >= USER_LIMITS[kind]:
        raise ApiError(409, f"{kind.lower()} limit reached")


def check_parent(items, parent_kind, parent_id, child_field, limit):
    sk = f"{parent_kind}#{parent_id}"
    if not any(i["SK"] == sk for i in items):
        raise ApiError(404, f"{child_field} not found")
    if sum(i.get(child_field) == parent_id for i in items) >= limit:
        raise ApiError(409, f"{parent_kind.lower()} is full")
