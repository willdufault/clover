import common


def handle(event, user_id):
    ids = common.parse_ids(event)
    steps = common.by_id(common.load_all(user_id), "STEP", ids).values()
    return common.delete(steps)
