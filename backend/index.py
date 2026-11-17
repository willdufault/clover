import traceback

import common
from handlers import (
    create_list,
    create_step,
    create_task,
    delete_list,
    delete_step,
    delete_task,
    get_data,
    update_list,
    update_step,
    update_task,
)

ROUTES = {
    "GET /data": get_data.handle,
    "POST /lists": create_list.handle,
    "PATCH /lists": update_list.handle,
    "DELETE /lists": delete_list.handle,
    "POST /tasks": create_task.handle,
    "PATCH /tasks": update_task.handle,
    "DELETE /tasks": delete_task.handle,
    "POST /steps": create_step.handle,
    "PATCH /steps": update_step.handle,
    "DELETE /steps": delete_step.handle,
}


def handler(event, context):
    route = ROUTES.get(event["routeKey"])
    if route is None:
        return common.response(404, {"error": "Route not found."})
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    try:
        return route(event, user_id)
    except common.ApiError as e:
        return common.response(e.status, {"error": e.message})
    except Exception:
        traceback.print_exc()
        return common.response(500, {"error": "Internal server error."})
