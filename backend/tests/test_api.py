import base64
import json

from hypothesis import given
from hypothesis import strategies as st

import api
from tests.helpers import json_values, outcome


@given(st.text() | st.none(), st.booleans())
def test_parse_json_only_fails_with_400(body: str | None, is_base64: bool) -> None:
    outcome(api.parse_json, {"body": body, "isBase64Encoded": is_base64})


def test_parse_json_decodes_base64() -> None:
    body = base64.b64encode(b'{"a": 1}').decode()
    assert api.parse_json({"body": body, "isBase64Encoded": True}) == {"a": 1}


@given(json_values)
def test_parse_body_returns_dict_or_400(value: object) -> None:
    ok, body = outcome(api.parse_body, {"body": json.dumps(value)})
    assert not ok or isinstance(body, dict)
