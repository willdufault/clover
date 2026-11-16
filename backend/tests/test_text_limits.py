def test_text_limits(call):
    lst = call("POST /lists", {"name": "x" * 50})[1]
    task = call("POST /tasks", {"title": "x" * 100})[1]
    step = call("POST /steps", {"title": "x" * 100, "taskId": task["id"]})[1]
    assert all("id" in item for item in (lst, task, step))

    assert call("PATCH /lists", [{"id": lst["id"], "name": "x" * 51}])[0] == 400
    assert call("PATCH /tasks", [{"id": task["id"], "title": "x" * 101}])[0] == 400
    assert call("PATCH /steps", [{"id": step["id"], "title": "x" * 101}])[0] == 400
