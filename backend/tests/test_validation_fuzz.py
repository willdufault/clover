import json
from datetime import date

import pytest
from hypothesis import given
from hypothesis import strategies as st

import common
from common import ApiError

json_values = st.recursive(
    st.none() | st.booleans() | st.integers() | st.floats(allow_nan=False, allow_infinity=False) | st.text(),
    lambda children: st.lists(children) | st.dictionaries(st.text(), children),
    max_leaves=20,
)
field_sets = st.sampled_from([common.LIST_FIELDS, common.TASK_FIELDS, common.STEP_FIELDS, common.STEP_EDITABLE])


def outcome(fn, *args, **kwargs):
    try:
        return True, fn(*args, **kwargs)
    except ApiError as e:
        error = e
    assert error.status == 400
    return False, None


@given(st.text() | st.none(), st.booleans())
def test_parse_json_only_fails_with_400(body, is_base64):
    outcome(common.parse_json, {"body": body, "isBase64Encoded": is_base64})


@given(json_values)
def test_parse_body_returns_dict_or_400(value):
    ok, body = outcome(common.parse_body, {"body": json.dumps(value)})
    assert not ok or isinstance(body, dict)


@given(json_values)
def test_check_ids_accepts_only_unique_string_batches(ids):
    ok, _ = outcome(common.check_ids, ids)
    if not ok:
        return
    assert isinstance(ids, list)
    assert 1 <= len(ids) <= common.MAX_BATCH
    assert all(isinstance(i, str) for i in ids)
    assert len(set(ids)) == len(ids)


@given(field_sets, json_values)
def test_parse_patches_returns_valid_patches_or_400(fields, value):
    ok, patches = outcome(common.parse_patches, {"body": json.dumps(value)}, fields)
    if not ok:
        return
    for item_id, data in patches:
        assert isinstance(item_id, str)
        assert set(data) <= set(fields)


@given(field_sets, st.dictionaries(st.text(), json_values), st.booleans())
def test_validate_returns_valid_data_or_400(fields, body, partial):
    ok, data = outcome(common.validate, fields, body, partial=partial)
    if not ok:
        return
    assert set(data) <= set(fields)
    if not partial:
        assert set(data) == set(fields)
    for name, value in data.items():
        if name in body:
            assert fields[name][0](value)


@given(st.sampled_from(["name", "title"]), st.text())
def test_text_fields_respect_limits(name, value):
    fields = common.LIST_FIELDS if name == "name" else common.TASK_FIELDS
    ok, _ = outcome(common.validate, fields, {name: value}, partial=True)
    if ok:
        assert value.strip() != ""
        assert len(value) <= (common.LIST_NAME_MAX if name == "name" else common.TITLE_MAX)


@given(json_values)
def test_optional_date_accepts_only_iso_dates(value):
    if common.optional_date(value) and value is not None:
        assert isinstance(value, str)
        assert len(value) == 10
        assert date.fromisoformat(value).isoformat() == value


@given(st.dates())
def test_optional_date_accepts_every_date(value):
    assert common.optional_date(value.isoformat())


@pytest.mark.parametrize("value", ["20240101", "2024-1-1", "2024-02-30"])
def test_optional_date_rejects_non_iso(value):
    assert not common.optional_date(value)
