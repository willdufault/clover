import pytest


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
    assert call("PATCH /steps/{id}", {"completed": True}, id=step["id"]) == (
        200,
        {**step, "completed": True},
    )
    assert call("PATCH /steps/{id}", {"taskId": "x"}, id=step["id"])[0] == 400
    assert call("PATCH /steps/{id}", {"completed": 1}, id=step["id"])[0] == 400
    assert call("PATCH /steps/{id}", {"title": "S"}, id="missing")[0] == 404


def test_delete(call, task):
    step = call("POST /steps", {"title": "S", "taskId": task["id"]})[1]
    assert call("DELETE /steps/{id}", id=step["id"]) == (204, None)
    assert call("GET /data")[1]["steps"] == []
    assert call("DELETE /steps/{id}", id=step["id"])[0] == 404
