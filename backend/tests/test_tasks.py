from shared.schema import MAX_BATCH, TASKS_PER_LIST, TITLE_MAX, USER_LIMITS


def test_create_defaults(call):
    status, task = call("POST /tasks", {"title": "T"})
    assert status == 201
    assert task == {
        "id": task["id"],
        "title": "T",
        "stage": "open",
        "due": None,
        "priority": "medium",
        "addedToToday": False,
        "listId": None,
    }


def test_create_all_fields(call):
    lst = call("POST /lists", {"name": "A"})[1]
    body = {
        "title": "T",
        "stage": "waiting",
        "due": "2026-12-01",
        "priority": "high",
        "addedToToday": True,
        "listId": lst["id"],
    }
    status, task = call("POST /tasks", body)
    assert status == 201
    assert task == {"id": task["id"], **body}


def test_create_validation(call):
    assert call("POST /tasks", {})[0] == 400
    assert call("POST /tasks", {"title": "x" * (TITLE_MAX + 1)})[0] == 400
    assert call("POST /tasks", {"title": "T", "stage": "nope"})[0] == 400
    assert call("POST /tasks", {"title": "T", "priority": "urgent"})[0] == 400
    assert call("POST /tasks", {"title": "T", "due": "tomorrow"})[0] == 400
    assert call("POST /tasks", {"title": "T", "due": "20240101"})[0] == 400
    assert call("POST /tasks", {"title": "T", "due": "2024-W01-1"})[0] == 400
    assert call("POST /tasks", {"title": "T", "addedToToday": "yes"})[0] == 400
    assert call("POST /tasks", {"title": "T", "listId": "missing"})[0] == 404
    assert call("POST /tasks", {"title": "x" * TITLE_MAX})[0] == 201


def test_list_limit(call):
    lst = call("POST /lists", {"name": "A"})[1]
    for i in range(TASKS_PER_LIST):
        assert call("POST /tasks", {"title": f"T{i}", "listId": lst["id"]})[0] == 201
    assert call("POST /tasks", {"title": "x", "listId": lst["id"]})[0] == 409
    assert call("POST /tasks", {"title": "unassigned"})[0] == 201


def test_user_limit(call):
    for i in range(USER_LIMITS["TASK"]):
        assert call("POST /tasks", {"title": f"T{i}"})[0] == 201
    assert call("POST /tasks", {"title": "x"})[0] == 409


def test_update(call):
    task = call("POST /tasks", {"title": "T"})[1]
    other = call("POST /tasks", {"title": "O"})[1]
    body = [
        {"id": task["id"], "stage": "done", "due": "2026-01-02"},
        {"id": other["id"], "priority": "high"},
    ]
    status, updated = call("PATCH /tasks", body)
    assert status == 200
    assert updated == [
        {**task, "stage": "done", "due": "2026-01-02"},
        {**other, "priority": "high"},
    ]
    assert call("PATCH /tasks", [{"id": task["id"], "stage": "x"}])[0] == 400
    assert call("PATCH /tasks", [{"id": "missing", "title": "T"}])[0] == 404
    assert call("PATCH /tasks", [{"id": task["id"], "title": "x" * (TITLE_MAX + 1)}])[0] == 400


def test_update_move_checks_list(call):
    full = call("POST /lists", {"name": "Full"})[1]
    for i in range(TASKS_PER_LIST):
        call("POST /tasks", {"title": f"T{i}", "listId": full["id"]})
    task = call("POST /tasks", {"title": "T"})[1]
    assert call("PATCH /tasks", [{"id": task["id"], "listId": "missing"}]) == (
        404,
        {"error": "List not found"},
    )
    assert call("PATCH /tasks", [{"id": task["id"], "listId": full["id"]}]) == (
        409,
        {"error": "List is full"},
    )
    other = call("POST /lists", {"name": "Other"})[1]
    status, moved = call("PATCH /tasks", [{"id": task["id"], "listId": other["id"]}])
    assert (status, moved[0]["listId"]) == (200, other["id"])
    status, moved = call("PATCH /tasks", [{"id": task["id"], "listId": None}])
    assert (status, moved[0]["listId"]) == (200, None)


def test_update_batch_move_overflow(call):
    target = call("POST /lists", {"name": "Target"})[1]
    for i in range(TASKS_PER_LIST - 1):
        call("POST /tasks", {"title": f"T{i}", "listId": target["id"]})
    a = call("POST /tasks", {"title": "A"})[1]
    b = call("POST /tasks", {"title": "B"})[1]
    body = [{"id": a["id"], "listId": target["id"]}, {"id": b["id"], "listId": target["id"]}]
    assert call("PATCH /tasks", body)[0] == 409
    tasks = {t["id"]: t for t in call("GET /data")[1]["tasks"]}
    assert tasks[a["id"]] == a
    assert tasks[b["id"]] == b
    # Swapping one task out makes room for both.
    inside = next(t for t in tasks.values() if t["listId"] == target["id"])
    status, _ = call("PATCH /tasks", [{"id": inside["id"], "listId": None}, *body])
    assert status == 200


def test_update_within_full_list_is_allowed(call):
    full = call("POST /lists", {"name": "Full"})[1]
    tasks = [call("POST /tasks", {"title": f"T{i}", "listId": full["id"]})[1] for i in range(TASKS_PER_LIST)]
    body = [{"id": tasks[0]["id"], "listId": full["id"], "stage": "done"}]
    assert call("PATCH /tasks", body)[0] == 200


def test_delete_cascades(call):
    a = call("POST /tasks", {"title": "A"})[1]
    b = call("POST /tasks", {"title": "B"})[1]
    call("POST /steps", {"title": "S", "taskId": a["id"]})
    call("POST /steps", {"title": "S", "taskId": b["id"]})
    other = call("POST /tasks", {"title": "Other"})[1]
    step = call("POST /steps", {"title": "S2", "taskId": other["id"]})[1]
    assert call("DELETE /tasks", {"ids": [a["id"], b["id"]]}) == (204, None)
    assert call("GET /data")[1] == {"lists": [], "tasks": [other], "steps": [step]}
    assert call("DELETE /tasks", {"ids": [a["id"]]})[0] == 204


def test_delete_skips_missing_ids(call):
    a = call("POST /tasks", {"title": "A"})[1]
    call("POST /steps", {"title": "S", "taskId": a["id"]})
    assert call("DELETE /tasks", {"ids": [a["id"], "missing"]})[0] == 204
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_update_only_writes_given_fields(call, mock_table):
    task = call("POST /tasks", {"title": "T"})[1]
    # Simulate a concurrent write the caller hasn't seen.
    mock_table.update_item(
        Key={"PK": "user-1", "SK": f"TASK#{task['id']}"},
        UpdateExpression="SET stage = :s",
        ExpressionAttributeValues={":s": "waiting"},
    )
    status, updated = call("PATCH /tasks", [{"id": task["id"], "due": "2030-01-02"}])
    assert status == 200
    assert updated[0]["stage"] == "waiting"
    assert updated[0]["due"] == "2030-01-02"


def test_update_returns_written_values_not_later_writes(call, mock_table):
    task = call("POST /tasks", {"title": "T"})[1]
    real = mock_table.meta.client.transact_write_items

    def concurrent(TransactItems):
        mock_table.update_item(
            Key={"PK": "user-1", "SK": f"TASK#{task['id']}"},
            UpdateExpression="SET stage = :s",
            ExpressionAttributeValues={":s": "waiting"},
        )
        return real(TransactItems=TransactItems)

    mock_table.meta.client.transact_write_items = concurrent
    status, updated = call("PATCH /tasks", [{"id": task["id"], "due": "2030-01-02"}])
    assert (status, updated) == (200, [{**task, "due": "2030-01-02"}])
    assert call("GET /data")[1]["tasks"][0]["stage"] == "waiting"


def test_update_task_deleted_after_read_is_404(call, mock_table, race):
    a = call("POST /tasks", {"title": "A"})[1]
    b = call("POST /tasks", {"title": "B"})[1]
    race(lambda: call("DELETE /tasks", {"ids": [b["id"]]}))
    before = mock_table.scan()["Items"]
    body = [{"id": a["id"], "title": "A2"}, {"id": b["id"], "title": "B2"}]
    assert call("PATCH /tasks", body) == (404, {"error": "Task not found"})
    assert mock_table.scan()["Items"] == before


def test_create_in_list_deleted_after_read_is_404(call, race):
    lst = call("POST /lists", {"name": "L"})[1]
    race(lambda: call("DELETE /lists", {"ids": [lst["id"]]}))
    assert call("POST /tasks", {"title": "T", "listId": lst["id"]}) == (
        404,
        {"error": "List not found"},
    )
    assert call("GET /data")[1] == {"lists": [], "tasks": [], "steps": []}


def test_move_to_list_deleted_after_read_is_404(call, race):
    lst = call("POST /lists", {"name": "L"})[1]
    task = call("POST /tasks", {"title": "T"})[1]
    race(lambda: call("DELETE /lists", {"ids": [lst["id"]]}))
    assert call("PATCH /tasks", [{"id": task["id"], "listId": lst["id"]}]) == (
        404,
        {"error": "List not found"},
    )
    assert call("GET /data")[1] == {"lists": [], "tasks": [task], "steps": []}


def test_create_over_list_limit_after_stale_read_is_409(call, race):
    lst = call("POST /lists", {"name": "L"})[1]
    for i in range(TASKS_PER_LIST - 1):
        call("POST /tasks", {"title": f"T{i}", "listId": lst["id"]})
    race(lambda: call("POST /tasks", {"title": "concurrent", "listId": lst["id"]}))
    assert call("POST /tasks", {"title": "too many", "listId": lst["id"]})[0] == 409
    tasks = call("GET /data")[1]["tasks"]
    assert len([t for t in tasks if t["listId"] == lst["id"]]) == TASKS_PER_LIST


def test_delete_with_step_added_after_read_removes_step(call, mock_table, race):
    task = call("POST /tasks", {"title": "T"})[1]
    race(lambda: call("POST /steps", {"title": "S", "taskId": task["id"]}))
    assert call("DELETE /tasks", {"ids": [task["id"]]}) == (204, None)
    assert [i["SK"] for i in mock_table.scan()["Items"] if i["SK"].startswith(("TASK#", "STEP#"))] == []


def test_update_clears_due(call, mock_table):
    task = call("POST /tasks", {"title": "T", "due": "2026-12-01"})[1]
    assert call("PATCH /tasks", [{"id": task["id"], "due": None}]) == (200, [{**task, "due": None}])
    assert mock_table.get_item(Key={"PK": "user-1", "SK": f"TASK#{task['id']}"})["Item"]["due"] is None


def test_max_batch_fits_transaction(call):
    lists = [call("POST /lists", {"name": f"L{i}"})[1] for i in range(MAX_BATCH // TASKS_PER_LIST + 1)]
    tasks = [call("POST /tasks", {"title": f"T{i}"})[1] for i in range(MAX_BATCH)]
    body = [{"id": t["id"], "listId": lists[i // TASKS_PER_LIST]["id"]} for i, t in enumerate(tasks)]
    assert call("PATCH /tasks", body)[0] == 200
    assert call("DELETE /tasks", {"ids": [t["id"] for t in tasks]}) == (204, None)
    assert call("GET /data")[1]["tasks"] == []
