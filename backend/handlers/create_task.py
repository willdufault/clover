import common


def handle(event, user_id):
    data = common.validate(common.TASK_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "TASK")
    parent = None
    if data["listId"] is not None:
        common.check_parent(items, "LIST", data["listId"], "listId", common.TASKS_PER_LIST)
        parent = ("LIST", data["listId"])
    return common.create(user_id, "TASK", data, parent)
