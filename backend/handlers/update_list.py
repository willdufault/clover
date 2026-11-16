import common


def handle(event, user_id):
    data = common.validate(common.LIST_FIELDS, common.parse_body(event), partial=True)
    item = common.get(user_id, "LIST", common.path_id(event))
    return common.update(item, data)
