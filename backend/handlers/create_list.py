import common


def handle(event, user_id):
    data = common.validate(common.LIST_FIELDS, common.parse_body(event))
    common.check_user_limit(common.load_all(user_id), "LIST")
    return common.create(user_id, "LIST", data)
