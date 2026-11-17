import json
import os
from types import SimpleNamespace

import pytest
from botocore.exceptions import ClientError

os.environ.setdefault("TABLE_NAME", "test")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

import common  # noqa: E402
import index  # noqa: E402


class FakeTable:
    name = "test"

    def __init__(self):
        self.items = {}
        self.meta = SimpleNamespace(client=self)

    def put_item(self, Item):
        self.items[(Item["PK"], Item["SK"])] = dict(Item)

    def transact_write_items(self, TransactItems):
        if len(TransactItems) > 100:
            raise ClientError({"Error": {"Code": "ValidationException"}}, "TransactWriteItems")
        # Put is unconditional; ConditionCheck and Update require the item to exist.
        def ok(t):
            if "Put" in t:
                return True
            k = (t.get("ConditionCheck") or t["Update"])["Key"]
            return (k["PK"], k["SK"]) in self.items

        if not all(ok(t) for t in TransactItems):
            reasons = [{"Code": "None" if ok(t) else "ConditionalCheckFailed"} for t in TransactItems]
            error = {"Error": {"Code": "TransactionCanceledException"}, "CancellationReasons": reasons}
            raise ClientError(error, "TransactWriteItems")
        for t in TransactItems:
            if "Put" in t:
                self.put_item(t["Put"]["Item"])
            elif "Update" in t:
                u = t["Update"]
                item = self.items[(u["Key"]["PK"], u["Key"]["SK"])]
                for name, field in u["ExpressionAttributeNames"].items():
                    item[field] = u["ExpressionAttributeValues"][":" + name[1:]]

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
    def call(route_key, body=None, user="user-1"):
        event = {
            "routeKey": route_key,
            "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user}}}},
        }
        if body is not None:
            event["body"] = json.dumps(body)
        res = index.handler(event, None)
        return res["statusCode"], json.loads(res["body"]) if "body" in res else None

    return call
