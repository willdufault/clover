import json
from datetime import date

import pytest
from hypothesis import given
from hypothesis import strategies as st

from shared import schema
from tests.helpers import json_values, outcome

field_sets = st.sampled_from([schema.LIST_FIELDS, schema.TASK_FIELDS, schema.STEP_FIELDS, schema.STEP_EDITABLE])
field_names = sorted({*schema.LIST_FIELDS, *schema.TASK_FIELDS, *schema.STEP_FIELDS})
STAGES = ["open", "inProgress", "waiting", "done", "cancelled"]
PRIORITIES = ["low", "medium", "high"]
field_values = st.one_of(
    st.text(),
    st.booleans(),
    st.none(),
    st.dates().map(date.isoformat),
    st.sampled_from(STAGES + PRIORITIES),
    json_values,
)
id_lists = st.lists(st.uuids().map(str), min_size=1, max_size=schema.MAX_BATCH + 1)
patches = st.lists(
    st.builds(
        lambda i, d: {**d, "id": i}, st.uuids().map(str), st.dictionaries(st.sampled_from(field_names), field_values)
    ),
    min_size=1,
    max_size=5,
)
checks = {
    "name": lambda v: isinstance(v, str) and v.strip() != "" and len(v) <= schema.LIST_NAME_MAX,
    "title": lambda v: isinstance(v, str) and v.strip() != "" and len(v) <= schema.TITLE_MAX,
    "stage": lambda v: v in STAGES,
    "priority": lambda v: v in PRIORITIES,
    "due": lambda v: v is None or date.fromisoformat(v).isoformat() == v,
    "addedToToday": lambda v: isinstance(v, bool),
    "completed": lambda v: isinstance(v, bool),
    "listId": lambda v: v is None or isinstance(v, str),
    "taskId": lambda v: isinstance(v, str),
}


@given(st.one_of(json_values, id_lists))
def test_check_ids_accepts_only_unique_string_batches(ids: object) -> None:
    ok, _ = outcome(schema.check_ids, ids)
    if not ok:
        return
    assert isinstance(ids, list)
    assert 1 <= len(ids) <= schema.MAX_BATCH
    assert all(isinstance(i, str) for i in ids)
    assert len(set(ids)) == len(ids)


@given(field_sets, st.one_of(json_values, patches))
def test_parse_patches_returns_valid_patches_or_400(fields: dict, value: object) -> None:
    ok, result = outcome(schema.parse_patches, {"body": json.dumps(value)}, fields)
    if not ok:
        return
    assert isinstance(value, list)
    assert result == [(p["id"], {k: v for k, v in p.items() if k != "id"}) for p in value]
    for _, data in result:
        assert set(data) <= set(fields)
        assert all(checks[k](v) for k, v in data.items())


@given(
    field_sets.flatmap(
        lambda f: st.tuples(st.just(f), st.dictionaries(st.sampled_from(sorted(f)) | st.text(), field_values))
    ),
    st.booleans(),
)
def test_validate_returns_valid_data_or_400(case: tuple, partial: bool) -> None:
    fields, body = case
    ok, data = outcome(schema.validate, fields, body, partial=partial)
    if not ok:
        return
    assert set(body) <= set(data) <= set(fields)
    if not partial:
        assert set(data) == set(fields)
    for name, value in body.items():
        assert data[name] == value
        assert checks[name](value)


@given(st.sampled_from(["name", "title"]), st.text())
def test_text_fields_respect_limits(name: str, value: str) -> None:
    fields = schema.LIST_FIELDS if name == "name" else schema.TASK_FIELDS
    ok, _ = outcome(schema.validate, fields, {name: value}, partial=True)
    if ok:
        assert value.strip() != ""
        assert len(value) <= (schema.LIST_NAME_MAX if name == "name" else schema.TITLE_MAX)


@given(field_values)
def test_optional_date_accepts_only_iso_dates(value: object) -> None:
    if schema.optional_date(value) and value is not None:
        assert isinstance(value, str)
        assert len(value) == 10
        assert date.fromisoformat(value).isoformat() == value


@given(st.dates())
def test_optional_date_accepts_every_date(value: date) -> None:
    assert schema.optional_date(value.isoformat())


@pytest.mark.parametrize("value", ["20240101", "2024-1-1", "2024-02-30"])
def test_optional_date_rejects_non_iso(value: str) -> None:
    assert not schema.optional_date(value)
