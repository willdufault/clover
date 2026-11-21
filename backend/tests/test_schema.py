import json
from datetime import date

import pytest
from hypothesis import given
from hypothesis import strategies as st

from shared import schema
from tests.helpers import json_values, outcome

field_sets = st.sampled_from([schema.LIST_FIELDS, schema.TASK_FIELDS, schema.STEP_FIELDS, schema.STEP_EDITABLE])


@given(json_values)
def test_check_ids_accepts_only_unique_string_batches(ids):
    ok, _ = outcome(schema.check_ids, ids)
    if not ok:
        return
    assert isinstance(ids, list)
    assert 1 <= len(ids) <= schema.MAX_BATCH
    assert all(isinstance(i, str) for i in ids)
    assert len(set(ids)) == len(ids)


@given(field_sets, json_values)
def test_parse_patches_returns_valid_patches_or_400(fields, value):
    ok, patches = outcome(schema.parse_patches, {"body": json.dumps(value)}, fields)
    if not ok:
        return
    for item_id, data in patches:
        assert isinstance(item_id, str)
        assert set(data) <= set(fields)


@given(field_sets, st.dictionaries(st.text(), json_values), st.booleans())
def test_validate_returns_valid_data_or_400(fields, body, partial):
    ok, data = outcome(schema.validate, fields, body, partial=partial)
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
    fields = schema.LIST_FIELDS if name == "name" else schema.TASK_FIELDS
    ok, _ = outcome(schema.validate, fields, {name: value}, partial=True)
    if ok:
        assert value.strip() != ""
        assert len(value) <= (schema.LIST_NAME_MAX if name == "name" else schema.TITLE_MAX)


@given(json_values)
def test_optional_date_accepts_only_iso_dates(value):
    if schema.optional_date(value) and value is not None:
        assert isinstance(value, str)
        assert len(value) == 10
        assert date.fromisoformat(value).isoformat() == value


@given(st.dates())
def test_optional_date_accepts_every_date(value):
    assert schema.optional_date(value.isoformat())


@pytest.mark.parametrize("value", ["20240101", "2024-1-1", "2024-02-30"])
def test_optional_date_rejects_non_iso(value):
    assert not schema.optional_date(value)
