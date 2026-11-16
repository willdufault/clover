import common


def handle(event, user_id):
    data = common.validate(common.STEP_EDITABLE, common.parse_body(event), partial=True)
    item = common.get(user_id, "STEP", common.path_id(event))
    return common.update(item, data)
