import pytest
from botocore.exceptions import ClientError

import common


def test_create_defaults(call):
    status, task = call("POST /tasks", {"title": "T"})
    assert status == 201
    assert task == {
        "id": task["id"],
        "title": "T",
        "stage": "open",
        "due": None,
        "priority": "medium",
        "addedToToday": False,
        "listId": None,
    }


def test_create_all_fields(call):
    lst = call("POST /lists", {"name": "A"})[1]
    body = {
        "title": "T",
        "stage": "waiting",
        "due": "2026-12-01",
        "priority": "high",
        "addedToToday": True,
        "listId": lst["id"],
    }
    status, task = call("POST /tasks", body)
    assert status == 201
    assert task == {"id": task["id"], **body}


def test_create_validation(call):
    assert call("POST /tasks", {})[0] == 400
    assert call("POST /tasks", {"title": "x" * 101})[0] == 400
    assert call("POST /tasks", {"title": "T", "stage": "nope"})[0] == 400
    assert call("POST /tasks", {"title": "T", "priority": "urgent"})[0] == 400
    assert call("POST /tasks", {"title": "T", "due": "tomorrow"})[0] == 400
    assert call("POST /tasks", {"title": "T", "addedToToday": "yes"})[0] == 400
    assert call("POST /tasks", {"title": "T", "listId": "missing"})[0] == 404


def test_list_limit(call):
    lst = call("POST /lists", {"name": "A"})[1]
    for i in range(20):
        assert call("POST /tasks", {"title": f"T{i}", "listId": lst["id"]})[0] == 201
    assert call("POST /tasks", {"title": "x", "listId": lst["id"]})[0] == 409
    assert call("POST /tasks", {"title": "unassigned"})[0] == 201


def test_user_limit(call):
    for i in range(100):
        assert call("POST /tasks", {"title": f"T{i}"})[0] == 201
    assert call("POST /tasks", {"title": "x"})[0] == 409


def test_update(call):
    task = call("POST /tasks", {"title": "T"})[1]
    other = call("POST /tasks", {"title": "O"})[1]
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


def test_update_move_checks_list(call):
    full = call("POST /lists", {"name": "Full"})[1]
    for i in range(20):
        call("POST /tasks", {"title": f"T{i}", "listId": full["id"]})
    task = call("POST /tasks", {"title": "T"})[1]
    assert call("PATCH /tasks", [{"id": task["id"], "listId": "missing"}]) == (
        404,
        {"error": "List not found."},
    )
    assert call("PATCH /tasks", [{"id": task["id"], "listId": full["id"]}]) == (
        409,
        {"error": "List is full."},
    )
    other = call("POST /lists", {"name": "Other"})[1]
    status, moved = call("PATCH /tasks", [{"id": task["id"], "listId": other["id"]}])
    assert (status, moved[0]["listId"]) == (200, other["id"])
    status, moved = call("PATCH /tasks", [{"id": task["id"], "listId": None}])
    assert (status, moved[0]["listId"]) == (200, None)


def test_update_batch_move_overflow(call):
    target = call("POST /lists", {"name": "Target"})[1]
    for i in range(19):
        call("POST /tasks", {"title": f"T{i}", "listId": target["id"]})
    a = call("POST /tasks", {"title": "A"})[1]
    b = call("POST /tasks", {"title": "B"})[1]
    body = [{"id": a["id"], "listId": target["id"]}, {"id": b["id"], "listId": target["id"]}]
    assert call("PATCH /tasks", body)[0] == 409
    tasks = {t["id"]: t for t in call("GET /data")[1]["tasks"]}
    assert tasks[a["id"]] == a and tasks[b["id"]] == b
    # Swapping one task out makes room for both.
    inside = next(t for t in tasks.values() if t["listId"] == target["id"])
    status, _ = call("PATCH /tasks", [{"id": inside["id"], "listId": None}, *body])
    assert status == 200


def test_update_within_full_list_is_allowed(call):
    full = call("POST /lists", {"name": "Full"})[1]
    tasks = [call("POST /tasks", {"title": f"T{i}", "listId": full["id"]})[1] for i in range(20)]
    body = [{"id": tasks[0]["id"], "listId": full["id"], "stage": "done"}]
    assert call("PATCH /tasks", body)[0] == 200


def test_delete_cascades(call):
    a = call("POST /tasks", {"title": "A"})[1]
    b = call("POST /tasks", {"title": "B"})[1]
    call("POST /steps", {"title": "S", "taskId": a["id"]})
    call("POST /steps", {"title": "S", "taskId": b["id"]})
    other = call("POST /tasks", {"title": "Other"})[1]
    step = call("POST /steps", {"title": "S2", "taskId": other["id"]})[1]
    assert call("DELETE /tasks", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [other], "steps": [step]}
    assert call("DELETE /tasks", {"ids": [a["id"]]})[0] == 404


def test_delete_unknown_id_deletes_nothing(call):
    a = call("POST /tasks", {"title": "A"})[1]
    step = call("POST /steps", {"title": "S", "taskId": a["id"]})[1]
    assert call("DELETE /tasks", {"ids": [a["id"], "missing"]})[0] == 404
    assert call("GET /data")[1] == {"lists": [], "tasks": [a], "steps": [step]}


def test_update_only_writes_given_fields(call, table):
    task = call("POST /tasks", {"title": "T"})[1]
    # Simulate a concurrent write the caller hasn't seen.
    table.items[("user-1", f"TASK#{task['id']}")]["stage"] = "waiting"
    status, updated = call("PATCH /tasks", [{"id": task["id"], "due": "2030-01-02"}])
    assert status == 200
    assert updated[0]["stage"] == "waiting"
    assert updated[0]["due"] == "2030-01-02"


def test_update_deleted_task_is_404(call):
    a = call("POST /tasks", {"title": "A"})[1]
    b = call("POST /tasks", {"title": "B"})[1]
    stale = common.load_all("user-1")
    call("DELETE /tasks", {"ids": [b["id"]]})
    patches = [(a["id"], {"title": "A2"}), (b["id"], {"title": "B2"})]
    with pytest.raises(common.ApiError) as e:
        common.update_many("user-1", "TASK", patches, stale)
    assert e.value.status == 404
    assert call("GET /data")[1]["tasks"] == [a]


def conflict():
    error = {
        "Error": {"Code": "TransactionCanceledException"},
        "CancellationReasons": [{"Code": "TransactionConflict"}],
    }
    return ClientError(error, "TransactWriteItems")


def test_transaction_conflict_is_retried(call, table, monkeypatch):
    monkeypatch.setattr(common.time, "sleep", lambda s: None)
    task = call("POST /tasks", {"title": "T"})[1]
    real = table.transact_write_items
    failures = [conflict()]

    def flaky(TransactItems):
        if failures:
            raise failures.pop()
        return real(TransactItems)

    table.transact_write_items = flaky
    status, body = call("PATCH /tasks", [{"id": task["id"], "stage": "done"}])
    assert status == 200 and body[0]["stage"] == "done"


def test_transaction_conflict_gives_up_with_500(call, table, monkeypatch):
    sleeps = []
    monkeypatch.setattr(common.time, "sleep", sleeps.append)
    task = call("POST /tasks", {"title": "T"})[1]

    def always(TransactItems):
        raise conflict()

    table.transact_write_items = always
    assert call("PATCH /tasks", [{"id": task["id"], "stage": "done"}]) == (
        500,
        {"error": "Internal server error."},
    )
    assert len(sleeps) == 3
    for base, slept in zip([0.05, 0.1, 0.2], sleeps):
        assert base <= slept <= base + 0.05
