import common


def get_data(event, user_id):
    data = {"lists": [], "tasks": [], "steps": []}
    names = {"LIST": "lists", "TASK": "tasks", "STEP": "steps"}
    for item in common.load_all(user_id):
        if item["SK"] == "META":
            continue
        data[names[common.kind_of(item)]].append(common.to_api(item))
    return common.response(200, data)


def create_list(event, user_id):
    data = common.validate(common.LIST_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "LIST")
    return common.create(user_id, "LIST", data, items)


def update_list(event, user_id):
    patches = common.parse_patches(event, common.LIST_FIELDS)
    return common.update_many(user_id, "LIST", patches, common.load_all(user_id))


def delete_list(event, user_id):
    ids = common.parse_ids(event)
    items = common.load_all(user_id)
    lists = common.matching(items, "LIST", ids)
    tasks = common.children(items, "TASK", "listId", ids)
    task_ids = {common.id_of(t) for t in tasks}
    steps = common.children(items, "STEP", "taskId", task_ids)
    return common.delete_parents(user_id, items, lists, steps, tasks)


def create_task(event, user_id):
    data = common.validate(common.TASK_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "TASK")
    if data["listId"] is not None:
        common.check_parent(items, "LIST", data["listId"], "listId", common.TASKS_PER_LIST)
    return common.create(user_id, "TASK", data, items)


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
    checks = [common.bump(user_id, items)] if targets else []
    return common.update_many(user_id, "TASK", patches, items, checks)


def delete_task(event, user_id):
    ids = common.parse_ids(event)
    items = common.load_all(user_id)
    tasks = common.matching(items, "TASK", ids)
    steps = common.children(items, "STEP", "taskId", ids)
    return common.delete_parents(user_id, items, tasks, steps)


def create_step(event, user_id):
    data = common.validate(common.STEP_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "STEP")
    common.check_parent(items, "TASK", data["taskId"], "taskId", common.STEPS_PER_TASK)
    return common.create(user_id, "STEP", data, items)


def update_step(event, user_id):
    patches = common.parse_patches(event, common.STEP_EDITABLE)
    return common.update_many(user_id, "STEP", patches, common.load_all(user_id))


def delete_step(event, user_id):
    ids = common.parse_ids(event)
    steps = common.matching(common.load_all(user_id), "STEP", ids)
    common.delete(steps)
    return common.response(204)
