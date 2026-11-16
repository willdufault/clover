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
    status, updated = call(
        "PATCH /tasks/{id}", {"stage": "done", "due": "2026-01-02"}, id=task["id"]
    )
    assert status == 200
    assert updated == {**task, "stage": "done", "due": "2026-01-02"}
    assert call("PATCH /tasks/{id}", {"stage": "x"}, id=task["id"])[0] == 400
    assert call("PATCH /tasks/{id}", {"title": "T"}, id="missing")[0] == 404


def test_update_move_checks_list(call):
    full = call("POST /lists", {"name": "Full"})[1]
    for i in range(20):
        call("POST /tasks", {"title": f"T{i}", "listId": full["id"]})
    task = call("POST /tasks", {"title": "T"})[1]
    assert call("PATCH /tasks/{id}", {"listId": "missing"}, id=task["id"])[0] == 404
    assert call("PATCH /tasks/{id}", {"listId": full["id"]}, id=task["id"])[0] == 409
    other = call("POST /lists", {"name": "Other"})[1]
    status, moved = call("PATCH /tasks/{id}", {"listId": other["id"]}, id=task["id"])
    assert (status, moved["listId"]) == (200, other["id"])
    status, moved = call("PATCH /tasks/{id}", {"listId": None}, id=task["id"])
    assert (status, moved["listId"]) == (200, None)


def test_delete_cascades(call):
    task = call("POST /tasks", {"title": "T"})[1]
    call("POST /steps", {"title": "S", "taskId": task["id"]})
    other = call("POST /tasks", {"title": "Other"})[1]
    step = call("POST /steps", {"title": "S2", "taskId": other["id"]})[1]
    assert call("DELETE /tasks/{id}", id=task["id"]) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [other], "steps": [step]}
    assert call("DELETE /tasks/{id}", id=task["id"])[0] == 404
