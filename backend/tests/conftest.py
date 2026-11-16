import json
import os

import pytest
from botocore.exceptions import ClientError

os.environ.setdefault("TABLE_NAME", "test")
os.environ.setdefault("TABLE_REGION", "us-east-1")

import common  # noqa: E402
import index  # noqa: E402


class FakeTable:
    def __init__(self):
        self.items = {}

    def put_item(self, Item):
        self.items[(Item["PK"], Item["SK"])] = dict(Item)

    def update_item(self, Key, ExpressionAttributeNames, ExpressionAttributeValues, ReturnValues, **_):
        item = self.items.get((Key["PK"], Key["SK"]))
        if item is None:
            error = {"Error": {"Code": "ConditionalCheckFailedException"}}
            raise ClientError(error, "UpdateItem")
        for name, field in ExpressionAttributeNames.items():
            item[field] = ExpressionAttributeValues[":" + name[1:]]
        return {"Attributes": dict(item)}

    def get_item(self, Key):
        item = self.items.get((Key["PK"], Key["SK"]))
        return {"Item": dict(item)} if item else {}

    def delete_item(self, Key):
        self.items.pop((Key["PK"], Key["SK"]), None)

    def query(self, KeyConditionExpression):
        pk = KeyConditionExpression.get_expression()["values"][1]
        return {"Items": [dict(i) for (p, _), i in self.items.items() if p == pk]}

    def batch_writer(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


@pytest.fixture
def table(monkeypatch):
    fake = FakeTable()
    monkeypatch.setattr(common, "table", fake)
    return fake


@pytest.fixture
def call(table):
    def call(route_key, body=None, id=None, user="user-1"):
        event = {
            "routeKey": route_key,
            "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user}}}},
        }
        if body is not None:
            event["body"] = json.dumps(body)
        if id is not None:
            event["pathParameters"] = {"id": id}
        res = index.handler(event, None)
        return res["statusCode"], json.loads(res["body"]) if "body" in res else None

    return call
