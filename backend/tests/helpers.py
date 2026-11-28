from collections.abc import Callable
from decimal import Decimal

from hypothesis import strategies as st
from mypy_boto3_dynamodb.service_resource import Table

from api import ApiError

json_values = st.recursive(
    st.none() | st.booleans() | st.integers() | st.floats(allow_nan=False, allow_infinity=False) | st.text(),
    lambda children: st.lists(children) | st.dictionaries(st.text(), children),
    max_leaves=20,
)


def outcome(fn: Callable, *args: object, **kwargs: object) -> tuple:
    try:
        return True, fn(*args, **kwargs)
    except ApiError as e:
        if e.status != 400:
            raise
        return False, None


def meta_version(table: Table) -> int:
    version = table.get_item(Key={"PK": "user-1", "SK": "META"})["Item"]["version"]
    assert isinstance(version, Decimal)
    return int(version)


def fill(call: Callable, list_id: str, n: int) -> None:
    for i in range(n):
        call("POST /tasks", {"title": f"T{i}", "listId": list_id, "order": 0})
