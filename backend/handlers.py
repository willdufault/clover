import common


def get_data(event, user_id):
    data = {"lists": [], "tasks": [], "steps": []}
    names = {"LIST": "lists", "TASK": "tasks", "STEP": "steps"}
    for item in common.load_all(user_id):
        data[names[common.kind_of(item)]].append(common.to_api(item))
    return common.response(200, data)


def create_list(event, user_id):
    data = common.validate(common.LIST_FIELDS, common.parse_body(event))
    common.check_user_limit(common.load_all(user_id), "LIST")
    return common.create(user_id, "LIST", data)


def update_list(event, user_id):
    patches = common.parse_patches(event, common.LIST_FIELDS)
    return common.update_many(user_id, "LIST", patches, common.load_all(user_id))


def delete_list(event, user_id):
    ids = common.parse_ids(event)
    items = common.load_all(user_id)
    lists = common.by_id(items, "LIST", ids).values()
    tasks = [i for i in items if common.kind_of(i) == "TASK" and i["listId"] in ids]
    task_ids = {common.id_of(t) for t in tasks}
    steps = [i for i in items if common.kind_of(i) == "STEP" and i["taskId"] in task_ids]
    return common.delete(steps, tasks, lists)


def create_task(event, user_id):
    data = common.validate(common.TASK_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "TASK")
    parent = None
    if data["listId"] is not None:
        common.check_parent(items, "LIST", data["listId"], "listId", common.TASKS_PER_LIST)
        parent = ("LIST", data["listId"])
    return common.create(user_id, "TASK", data, parent)


def update_task(event, user_id):
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


def delete_task(event, user_id):
    ids = common.parse_ids(event)
    items = common.load_all(user_id)
    tasks = common.by_id(items, "TASK", ids).values()
    steps = [i for i in items if common.kind_of(i) == "STEP" and i["taskId"] in ids]
    return common.delete(steps, tasks)


def create_step(event, user_id):
    data = common.validate(common.STEP_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "STEP")
    common.check_parent(items, "TASK", data["taskId"], "taskId", common.STEPS_PER_TASK)
    return common.create(user_id, "STEP", data, ("TASK", data["taskId"]))


def update_step(event, user_id):
    patches = common.parse_patches(event, common.STEP_EDITABLE)
    return common.update_many(user_id, "STEP", patches, common.load_all(user_id))


def delete_step(event, user_id):
    ids = common.parse_ids(event)
    steps = common.by_id(common.load_all(user_id), "STEP", ids).values()
    return common.delete(steps)
