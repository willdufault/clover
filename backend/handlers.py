from shared import api, db, schema


def check_user_limit(items: list, kind: str) -> None:
    if sum(db.kind_of(i) == kind for i in items) >= schema.USER_LIMITS[kind]:
        raise api.ApiError(409, f"{kind.capitalize()} limit reached")


def check_parent(items: list, parent_kind: str, parent_id: str, child_field: str, limit: int) -> None:
    sk = f"{parent_kind}#{parent_id}"
    if not any(i["SK"] == sk for i in items):
        raise api.ApiError(404, f"{parent_kind.capitalize()} not found")
    if sum(i.get(child_field) == parent_id for i in items) >= limit:
        raise api.ApiError(409, f"{parent_kind.capitalize()} is full")


def get_data(event: dict, user_id: str) -> dict:
    data = {"lists": [], "tasks": [], "steps": []}
    names = {"LIST": "lists", "TASK": "tasks", "STEP": "steps"}
    for item in db.load_all(user_id):
        if item["SK"] == "META":
            continue
        data[names[db.kind_of(item)]].append(db.to_api(item))
    return api.response(200, data)


def create_list(event: dict, user_id: str) -> dict:
    data = schema.validate(schema.LIST_FIELDS, api.parse_body(event))
    items = db.load_all(user_id)
    check_user_limit(items, "LIST")
    return api.response(201, db.create(user_id, "LIST", data, items))


def update_list(event: dict, user_id: str) -> dict:
    patches = schema.parse_patches(event, schema.LIST_FIELDS)
    return api.response(200, db.update_many(user_id, "LIST", patches, db.load_all(user_id)))


def delete_list(event: dict, user_id: str) -> dict:
    ids = schema.parse_ids(event)
    items = db.load_all(user_id)
    lists = db.matching(items, "LIST", ids)
    tasks = db.children(items, "TASK", "listId", ids)
    task_ids = {db.id_of(t) for t in tasks}
    steps = db.children(items, "STEP", "taskId", task_ids)
    db.delete_parents(user_id, items, lists, tasks, steps)
    return api.response(204)


def create_task(event: dict, user_id: str) -> dict:
    data = schema.validate(schema.TASK_FIELDS, api.parse_body(event))
    items = db.load_all(user_id)
    check_user_limit(items, "TASK")
    if data["listId"] is not None:
        check_parent(items, "LIST", data["listId"], "listId", schema.TASKS_PER_LIST)
    return api.response(201, db.create(user_id, "TASK", data, items))


def update_task(event: dict, user_id: str) -> dict:
    patches = schema.parse_patches(event, schema.TASK_FIELDS)
    items = db.load_all(user_id)
    db.by_id(items, "TASK", [i for i, _ in patches])
    list_of = {db.id_of(i): i["listId"] for i in items if db.kind_of(i) == "TASK"}
    targets = set()
    for task_id, data in patches:
        list_id = data.get("listId", list_of[task_id])
        if list_id is not None and list_id != list_of[task_id]:
            targets.add(list_id)
        list_of[task_id] = list_id
    for list_id in targets:
        if not any(i["SK"] == f"LIST#{list_id}" for i in items):
            raise api.ApiError(404, "List not found")
        if list(list_of.values()).count(list_id) > schema.TASKS_PER_LIST:
            raise api.ApiError(409, "List is full")
    checks = [db.bump(user_id, items)] if targets else []
    return api.response(200, db.update_many(user_id, "TASK", patches, items, checks))


def delete_task(event: dict, user_id: str) -> dict:
    ids = schema.parse_ids(event)
    items = db.load_all(user_id)
    tasks = db.matching(items, "TASK", ids)
    steps = db.children(items, "STEP", "taskId", ids)
    db.delete_parents(user_id, items, tasks, steps)
    return api.response(204)


def create_step(event: dict, user_id: str) -> dict:
    data = schema.validate(schema.STEP_FIELDS, api.parse_body(event))
    items = db.load_all(user_id)
    check_user_limit(items, "STEP")
    check_parent(items, "TASK", data["taskId"], "taskId", schema.STEPS_PER_TASK)
    return api.response(201, db.create(user_id, "STEP", data, items))


def update_step(event: dict, user_id: str) -> dict:
    patches = schema.parse_patches(event, schema.STEP_EDITABLE)
    return api.response(200, db.update_many(user_id, "STEP", patches, db.load_all(user_id)))


def delete_step(event: dict, user_id: str) -> dict:
    ids = schema.parse_ids(event)
    items = db.load_all(user_id)
    db.delete(db.matching(items, "STEP", ids) + db.orphan_steps(items))
    return api.response(204)
