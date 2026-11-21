import pytest
from botocore.exceptions import ClientError
from mypy_boto3_dynamodb.service_resource import Table

from shared import db
from shared.api import ApiError


def put(mock_table: Table) -> dict:
    return {"Put": {"TableName": mock_table.name, "Item": {"PK": "user-1", "SK": "LIST#a"}}}


def cancelled(code: str) -> ClientError:
    return ClientError(
        {"Error": {"Code": "TransactionCanceledException"}, "CancellationReasons": [{"Code": code}]},
        "TransactWriteItems",
    )


def test_transaction_conflict_is_retried(mock_table: Table, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db.time, "sleep", lambda s: None)
    real = mock_table.meta.client.transact_write_items
    failures = [cancelled("TransactionConflict")]

    def flaky(TransactItems: list) -> object:
        if failures:
            raise failures.pop()
        return real(TransactItems=TransactItems)

    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", flaky)
    db.transact([put(mock_table)])
    assert "Item" in mock_table.get_item(Key={"PK": "user-1", "SK": "LIST#a"})


def test_transaction_conflict_gives_up_with_409(mock_table: Table, monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps = []
    monkeypatch.setattr(db.time, "sleep", sleeps.append)

    def always(TransactItems: list) -> None:
        raise cancelled("TransactionConflict")

    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", always)
    with pytest.raises(ApiError) as e:
        db.transact([put(mock_table)])
    assert (e.value.status, e.value.message) == (409, "Concurrent update")
    assert len(sleeps) == db.TRANSACTION_RETRIES
    bases = [db.RETRY_BASE_DELAY * 2**i for i in range(db.TRANSACTION_RETRIES)]
    for base, slept in zip(bases, sleeps, strict=True):
        assert base <= slept <= base + db.RETRY_JITTER


def test_transaction_other_error_is_raised_without_retry(mock_table: Table, monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps = []
    monkeypatch.setattr(db.time, "sleep", sleeps.append)

    def always(TransactItems: list) -> None:
        raise cancelled("ValidationError")

    monkeypatch.setattr(mock_table.meta.client, "transact_write_items", always)
    with pytest.raises(ClientError):
        db.transact([put(mock_table)])
    assert sleeps == []
