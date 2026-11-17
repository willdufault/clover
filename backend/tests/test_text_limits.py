from common import LIST_NAME_MAX, TITLE_MAX


def test_text_limits(call):
    lst = call("POST /lists", {"name": "x" * LIST_NAME_MAX})[1]
    task = call("POST /tasks", {"title": "x" * TITLE_MAX})[1]
    step = call("POST /steps", {"title": "x" * TITLE_MAX, "taskId": task["id"]})[1]
    assert all("id" in item for item in (lst, task, step))

    assert call("PATCH /lists", [{"id": lst["id"], "name": "x" * (LIST_NAME_MAX + 1)}])[0] == 400
    assert call("PATCH /tasks", [{"id": task["id"], "title": "x" * (TITLE_MAX + 1)}])[0] == 400
    assert call("PATCH /steps", [{"id": step["id"], "title": "x" * (TITLE_MAX + 1)}])[0] == 400
