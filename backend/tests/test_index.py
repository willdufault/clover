import common


def test_unknown_route(call):
    assert call("GET /nope") == (404, {"error": "Not found"})


def test_invalid_json(call):
    assert call("POST /lists", raw="{nope") == (400, {"error": "Invalid JSON"})


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
        assert call(f"DELETE /{kind}", {"ids": [item["id"]]}, user="b")[0] == 204
    assert call("GET /data", user="a") == before


def test_unexpected_error_is_500(call, monkeypatch):
    def boom(user_id):
        raise RuntimeError("boom")

    monkeypatch.setattr(common, "load_all", boom)
    assert call("GET /data") == (500, {"error": "Internal error"})


def test_first_write_after_stale_read_retries(call, mock_table, race):
    race(lambda: call("POST /lists", {"name": "A"}))
    attempts = []
    real = mock_table.meta.client.transact_write_items

    def counted(TransactItems):
        attempts.append(1)
        return real(TransactItems=TransactItems)

    mock_table.meta.client.transact_write_items = counted
    assert call("POST /lists", {"name": "B"})[0] == 201
    assert len(call("GET /data")[1]["lists"]) == 2
    assert mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"] == 2
    assert len(attempts) == 2


def test_exhausted_stale_retries_is_409(call, monkeypatch):
    stale = common.load_all("user-1")
    call("POST /lists", {"name": "A"})
    monkeypatch.setattr(common, "load_all", lambda user_id: stale)
    assert call("POST /lists", {"name": "B"}) == (409, {"error": "Concurrent update"})
