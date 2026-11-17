import common


def test_unknown_route(call):
    assert call("GET /nope") == (404, {"error": "Route not found."})


def test_invalid_json(call):
    assert call("POST /lists", raw="{nope") == (400, {"error": "Invalid JSON."})


def test_users_are_isolated(call):
    call("POST /lists", {"name": "Mine"}, user="a")
    assert call("GET /data", user="b")[1]["lists"] == []
    assert len(call("GET /data", user="a")[1]["lists"]) == 1


def test_cannot_modify_other_users_data(call):
    lst = call("POST /lists", {"name": "L"}, user="a")[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"]}, user="a")[1]
    step = call("POST /steps", {"title": "S", "taskId": task["id"]}, user="a")[1]
    before = call("GET /data", user="a")
    for kind, item, field in [("lists", lst, "name"), ("tasks", task, "title"), ("steps", step, "title")]:
        assert call(f"PATCH /{kind}", [{"id": item["id"], field: "X"}], user="b")[0] == 404
        assert call(f"DELETE /{kind}", {"ids": [item["id"]]}, user="b")[0] == 404
    assert call("GET /data", user="a") == before


def test_unexpected_error_is_500(call, monkeypatch):
    def boom(user_id):
        raise RuntimeError("boom")

    monkeypatch.setattr(common, "load_all", boom)
    assert call("GET /data") == (500, {"error": "Internal server error."})
