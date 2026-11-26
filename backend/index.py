import json
import os
import traceback

import api
import db
import handlers

STALE_RETRIES = 2

with open(os.path.join(os.path.dirname(__file__), "routes.json")) as f:
    ROUTES = {route: getattr(handlers, name) for route, name in json.load(f).items()}


def handler(event: dict, context: object) -> dict:
    route = ROUTES.get(event["routeKey"])
    if route is None:
        return api.response(404, {"error": "Not found"})
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    try:
        for attempt in range(STALE_RETRIES):
            try:
                return route(event, user_id)
            except api.Stale:
                db.backoff(attempt)
        return route(event, user_id)
    except api.ApiError as e:
        return api.response(e.status, {"error": e.message})
    except Exception:
        traceback.print_exc()
        return api.response(500, {"error": "Internal error"})
