import json
import os
from collections.abc import Callable, Iterator

import boto3
import pytest
from moto import mock_aws
from mypy_boto3_dynamodb.service_resource import Table

os.environ["AWS_IGNORE_CONFIGURED_ENDPOINT_URLS"] = "true"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["TABLE_NAME"] = "test"

import db
import index


@pytest.fixture
def mock_table(monkeypatch: pytest.MonkeyPatch) -> Iterator[Table]:
    with mock_aws():
        mock_table = boto3.resource("dynamodb").create_table(
            TableName="test",
            KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        monkeypatch.setattr(db, "table", mock_table)
        yield mock_table


@pytest.fixture
def call(mock_table: Table) -> Callable:
    def call(route_key: str, body: object = None, user: str = "user-1", raw: str | None = None) -> tuple:
        event = {
            "routeKey": route_key,
            "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user}}}},
        }
        if body is not None:
            event["body"] = json.dumps(body)
        if raw is not None:
            event["body"] = raw
        res = index.handler(event, None)
        return res["statusCode"], json.loads(res["body"]) if "body" in res else None

    return call


@pytest.fixture
def race(monkeypatch: pytest.MonkeyPatch) -> Callable:
    def race(concurrent: Callable) -> None:
        reads = [db.load_all("user-1")]
        concurrent()
        real = db.load_all
        monkeypatch.setattr(db, "load_all", lambda user_id: reads.pop() if reads else real(user_id))

    return race
