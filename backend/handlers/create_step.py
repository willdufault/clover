import common


def handle(event, user_id):
    data = common.validate(common.STEP_FIELDS, common.parse_body(event))
    items = common.load_all(user_id)
    common.check_user_limit(items, "STEP")
    common.check_parent(items, "TASK", data["taskId"], "taskId", common.STEPS_PER_TASK)
    return common.create(user_id, "STEP", data, ("TASK", data["taskId"]))
