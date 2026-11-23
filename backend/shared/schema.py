import json
import os
from collections.abc import Callable
from datetime import date

from shared.api import ApiError, parse_body, parse_json

# Shared with the frontend.
with open(os.path.join(os.path.dirname(__file__), "..", "limits.json")) as f:
    LIMITS = json.load(f)
with open(os.path.join(os.path.dirname(__file__), "..", "enums.json")) as f:
    ENUMS = json.load(f)
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


def check_ids(ids: object) -> list:
    if not (
        isinstance(ids, list)
        and 1 <= len(ids) <= MAX_BATCH
        and all(isinstance(i, str) for i in ids)
        and len(set(ids)) == len(ids)
    ):
        raise ApiError(400, f"IDs must be 1-{MAX_BATCH} unique strings")
    return ids


def parse_ids(event: dict) -> list:
    return check_ids(parse_body(event).get("ids"))


def parse_patches(event: dict, fields: dict) -> list:
    body = parse_json(event)
    if not isinstance(body, list) or not all(isinstance(p, dict) for p in body):
        raise ApiError(400, "Body must be an array of objects")
    check_ids([p.get("id") for p in body])
    return [(p["id"], validate(fields, {k: v for k, v in p.items() if k != "id"}, partial=True)) for p in body]


REQUIRED = object()


def text(max_len: int) -> Callable:
    return lambda v: isinstance(v, str) and v.strip() != "" and len(v) <= max_len


def one_of(*options: str) -> Callable:
    return lambda v: isinstance(v, str) and v in options


def is_bool(v: object) -> bool:
    return isinstance(v, bool)


def is_str(v: object) -> bool:
    return isinstance(v, str)


def optional_str(v: object) -> bool:
    return v is None or isinstance(v, str)


def optional_date(v: object) -> bool:
    if not isinstance(v, str):
        return v is None
    try:
        # Only YYYY-MM-DD; fromisoformat also accepts forms like 20240101.
        return date.fromisoformat(v).isoformat() == v
    except ValueError:
        return False


LIST_FIELDS = {"name": (text(LIST_NAME_MAX), REQUIRED)}
TASK_FIELDS = {
    "title": (text(TITLE_MAX), REQUIRED),
    "stage": (one_of(*ENUMS["stages"]), "open"),
    "due": (optional_date, None),
    "priority": (one_of(*ENUMS["priorities"]), "medium"),
    "addedToToday": (is_bool, False),
    "listId": (optional_str, None),
}
STEP_FIELDS = {
    "taskId": (is_str, REQUIRED),
    "title": (text(TITLE_MAX), REQUIRED),
    "completed": (is_bool, False),
}
STEP_EDITABLE = {k: v for k, v in STEP_FIELDS.items() if k != "taskId"}


def validate(fields: dict, body: dict, partial: bool = False) -> dict:
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
