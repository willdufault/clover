import common


def handle(event, user_id):
    patches = common.parse_patches(event, common.STEP_EDITABLE)
    return common.update_many(user_id, "STEP", patches, common.load_all(user_id))
