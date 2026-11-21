import pytest
from botocore.exceptions import ClientError

from shared import db
from shared.api import ApiError


def put(mock_table):
    return {"Put": {"TableName": mock_table.name, "Item": {"PK": "user-1", "SK": "LIST#a"}}}


def cancelled(code):
    error = {
        "Error": {"Code": "TransactionCanceledException"},
        "CancellationReasons": [{"Code": code}],
    }
    return ClientError(error, "TransactWriteItems")


def test_transaction_conflict_is_retried(mock_table, monkeypatch):
    monkeypatch.setattr(db.time, "sleep", lambda s: None)
    real = mock_table.meta.client.transact_write_items
    failures = [cancelled("TransactionConflict")]

    def flaky(TransactItems):
        if failures:
            raise failures.pop()
        return real(TransactItems=TransactItems)

    mock_table.meta.client.transact_write_items = flaky
    db.transact([put(mock_table)])
    assert "Item" in mock_table.get_item(Key={"PK": "user-1", "SK": "LIST#a"})


def test_transaction_conflict_gives_up_with_409(mock_table, monkeypatch):
    sleeps = []
    monkeypatch.setattr(db.time, "sleep", sleeps.append)

    def always(TransactItems):
        raise cancelled("TransactionConflict")

    mock_table.meta.client.transact_write_items = always
    with pytest.raises(ApiError) as e:
        db.transact([put(mock_table)])
    assert (e.value.status, e.value.message) == (409, "Concurrent update")
    assert len(sleeps) == db.TRANSACTION_RETRIES
    bases = [db.RETRY_BASE_DELAY * 2**i for i in range(db.TRANSACTION_RETRIES)]
    for base, slept in zip(bases, sleeps, strict=True):
        assert base <= slept <= base + db.RETRY_JITTER


def test_transaction_other_error_is_raised_without_retry(mock_table, monkeypatch):
    sleeps = []
    monkeypatch.setattr(db.time, "sleep", sleeps.append)

    def always(TransactItems):
        raise cancelled("ValidationError")

    mock_table.meta.client.transact_write_items = always
    with pytest.raises(ClientError):
        db.transact([put(mock_table)])
    assert sleeps == []
