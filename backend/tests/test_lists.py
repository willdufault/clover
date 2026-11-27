from collections.abc import Callable

import pytest
from mypy_boto3_dynamodb.service_resource import Table

from schema import LIST_NAME_MAX, MAX_BATCH, USER_LIMITS


def test_create_and_get(call: Callable, mock_table: Table) -> None:
    status, lst = call("POST /lists", {"name": "🏠 Home", "order": 0})
    assert status == 201
    assert lst == {"id": lst["id"], "name": "🏠 Home", "order": 0}
    assert "Item" in mock_table.get_item(Key={"PK": "user-1", "SK": f"LIST#{lst['id']}"})
    assert call("GET /data")[1]["lists"] == [lst]


def test_create_validation(call: Callable) -> None:
    assert call("POST /lists", {"order": 0})[0] == 400
    assert call("POST /lists", {"name": " ", "order": 0})[0] == 400
    assert call("POST /lists", {"name": "x" * (LIST_NAME_MAX + 1), "order": 0})[0] == 400
    assert call("POST /lists", {"name": "a", "emoji": "x", "order": 0})[0] == 400
    assert call("POST /lists", {"name": "x" * LIST_NAME_MAX, "order": 0})[0] == 201


def test_user_limit(call: Callable) -> None:
    for i in range(USER_LIMITS["LIST"]):
        assert call("POST /lists", {"name": f"L{i}", "order": 0})[0] == 201
    assert call("POST /lists", {"name": "too many", "order": 0})[0] == 409


def test_create_over_limit_after_stale_read_is_409(call: Callable, race: Callable) -> None:
    for i in range(USER_LIMITS["LIST"] - 1):
        call("POST /lists", {"name": f"L{i}", "order": 0})
    race(lambda: call("POST /lists", {"name": "concurrent", "order": 0}))
    assert call("POST /lists", {"name": "too many", "order": 0}) == (409, {"error": "List limit reached"})
    assert len(call("GET /data")[1]["lists"]) == USER_LIMITS["LIST"]


def test_delete_after_stale_read_retries(call: Callable, race: Callable) -> None:
    a = call("POST /lists", {"name": "A", "order": 0})[1]
    b = call("POST /lists", {"name": "B", "order": 0})[1]
    call("POST /tasks", {"title": "T", "listId": a["id"], "order": 0})

    def concurrent() -> None:
        call("DELETE /lists", {"ids": [a["id"]]})
        call("POST /tasks", {"title": "New", "listId": b["id"], "order": 0})

    race(concurrent)
    assert call("DELETE /lists", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_delete_with_step_added_after_read_removes_step(call: Callable, mock_table: Table, race: Callable) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"], "order": 0})[1]
    race(lambda: call("POST /steps", {"title": "S", "taskId": task["id"], "order": 0}))
    assert call("DELETE /lists", {"ids": [lst["id"]]}) == (204, None)
    assert [i["SK"] for i in mock_table.scan()["Items"] if i["SK"] != "META"] == []


def test_update_does_not_bump_meta(call: Callable, mock_table: Table) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    version = mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"]
    assert call("PATCH /lists", [{"id": lst["id"], "name": "B"}])[0] == 200
    assert mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"] == version


def test_update(call: Callable) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    assert call("PATCH /lists", [{"id": lst["id"], "name": "B"}]) == (
        200,
        [{"id": lst["id"], "name": "B", "order": 0}],
    )
    assert call("PATCH /lists", [{"id": lst["id"], "name": ""}])[0] == 400
    assert call("PATCH /lists", [{"id": lst["id"], "name": "x" * (LIST_NAME_MAX + 1)}])[0] == 400
    assert call("PATCH /lists", [{"id": "missing", "name": "B"}])[0] == 404


def test_update_many(call: Callable) -> None:
    a = call("POST /lists", {"name": "A", "order": 0})[1]
    b = call("POST /lists", {"name": "B", "order": 0})[1]
    status, body = call("PATCH /lists", [{"id": b["id"], "name": "B2"}, {"id": a["id"]}])
    assert status == 200
    assert body == [{**b, "name": "B2"}, a]


def test_update_all_or_nothing(call: Callable) -> None:
    a = call("POST /lists", {"name": "A", "order": 0})[1]
    b = call("POST /lists", {"name": "B", "order": 0})[1]
    bad_id = [{"id": a["id"], "name": "X"}, {"id": "missing", "name": "Y"}]
    assert call("PATCH /lists", bad_id)[0] == 404
    bad_field = [{"id": a["id"], "name": "X"}, {"id": b["id"], "name": ""}]
    assert call("PATCH /lists", bad_field)[0] == 400
    assert call("GET /data")[1]["lists"] == [a, b]


def test_update_body_validation(call: Callable) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    assert call("PATCH /lists", [])[0] == 400
    assert call("PATCH /lists", {"id": lst["id"], "name": "B"})[0] == 400
    assert call("PATCH /lists", [{"name": "B"}])[0] == 400
    assert call("PATCH /lists", [{"id": 1, "name": "B"}])[0] == 400
    assert call("PATCH /lists", [{"id": lst["id"]}, {"id": lst["id"], "name": "B"}])[0] == 400
    assert call("PATCH /lists", [{"id": lst["id"]}] * (MAX_BATCH + 1))[0] == 400


def test_delete_cascades(call: Callable) -> None:
    a = call("POST /lists", {"name": "A", "order": 0})[1]
    b = call("POST /lists", {"name": "B", "order": 0})[1]
    keep = call("POST /lists", {"name": "Keep", "order": 0})[1]
    ta = call("POST /tasks", {"title": "T", "listId": a["id"], "order": 0})[1]
    tb = call("POST /tasks", {"title": "T", "listId": b["id"], "order": 0})[1]
    call("POST /steps", {"title": "S", "taskId": ta["id"], "order": 0})
    call("POST /steps", {"title": "S", "taskId": tb["id"], "order": 0})
    other = call("POST /tasks", {"title": "Other", "order": 0})[1]
    assert call("DELETE /lists", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [keep], "tasks": [other], "steps": []}
    assert call("DELETE /lists", {"ids": [a["id"]]})[0] == 204


def test_delete_skips_missing_ids(call: Callable) -> None:
    a = call("POST /lists", {"name": "A", "order": 0})[1]
    assert call("DELETE /lists", {"ids": [a["id"], "missing"]})[0] == 204
    assert call("GET /data")[1]["lists"] == []


def test_delete_body_validation(call: Callable) -> None:
    a = call("POST /lists", {"name": "A", "order": 0})[1]
    assert call("DELETE /lists")[0] == 400
    assert call("DELETE /lists", {"ids": []})[0] == 400
    assert call("DELETE /lists", {"ids": [a["id"], a["id"]]})[0] == 400
    assert call("DELETE /lists", {"ids": [1]})[0] == 400
    assert call("DELETE /lists", {"ids": [str(i) for i in range(MAX_BATCH + 1)]})[0] == 400
    assert call("DELETE /lists", [a["id"]])[0] == 400
    assert call("GET /data")[1]["lists"] == [a]


def test_delete_goes_parents_first(call: Callable, mock_table: Table, monkeypatch: pytest.MonkeyPatch) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"], "order": 0})[1]
    call("POST /steps", {"taskId": task["id"], "title": "S", "order": 0})
    order = []
    client = mock_table.meta.client
    batch_write_item = client.batch_write_item
    transact_write_items = client.transact_write_items

    def batch(RequestItems: dict) -> object:
        order.extend(r["DeleteRequest"]["Key"]["SK"].split("#")[0] for r in RequestItems["test"])
        return batch_write_item(RequestItems=RequestItems)

    def transact(TransactItems: list) -> object:
        order.extend(t["Delete"]["Key"]["SK"].split("#")[0] for t in TransactItems if "Delete" in t)
        return transact_write_items(TransactItems=TransactItems)

    monkeypatch.setattr(client, "batch_write_item", batch)
    monkeypatch.setattr(client, "transact_write_items", transact)
    assert call("DELETE /lists", {"ids": [lst["id"]]}) == (204, None)
    assert order == ["LIST", "TASK", "STEP"]


def test_id_only_update_skips_transaction(call: Callable, mock_table: Table, monkeypatch: pytest.MonkeyPatch) -> None:
    lst = call("POST /lists", {"name": "A", "order": 0})[1]
    calls = []
    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", lambda **kwargs: calls.append(kwargs))
    assert call("PATCH /lists", [{"id": lst["id"]}]) == (200, [lst])
    assert calls == []


def test_order(call: Callable) -> None:
    assert call("POST /lists", {"name": "A"}) == (400, {"error": "Missing order"})
    a = call("POST /lists", {"name": "A", "order": 5})[1]
    b = call("POST /lists", {"name": "B", "order": -3})[1]
    assert (a["order"], b["order"]) == (5, -3)
    body = [{"id": a["id"], "order": 1}, {"id": b["id"], "order": 2}]
    assert call("PATCH /lists", body) == (200, [{**a, "order": 1}, {**b, "order": 2}])
    assert [lst["order"] for lst in call("GET /data")[1]["lists"]] == [1, 2]
