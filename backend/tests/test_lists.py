from common import LIST_NAME_MAX, MAX_BATCH, USER_LIMITS


def test_create_and_get(call, mock_table):
    status, lst = call("POST /lists", {"name": "🏠 Home"})
    assert status == 201
    assert lst == {"id": lst["id"], "name": "🏠 Home"}
    assert "Item" in mock_table.get_item(Key={"PK": "user-1", "SK": f"LIST#{lst['id']}"})
    assert call("GET /data")[1]["lists"] == [lst]


def test_create_validation(call):
    assert call("POST /lists", {})[0] == 400
    assert call("POST /lists", {"name": " "})[0] == 400
    assert call("POST /lists", {"name": "x" * (LIST_NAME_MAX + 1)})[0] == 400
    assert call("POST /lists", {"name": "a", "emoji": "x"})[0] == 400
    assert call("POST /lists", {"name": "x" * LIST_NAME_MAX})[0] == 201


def test_user_limit(call):
    for i in range(USER_LIMITS["LIST"]):
        assert call("POST /lists", {"name": f"L{i}"})[0] == 201
    assert call("POST /lists", {"name": "too many"})[0] == 409


def test_first_write_creates_meta(call, mock_table):
    assert call("POST /lists", {"name": "A"})[0] == 201
    assert mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"] == 1


def test_create_over_limit_after_stale_read_is_409(call, race):
    for i in range(USER_LIMITS["LIST"] - 1):
        call("POST /lists", {"name": f"L{i}"})
    race(lambda: call("POST /lists", {"name": "concurrent"}))
    assert call("POST /lists", {"name": "too many"}) == (409, {"error": "List limit reached"})
    assert len(call("GET /data")[1]["lists"]) == USER_LIMITS["LIST"]


def test_delete_after_stale_read_retries(call, race):
    a = call("POST /lists", {"name": "A"})[1]
    b = call("POST /lists", {"name": "B"})[1]
    call("POST /tasks", {"title": "T", "listId": a["id"]})

    def concurrent():
        call("DELETE /lists", {"ids": [a["id"]]})
        call("POST /tasks", {"title": "New", "listId": b["id"]})

    race(concurrent)
    assert call("DELETE /lists", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_update_does_not_bump_meta(call, mock_table):
    lst = call("POST /lists", {"name": "A"})[1]
    version = mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"]
    assert call("PATCH /lists", [{"id": lst["id"], "name": "B"}])[0] == 200
    assert mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"] == version


def test_update(call):
    lst = call("POST /lists", {"name": "A"})[1]
    assert call("PATCH /lists", [{"id": lst["id"], "name": "B"}]) == (
        200,
        [{"id": lst["id"], "name": "B"}],
    )
    assert call("PATCH /lists", [{"id": lst["id"], "name": ""}])[0] == 400
    assert call("PATCH /lists", [{"id": lst["id"], "name": "x" * (LIST_NAME_MAX + 1)}])[0] == 400
    assert call("PATCH /lists", [{"id": "missing", "name": "B"}])[0] == 404


def test_update_many(call):
    a = call("POST /lists", {"name": "A"})[1]
    b = call("POST /lists", {"name": "B"})[1]
    status, body = call("PATCH /lists", [{"id": b["id"], "name": "B2"}, {"id": a["id"]}])
    assert status == 200
    assert body == [{"id": b["id"], "name": "B2"}, a]


def test_update_all_or_nothing(call):
    a = call("POST /lists", {"name": "A"})[1]
    b = call("POST /lists", {"name": "B"})[1]
    bad_id = [{"id": a["id"], "name": "X"}, {"id": "missing", "name": "Y"}]
    assert call("PATCH /lists", bad_id)[0] == 404
    bad_field = [{"id": a["id"], "name": "X"}, {"id": b["id"], "name": ""}]
    assert call("PATCH /lists", bad_field)[0] == 400
    assert call("GET /data")[1]["lists"] == [a, b]


def test_update_body_validation(call):
    lst = call("POST /lists", {"name": "A"})[1]
    assert call("PATCH /lists", [])[0] == 400
    assert call("PATCH /lists", {"id": lst["id"], "name": "B"})[0] == 400
    assert call("PATCH /lists", [{"name": "B"}])[0] == 400
    assert call("PATCH /lists", [{"id": 1, "name": "B"}])[0] == 400
    assert call("PATCH /lists", [{"id": lst["id"]}, {"id": lst["id"], "name": "B"}])[0] == 400
    assert call("PATCH /lists", [{"id": lst["id"]}] * (MAX_BATCH + 1))[0] == 400


def test_delete_cascades(call):
    a = call("POST /lists", {"name": "A"})[1]
    b = call("POST /lists", {"name": "B"})[1]
    keep = call("POST /lists", {"name": "Keep"})[1]
    ta = call("POST /tasks", {"title": "T", "listId": a["id"]})[1]
    tb = call("POST /tasks", {"title": "T", "listId": b["id"]})[1]
    call("POST /steps", {"title": "S", "taskId": ta["id"]})
    call("POST /steps", {"title": "S", "taskId": tb["id"]})
    other = call("POST /tasks", {"title": "Other"})[1]
    assert call("DELETE /lists", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [keep], "tasks": [other], "steps": []}
    assert call("DELETE /lists", {"ids": [a["id"]]})[0] == 204


def test_delete_skips_missing_ids(call):
    a = call("POST /lists", {"name": "A"})[1]
    assert call("DELETE /lists", {"ids": [a["id"], "missing"]})[0] == 204
    assert call("GET /data")[1]["lists"] == []


def test_delete_body_validation(call):
    a = call("POST /lists", {"name": "A"})[1]
    assert call("DELETE /lists")[0] == 400
    assert call("DELETE /lists", {"ids": []})[0] == 400
    assert call("DELETE /lists", {"ids": [a["id"], a["id"]]})[0] == 400
    assert call("DELETE /lists", {"ids": [1]})[0] == 400
    assert call("DELETE /lists", {"ids": [str(i) for i in range(MAX_BATCH + 1)]})[0] == 400
    assert call("DELETE /lists", [a["id"]])[0] == 400
    assert call("GET /data")[1]["lists"] == [a]


def test_delete_goes_children_first(call, mock_table):
    lst = call("POST /lists", {"name": "A"})[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"]})[1]
    call("POST /steps", {"taskId": task["id"], "title": "S"})
    order = []
    client = mock_table.meta.client
    batch_write_item = client.batch_write_item
    transact_write_items = client.transact_write_items

    def batch(RequestItems):
        order.extend(r["DeleteRequest"]["Key"]["SK"].split("#")[0] for r in RequestItems["test"])
        return batch_write_item(RequestItems=RequestItems)

    def transact(TransactItems):
        order.extend(t["Delete"]["Key"]["SK"].split("#")[0] for t in TransactItems if "Delete" in t)
        return transact_write_items(TransactItems=TransactItems)

    client.batch_write_item = batch
    client.transact_write_items = transact
    assert call("DELETE /lists", {"ids": [lst["id"]]}) == (204, None)
    assert order == ["STEP", "TASK", "LIST"]
