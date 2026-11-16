import common


def handle(event, user_id):
    patches = common.parse_patches(event, common.LIST_FIELDS)
    return common.update_many(user_id, "LIST", patches, common.load_all(user_id))
