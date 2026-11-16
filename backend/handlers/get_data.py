import common


def handle(event, user_id):
    data = {"lists": [], "tasks": [], "steps": []}
    names = {"LIST": "lists", "TASK": "tasks", "STEP": "steps"}
    for item in common.load_all(user_id):
        data[names[common.kind_of(item)]].append(common.to_api(item))
    return common.response(200, data)
