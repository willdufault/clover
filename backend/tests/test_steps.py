import pytest

import common


@pytest.fixture
def task(call):
    return call("POST /tasks", {"title": "T"})[1]


def test_create(call, task):
    status, step = call("POST /steps", {"title": "S", "taskId": task["id"]})
    assert status == 201
    assert step == {"id": step["id"], "taskId": task["id"], "title": "S", "completed": False}


def test_create_validation(call, task):
    assert call("POST /steps", {"title": "S"})[0] == 400
    assert call("POST /steps", {"taskId": task["id"]})[0] == 400
    assert call("POST /steps", {"title": "x" * 101, "taskId": task["id"]})[0] == 400
    assert call("POST /steps", {"title": "S", "taskId": "missing"})[0] == 404


def test_task_limit(call, task):
    for i in range(10):
        assert call("POST /steps", {"title": f"S{i}", "taskId": task["id"]})[0] == 201
    assert call("POST /steps", {"title": "x", "taskId": task["id"]})[0] == 409


def test_user_limit(call):
    for t in range(10):
        task = call("POST /tasks", {"title": f"T{t}"})[1]
        for s in range(10):
            call("POST /steps", {"title": f"S{s}", "taskId": task["id"]})
    task = call("POST /tasks", {"title": "last"})[1]
    assert call("POST /steps", {"title": "x", "taskId": task["id"]})[0] == 409


def test_update(call, task):
    step = call("POST /steps", {"title": "S", "taskId": task["id"]})[1]
    other = call("POST /steps", {"title": "O", "taskId": task["id"]})[1]
    body = [{"id": step["id"], "completed": True}, {"id": other["id"], "title": "O2"}]
    assert call("PATCH /steps", body) == (
        200,
        [{**step, "completed": True}, {**other, "title": "O2"}],
    )
    assert call("PATCH /steps", [{"id": step["id"], "taskId": "x"}])[0] == 400
    assert call("PATCH /steps", [{"id": step["id"], "completed": 1}])[0] == 400
    assert call("PATCH /steps", [{"id": "missing", "title": "S"}])[0] == 404


def test_delete(call, task):
    a = call("POST /steps", {"title": "A", "taskId": task["id"]})[1]
    b = call("POST /steps", {"title": "B", "taskId": task["id"]})[1]
    c = call("POST /steps", {"title": "C", "taskId": task["id"]})[1]
    assert call("DELETE /steps", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1]["steps"] == [c]
    assert call("DELETE /steps", {"ids": [a["id"]]})[0] == 404


def test_create_on_task_deleted_after_read_is_404(call, table, task, monkeypatch):
    # Simulate the task being deleted after the read and before the write.
    stale = common.load_all("user-1")
    table.delete_item(Key={"PK": "user-1", "SK": f"TASK#{task['id']}"})
    monkeypatch.setattr(common, "load_all", lambda user_id: stale)
    assert call("POST /steps", {"title": "S", "taskId": task["id"]}) == (
        404,
        {"error": "Task not found."},
    )
    assert table.items == {}
