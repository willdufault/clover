from collections.abc import Callable

import pytest
from mypy_boto3_dynamodb.service_resource import Table

import db
import index


def test_unknown_route(call: Callable) -> None:
    assert call("GET /nope") == (404, {"error": "Not found"})


def test_invalid_json(call: Callable) -> None:
    assert call("POST /lists", raw="{nope") == (400, {"error": "Invalid JSON"})


def test_users_are_isolated(call: Callable) -> None:
    call("POST /lists", {"name": "Mine", "order": 0}, user="a")
    assert call("GET /data", user="b")[1]["lists"] == []
    assert len(call("GET /data", user="a")[1]["lists"]) == 1


def test_cannot_modify_other_users_data(call: Callable) -> None:
    lst = call("POST /lists", {"name": "L", "order": 0}, user="a")[1]
    task = call("POST /tasks", {"title": "T", "listId": lst["id"], "order": 0}, user="a")[1]
    step = call("POST /steps", {"title": "S", "taskId": task["id"], "order": 0}, user="a")[1]
    before = call("GET /data", user="a")
    for kind, item, field in [("lists", lst, "name"), ("tasks", task, "title"), ("steps", step, "title")]:
        assert call(f"PATCH /{kind}", [{"id": item["id"], field: "X"}], user="b")[0] == 404
        assert call(f"DELETE /{kind}", {"ids": [item["id"]]}, user="b")[0] == 204
    assert call("GET /data", user="a") == before


def test_unexpected_error_is_500(call: Callable, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(user_id: str) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(db, "load_all", boom)
    assert call("GET /data") == (500, {"error": "Internal error"})


def test_first_write_after_stale_read_retries(
    call: Callable, mock_table: Table, race: Callable, monkeypatch: pytest.MonkeyPatch
) -> None:
    race(lambda: call("POST /lists", {"name": "A", "order": 0}))
    attempts = []
    real = mock_table.meta.client.transact_write_items

    def counted(TransactItems: list) -> object:
        attempts.append(1)
        return real(TransactItems=TransactItems)

    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", counted)
    assert call("POST /lists", {"name": "B", "order": 0})[0] == 201
    assert len(call("GET /data")[1]["lists"]) == 2
    assert mock_table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"] == 2
    assert len(attempts) == 2


def test_exhausted_stale_retries_is_409(call: Callable, mock_table: Table, monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps = []
    monkeypatch.setattr(db, "backoff", sleeps.append)
    stale = db.load_all("user-1")
    call("POST /lists", {"name": "A", "order": 0})
    monkeypatch.setattr(db, "load_all", lambda user_id: stale)
    attempts = []
    real = mock_table.meta.client.transact_write_items

    def counted(TransactItems: list) -> object:
        attempts.append(1)
        return real(TransactItems=TransactItems)

    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", counted)
    assert call("POST /lists", {"name": "B", "order": 0}) == (409, {"error": "Concurrent update"})
    assert len(attempts) == 3
    assert sleeps == list(range(index.STALE_RETRIES))
