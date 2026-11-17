import common


def handle(event, user_id):
    patches = common.parse_patches(event, common.TASK_FIELDS)
    items = common.load_all(user_id)
    common.by_id(items, "TASK", [i for i, _ in patches])
    list_of = {common.id_of(i): i["listId"] for i in items if common.kind_of(i) == "TASK"}
    targets = set()
    for task_id, data in patches:
        list_id = data.get("listId", list_of[task_id])
        if list_id is not None and list_id != list_of[task_id]:
            targets.add(list_id)
        list_of[task_id] = list_id
    for list_id in targets:
        if not any(i["SK"] == f"LIST#{list_id}" for i in items):
            raise common.ApiError(404, "List not found.")
        if list(list_of.values()).count(list_id) > common.TASKS_PER_LIST:
            raise common.ApiError(409, "List is full.")
    checks = [common.parent_check(user_id, "LIST", list_id) for list_id in targets]
    return common.update_many(user_id, "TASK", patches, items, checks)
