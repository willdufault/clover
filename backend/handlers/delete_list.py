import common


def handle(event, user_id):
    list_id = common.path_id(event)
    lst = common.get(user_id, "LIST", list_id)
    items = common.load_all(user_id)
    tasks = [i for i in items if common.kind_of(i) == "TASK" and i["listId"] == list_id]
    task_ids = {common.to_api(t)["id"] for t in tasks}
    steps = [i for i in items if common.kind_of(i) == "STEP" and i["taskId"] in task_ids]
    return common.delete([lst, *tasks, *steps])
