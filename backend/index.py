import traceback

import common
import handlers

STALE_RETRIES = 2

ROUTES = {
    "GET /data": handlers.get_data,
    "POST /lists": handlers.create_list,
    "PATCH /lists": handlers.update_list,
    "DELETE /lists": handlers.delete_list,
    "POST /tasks": handlers.create_task,
    "PATCH /tasks": handlers.update_task,
    "DELETE /tasks": handlers.delete_task,
    "POST /steps": handlers.create_step,
    "PATCH /steps": handlers.update_step,
    "DELETE /steps": handlers.delete_step,
}


def handler(event, context):
    route = ROUTES.get(event["routeKey"])
    if route is None:
        return common.response(404, {"error": "Not found"})
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    try:
        for _ in range(STALE_RETRIES):
            try:
                return route(event, user_id)
            except common.Stale:
                pass
        return route(event, user_id)
    except common.ApiError as e:
        return common.response(e.status, {"error": e.message})
    except Exception:
        traceback.print_exc()
        return common.response(500, {"error": "Internal error"})
