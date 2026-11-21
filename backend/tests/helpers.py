from collections.abc import Callable

from hypothesis import strategies as st

from shared.api import ApiError

json_values = st.recursive(
    st.none() | st.booleans() | st.integers() | st.floats(allow_nan=False, allow_infinity=False) | st.text(),
    lambda children: st.lists(children) | st.dictionaries(st.text(), children),
    max_leaves=20,
)


def outcome(fn: Callable, *args: object, **kwargs: object) -> tuple:
    try:
        return True, fn(*args, **kwargs)
    except ApiError as e:
        error = e
    assert error.status == 400
    return False, None
