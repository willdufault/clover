from collections.abc import Callable

import pytest
from mypy_boto3_dynamodb.service_resource import Table

from schema import MAX_BATCH, TASKS_PER_LIST, TITLE_MAX, USER_LIMITS


def test_create_defaults(call: Callable) -> None:
    status, task = call("POST /tasks", {"title": "T", "order": 0})
    assert status == 201
    assert task == {
        "id": task["id"],
        "title": "T",
        "stage": "open",
        "due": None,
        "priority": "medium",
        "addedToToday": False,
        "listId": None,
        "order": 0,
    }


def test_create_all_fields(call: Callable) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    body = {
        "title": "T",
        "stage": "waiting",
        "due": "2026-12-01",
        "priority": "high",
        "addedToToday": True,
        "listId": lst["id"],
        "order": 4,
    }
    status, task = call("POST /tasks", body)
    assert status == 201
    assert task == {"id": task["id"], **body}


def test_create_validation(call: Callable) -> None:
    assert call("POST /tasks", {"order": 0})[0] == 400
    assert call("POST /tasks", {"title": "x" * (TITLE_MAX + 1), "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "stage": "nope", "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "priority": "urgent", "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "due": "tomorrow", "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "due": "2024-W01-1", "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "addedToToday": "yes", "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "listId": 5, "order": 0})[0] == 400
    assert call("POST /tasks", {"title": "T", "listId": "missing", "order": 0})[0] == 404
    assert call("POST /tasks", {"title": "x" * TITLE_MAX, "order": 0})[0] == 201


def test_list_limit(call: Callable) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    for i in range(TASKS_PER_LIST):
        assert call("POST /tasks", {"title": f"T{i}", "listId": lst["id"], "order": 0})[0] == 201
    assert call("POST /tasks", {"title": "x", "listId": lst["id"], "order": 0})[0] == 409
    assert call("POST /tasks", {"title": "unassigned", "order": 0})[0] == 201


def test_user_limit(call: Callable) -> None:
    for i in range(USER_LIMITS["TASK"]):
        assert call("POST /tasks", {"title": f"T{i}", "order": 0})[0] == 201
    assert call("POST /tasks", {"title": "x", "order": 0})[0] == 409


def test_update(call: Callable) -> None:
    task = call("POST /tasks", {"title": "T", "order": 0})[1]
    other = call("POST /tasks", {"title": "O", "order": 0})[1]
    body = [
        {"id": task["id"], "stage": "done", "due": "2026-01-02"},
        {"id": other["id"], "priority": "high"},
    ]
    status, updated = call("PATCH /tasks", body)
    assert status == 200
    assert updated == [
        {**task, "stage": "done", "due": "2026-01-02"},
        {**other, "priority": "high"},
    ]
    assert call("PATCH /tasks", [{"id": task["id"], "stage": "x"}])[0] == 400
    assert call("PATCH /tasks", [{"id": "missing", "title": "T"}])[0] == 404
    assert call("PATCH /tasks", [{"id": task["id"], "title": "x" * (TITLE_MAX + 1)}])[0] == 400


def test_update_move_checks_list(call: Callable) -> None:
    full = call("POST /lists", {"name": "Full", "order": 0})[1]
    for i in range(TASKS_PER_LIST):
        call("POST /tasks", {"title": f"T{i}", "listId": full["id"], "order": 0})
    task = call("POST /tasks", {"title": "T", "order": 0})[1]
    assert call("PATCH /tasks", [{"id": task["id"], "listId": "missing"}]) == (
        404,
        {"error": "List not found"},
    )
    assert call("PATCH /tasks", [{"id": task["id"], "listId": full["id"]}]) == (
        409,
        {"error": "List is full"},
    )
    other = call("POST /lists", {"name": "Other", "order": 0})[1]
    status, moved = call("PATCH /tasks", [{"id": task["id"], "listId": other["id"]}])
    assert (status, moved[0]["listId"]) == (200, other["id"])
    status, moved = call("PATCH /tasks", [{"id": task["id"], "listId": None}])
    assert (status, moved[0]["listId"]) == (200, None)


def test_update_batch_move_overflow(call: Callable) -> None:
    target = call("POST /lists", {"name": "Target", "order": 0})[1]
    for i in range(TASKS_PER_LIST - 1):
        call("POST /tasks", {"title": f"T{i}", "listId": target["id"], "order": 0})
    a = call("POST /tasks", {"title": "A", "order": 0})[1]
    b = call("POST /tasks", {"title": "B", "order": 0})[1]
    body = [{"id": a["id"], "listId": target["id"]}, {"id": b["id"], "listId": target["id"]}]
    assert call("PATCH /tasks", body)[0] == 409
    tasks = {t["id"]: t for t in call("GET /data")[1]["tasks"]}
    assert tasks[a["id"]] == a
    assert tasks[b["id"]] == b
    inside = next(t for t in tasks.values() if t["listId"] == target["id"])
    status, _ = call("PATCH /tasks", [{"id": inside["id"], "listId": None}, *body])
    assert status == 200


def test_update_within_full_list_is_allowed(call: Callable, mock_table: Table) -> None:
    full = call("POST /lists", {"name": "Full", "order": 0})[1]
    tasks = [
        call("POST /tasks", {"title": f"T{i}", "listId": full["id"], "order": 0})[1] for i in range(TASKS_PER_LIST)
    ]
    version = mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"]
    body = [{"id": tasks[0]["id"], "listId": full["id"], "stage": "done"}]
    assert call("PATCH /tasks", body)[0] == 200
    assert mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"] == version


def test_delete_cascades(call: Callable) -> None:
    a = call("POST /tasks", {"title": "A", "order": 0})[1]
    b = call("POST /tasks", {"title": "B", "order": 0})[1]
    call("POST /steps", {"title": "S", "taskId": a["id"], "order": 0})
    call("POST /steps", {"title": "S", "taskId": b["id"], "order": 0})
    other = call("POST /tasks", {"title": "Other", "order": 0})[1]
    step = call("POST /steps", {"title": "S2", "taskId": other["id"], "order": 0})[1]
    assert call("DELETE /tasks", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [other], "steps": [step]}
    assert call("DELETE /tasks", {"ids": [a["id"]]})[0] == 204


def test_delete_skips_missing_ids(call: Callable) -> None:
    a = call("POST /tasks", {"title": "A", "order": 0})[1]
    call("POST /steps", {"title": "S", "taskId": a["id"], "order": 0})
    assert call("DELETE /tasks", {"ids": [a["id"], "missing"]})[0] == 204
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_update_returns_written_values_not_later_writes(
    call: Callable, mock_table: Table, monkeypatch: pytest.MonkeyPatch
) -> None:
    task = call("POST /tasks", {"title": "T", "order": 0})[1]
    real = mock_table.meta.client.transact_write_items

    def concurrent(TransactItems: list) -> object:
        mock_table.update_item(
            Key={"PK": "user-1", "SK": f"TASK#{task['id']}"},
            UpdateExpression="SET stage = :s",
            ExpressionAttributeValues={":s": "waiting"},
        )
        return real(TransactItems=TransactItems)

    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", concurrent)
    status, updated = call("PATCH /tasks", [{"id": task["id"], "due": "2030-01-02"}])
    assert (status, updated) == (200, [{**task, "due": "2030-01-02"}])
    assert call("GET /data")[1]["tasks"][0]["stage"] == "waiting"


def test_update_task_deleted_after_read_is_404(call: Callable, mock_table: Table, race: Callable) -> None:
    a = call("POST /tasks", {"title": "A", "order": 0})[1]
    b = call("POST /tasks", {"title": "B", "order": 0})[1]
    race(lambda: call("DELETE /tasks", {"ids": [b["id"]]}))
    before = mock_table.scan()["Items"]
    body = [{"id": a["id"], "title": "A2"}, {"id": b["id"], "title": "B2"}]
    assert call("PATCH /tasks", body) == (404, {"error": "Task not found"})
    assert mock_table.scan()["Items"] == before


def test_move_out_during_list_delete_keeps_task(call: Callable, race: Callable) -> None:
    lst = call("POST /lists", {"name": "L", "order": 0})[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"], "order": 0})[1]
    race(lambda: call("PATCH /tasks", [{"id": task["id"], "listId": None}]))
    assert call("DELETE /lists", {"ids": [lst["id"]]}) == (204, None)
    assert call("GET /data")[1]["tasks"] == [{**task, "listId": None}]


def test_create_in_list_deleted_after_read_is_404(call: Callable, race: Callable) -> None:
    lst = call("POST /lists", {"name": "L", "order": 0})[1]
    race(lambda: call("DELETE /lists", {"ids": [lst["id"]]}))
    assert call("POST /tasks", {"title": "T", "listId": lst["id"], "order": 0}) == (
        404,
        {"error": "List not found"},
    )
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_move_to_list_deleted_after_read_is_404(call: Callable, race: Callable) -> None:
    lst = call("POST /lists", {"name": "L", "order": 0})[1]
    task = call("POST /tasks", {"title": "T", "order": 0})[1]
    race(lambda: call("DELETE /lists", {"ids": [lst["id"]]}))
    assert call("PATCH /tasks", [{"id": task["id"], "listId": lst["id"]}]) == (
        404,
        {"error": "List not found"},
    )
    assert call("GET /data")[1] == {"lists": [], "tasks": [task], "steps": []}


def test_move_into_list_filled_after_read_is_409(call: Callable, race: Callable) -> None:
    lst = call("POST /lists", {"name": "L", "order": 0})[1]
    for i in range(TASKS_PER_LIST - 1):
        call("POST /tasks", {"title": f"T{i}", "listId": lst["id"], "order": 0})
    task = call("POST /tasks", {"title": "T", "order": 0})[1]
    race(lambda: call("POST /tasks", {"title": "concurrent", "listId": lst["id"], "order": 0}))
    assert call("PATCH /tasks", [{"id": task["id"], "listId": lst["id"]}]) == (409, {"error": "List is full"})
    tasks = call("GET /data")[1]["tasks"]
    assert next(t for t in tasks if t["id"] == task["id"])["listId"] is None
    assert len([t for t in tasks if t["listId"] == lst["id"]]) == TASKS_PER_LIST


def test_create_over_list_limit_after_stale_read_is_409(call: Callable, race: Callable) -> None:
    lst = call("POST /lists", {"name": "L", "order": 0})[1]
    for i in range(TASKS_PER_LIST - 1):
        call("POST /tasks", {"title": f"T{i}", "listId": lst["id"], "order": 0})
    race(lambda: call("POST /tasks", {"title": "concurrent", "listId": lst["id"], "order": 0}))
    assert call("POST /tasks", {"title": "too many", "listId": lst["id"], "order": 0})[0] == 409
    tasks = call("GET /data")[1]["tasks"]
    assert len([t for t in tasks if t["listId"] == lst["id"]]) == TASKS_PER_LIST


def test_delete_with_step_added_after_read_removes_step(call: Callable, mock_table: Table, race: Callable) -> None:
    task = call("POST /tasks", {"title": "T", "order": 0})[1]
    race(lambda: call("POST /steps", {"title": "S", "taskId": task["id"], "order": 0}))
    assert call("DELETE /tasks", {"ids": [task["id"]]}) == (204, None)
    assert [
        i["SK"]
        for i in mock_table.scan()["Items"]
        if isinstance(i["SK"], str) and i["SK"].startswith(("TASK#", "STEP#"))
    ] == []


def test_update_clears_due(call: Callable, mock_table: Table) -> None:
    task = call("POST /tasks", {"title": "T", "due": "2026-12-01", "order": 0})[1]
    assert call("PATCH /tasks", [{"id": task["id"], "due": None}]) == (200, [{**task, "due": None}])
    assert mock_table.get_item(Key={"PK": "user-1", "SK": f"TASK#{task['id']}"})["Item"]["due"] is None


def test_max_batch_fits_transaction(call: Callable) -> None:
    lists = [call("POST /lists", {"name": f"L{i}", "order": 0})[1] for i in range(MAX_BATCH // TASKS_PER_LIST + 1)]
    tasks = [call("POST /tasks", {"title": f"T{i}", "order": 0})[1] for i in range(MAX_BATCH)]
    body = [{"id": t["id"], "listId": lists[i // TASKS_PER_LIST]["id"]} for i, t in enumerate(tasks)]
    assert call("PATCH /tasks", body)[0] == 200
    assert call("DELETE /tasks", {"ids": [t["id"] for t in tasks]}) == (204, None)
    assert call("GET /data")[1]["tasks"] == []
