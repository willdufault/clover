import json


def test_unknown_route(call):
    assert call("GET /nope") == (404, {"error": "route not found"})


def test_get_data_empty(call):
    assert call("GET /data") == (200, {"lists": [], "tasks": [], "steps": []})


def test_invalid_json(call, table):
    import index

    event = {
        "routeKey": "POST /lists",
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": "u"}}}},
        "body": "{nope",
    }
    res = index.handler(event, None)
    assert res["statusCode"] == 400
    assert json.loads(res["body"]) == {"error": "invalid JSON"}


def test_users_are_isolated(call):
    call("POST /lists", {"name": "Mine"}, user="a")
    assert call("GET /data", user="b")[1]["lists"] == []
    assert len(call("GET /data", user="a")[1]["lists"]) == 1
