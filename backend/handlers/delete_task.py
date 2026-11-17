import common


def handle(event, user_id):
    ids = common.parse_ids(event)
    items = common.load_all(user_id)
    tasks = common.by_id(items, "TASK", ids).values()
    steps = [i for i in items if common.kind_of(i) == "STEP" and i["taskId"] in ids]
    return common.delete(steps, tasks)
