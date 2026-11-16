import common


def handle(event, user_id):
    data = common.validate(common.TASK_FIELDS, common.parse_body(event), partial=True)
    item = common.get(user_id, "TASK", common.path_id(event))
    list_id = data.get("listId")
    if list_id is not None and list_id != item["listId"]:
        items = common.load_all(user_id)
        common.check_parent(items, "LIST", list_id, "listId", common.TASKS_PER_LIST)
    return common.update(item, data)
