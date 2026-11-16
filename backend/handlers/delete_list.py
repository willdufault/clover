import common


def handle(event, user_id):
    ids = common.parse_ids(event)
    items = common.load_all(user_id)
    lists = common.by_id(items, "LIST", ids).values()
    tasks = [i for i in items if common.kind_of(i) == "TASK" and i["listId"] in ids]
    task_ids = {common.to_api(t)["id"] for t in tasks}
    steps = [i for i in items if common.kind_of(i) == "STEP" and i["taskId"] in task_ids]
    return common.delete([*lists, *tasks, *steps])
