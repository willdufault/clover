import base64
import json


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        self.status = status
        self.message = message


class Stale(ApiError):
    def __init__(self) -> None:
        super().__init__(409, "Concurrent update")


def response(status: int, body: object = None) -> dict:
    if body is None:
        return {"statusCode": status}
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def parse_json(event: dict) -> object:
    raw = event.get("body") or "{}"
    try:
        if event.get("isBase64Encoded"):
            raw = base64.b64decode(raw)
        return json.loads(raw)
    except ValueError as e:
        raise ApiError(400, "Invalid JSON") from e


def parse_body(event: dict) -> dict:
    body = parse_json(event)
    if not isinstance(body, dict):
        raise ApiError(400, "Body must be an object")
    return body
