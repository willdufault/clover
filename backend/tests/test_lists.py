def test_create_and_get(call, table):
    status, lst = call("POST /lists", {"name": "🏠 Home"})
    assert status == 201
    assert lst == {"id": lst["id"], "name": "🏠 Home"}
    assert ("user-1", f"LIST#{lst['id']}") in table.items
    assert call("GET /data")[1]["lists"] == [lst]


def test_create_validation(call):
    assert call("POST /lists", {})[0] == 400
    assert call("POST /lists", {"name": " "})[0] == 400
    assert call("POST /lists", {"name": "x" * 51})[0] == 400
    assert call("POST /lists", {"name": "a", "emoji": "x"})[0] == 400


def test_user_limit(call):
    for i in range(10):
        assert call("POST /lists", {"name": f"L{i}"})[0] == 201
    assert call("POST /lists", {"name": "too many"})[0] == 409


def test_update(call):
    lst = call("POST /lists", {"name": "A"})[1]
    assert call("PATCH /lists/{id}", {"name": "B"}, id=lst["id"]) == (
        200,
        {"id": lst["id"], "name": "B"},
    )
    assert call("PATCH /lists/{id}", {"name": ""}, id=lst["id"])[0] == 400
    assert call("PATCH /lists/{id}", {"name": "B"}, id="missing")[0] == 404


def test_delete_cascades(call, table):
    lst = call("POST /lists", {"name": "A"})[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"]})[1]
    call("POST /steps", {"title": "S", "taskId": task["id"]})
    other = call("POST /tasks", {"title": "Other"})[1]
    assert call("DELETE /lists/{id}", id=lst["id"]) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [other], "steps": []}
    assert call("DELETE /lists/{id}", id=lst["id"])[0] == 404
