import common


def handle(event, user_id):
    task_id = common.path_id(event)
    task = common.get(user_id, "TASK", task_id)
    items = common.load_all(user_id)
    steps = [i for i in items if common.kind_of(i) == "STEP" and i["taskId"] == task_id]
    return common.delete([task, *steps])
