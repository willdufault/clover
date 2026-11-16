import common


def handle(event, user_id):
    step = common.get(user_id, "STEP", common.path_id(event))
    return common.delete([step])
