from collections.abc import Callable

import pytest
from mypy_boto3_dynamodb.service_resource import Table

from schema import STEPS_PER_TASK, TITLE_MAX, USER_LIMITS


@pytest.fixture
def task(call: Callable) -> dict:
    return call("POST /tasks", {"title": "T"})[1]


def test_create(call: Callable, task: dict) -> None:
    status, step = call("POST /steps", {"title": "S", "taskId": task["id"]})
    assert status == 201
    assert step == {"id": step["id"], "taskId": task["id"], "title": "S", "stage": "open", "order": 0}


def test_create_validation(call: Callable, task: dict) -> None:
    assert call("POST /steps", {"title": "S"})[0] == 400
    assert call("POST /steps", {"taskId": task["id"]})[0] == 400
    assert call("POST /steps", {"title": "x" * (TITLE_MAX + 1), "taskId": task["id"]})[0] == 400
    assert call("POST /steps", {"title": "S", "taskId": 5})[0] == 400
    assert call("POST /steps", {"title": "S", "taskId": "missing"})[0] == 404
    assert call("POST /steps", {"title": "x" * TITLE_MAX, "taskId": task["id"]})[0] == 201


def test_task_limit(call: Callable, task: dict) -> None:
    for i in range(STEPS_PER_TASK):
        assert call("POST /steps", {"title": f"S{i}", "taskId": task["id"]})[0] == 201
    assert call("POST /steps", {"title": "x", "taskId": task["id"]})[0] == 409


def test_user_limit(call: Callable) -> None:
    for t in range(USER_LIMITS["STEP"] // STEPS_PER_TASK):
        status, task = call("POST /tasks", {"title": f"T{t}"})
        assert status == 201
        for s in range(STEPS_PER_TASK):
            assert call("POST /steps", {"title": f"S{s}", "taskId": task["id"]})[0] == 201
    task = call("POST /tasks", {"title": "last"})[1]
    assert call("POST /steps", {"title": "x", "taskId": task["id"]})[0] == 409


def test_update(call: Callable, task: dict) -> None:
    step = call("POST /steps", {"title": "S", "taskId": task["id"]})[1]
    other = call("POST /steps", {"title": "O", "taskId": task["id"]})[1]
    body = [{"id": step["id"], "stage": "done"}, {"id": other["id"], "title": "O2"}]
    assert call("PATCH /steps", body) == (
        200,
        [{**step, "stage": "done"}, {**other, "title": "O2"}],
    )
    assert call("PATCH /steps", [{"id": step["id"], "taskId": "x"}])[0] == 400
    assert call("PATCH /steps", [{"id": step["id"], "stage": "nope"}])[0] == 400
    assert call("PATCH /steps", [{"id": "missing", "title": "S"}])[0] == 404
    assert call("PATCH /steps", [{"id": step["id"], "title": "x" * (TITLE_MAX + 1)}])[0] == 400


def test_delete(call: Callable, task: dict) -> None:
    a = call("POST /steps", {"title": "A", "taskId": task["id"]})[1]
    b = call("POST /steps", {"title": "B", "taskId": task["id"]})[1]
    c = call("POST /steps", {"title": "C", "taskId": task["id"]})[1]
    assert call("DELETE /steps", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1]["steps"] == [c]
    assert call("DELETE /steps", {"ids": [a["id"]]})[0] == 204


def test_create_on_task_deleted_after_read_is_404(call: Callable, task: dict, race: Callable) -> None:
    race(lambda: call("DELETE /tasks", {"ids": [task["id"]]}))
    assert call("POST /steps", {"title": "S", "taskId": task["id"]}) == (
        404,
        {"error": "Task not found"},
    )
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_create_over_task_limit_after_stale_read_is_409(call: Callable, task: dict, race: Callable) -> None:
    for i in range(STEPS_PER_TASK - 1):
        call("POST /steps", {"title": f"S{i}", "taskId": task["id"]})
    race(lambda: call("POST /steps", {"title": "concurrent", "taskId": task["id"]}))
    assert call("POST /steps", {"title": "too many", "taskId": task["id"]}) == (409, {"error": "Task is full"})
    assert len(call("GET /data")[1]["steps"]) == STEPS_PER_TASK


def test_delete_removes_orphan_steps(call: Callable, task: dict, mock_table: Table) -> None:
    step = call("POST /steps", {"title": "S", "taskId": task["id"]})[1]
    mock_table.put_item(Item={"PK": "user-1", "SK": "STEP#orphan", "taskId": "gone", "title": "O", "stage": "open"})
    assert call("DELETE /steps", {"ids": [step["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [task], "steps": []}


def test_order(call: Callable, task: dict) -> None:
    assert call("POST /steps", {"title": "S", "taskId": task["id"]})[1]["order"] == 0
    a = call("POST /steps", {"title": "A", "taskId": task["id"], "order": 5})[1]
    b = call("POST /steps", {"title": "B", "taskId": task["id"], "order": -3})[1]
    assert (a["order"], b["order"]) == (5, -3)
    body = [{"id": a["id"], "order": 1}, {"id": b["id"], "order": 2}]
    assert call("PATCH /steps", body) == (200, [{**a, "order": 1}, {**b, "order": 2}])
    assert [s["order"] for s in call("GET /data")[1]["steps"]] == [0, 1, 2]


@pytest.mark.parametrize("order", [True, 1.5, "1", 2**40])
def test_order_validation(call: Callable, task: dict, order: object) -> None:
    step = call("POST /steps", {"title": "S", "taskId": task["id"]})[1]
    assert call("POST /steps", {"title": "S", "taskId": task["id"], "order": order})[0] == 400
    assert call("PATCH /steps", [{"id": step["id"], "order": order}])[0] == 400
