import json
import os
from datetime import date

from shared.api import ApiError, parse_body, parse_json

# Shared with the frontend.
with open(os.path.join(os.path.dirname(__file__), "..", "limits.json")) as f:
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
# DynamoDB transactions cap at 100 actions and the META bump takes one slot.
MAX_BATCH = LIMITS["batchMax"]


def check_ids(ids):
    if not (
        isinstance(ids, list)
        and 1 <= len(ids) <= MAX_BATCH
        and all(isinstance(i, str) for i in ids)
        and len(set(ids)) == len(ids)
    ):
        raise ApiError(400, f"IDs must be 1-{MAX_BATCH} unique strings")


def parse_ids(event):
    ids = parse_body(event).get("ids")
    check_ids(ids)
    return ids


def parse_patches(event, fields):
    body = parse_json(event)
    if not isinstance(body, list) or not all(isinstance(p, dict) for p in body):
        raise ApiError(400, "Body must be an array of objects")
    check_ids([p.get("id") for p in body])
    return [(p["id"], validate(fields, {k: v for k, v in p.items() if k != "id"}, partial=True)) for p in body]


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
    except TypeError, ValueError:
        return False


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
            raise ApiError(400, f"Unknown field: {name}")
    data = {}
    for name, (check, default) in fields.items():
        if name in body:
            if not check(body[name]):
                raise ApiError(400, f"Invalid {name}")
            data[name] = body[name]
        elif not partial:
            if default is REQUIRED:
                raise ApiError(400, f"Missing {name}")
            data[name] = default
    return data
