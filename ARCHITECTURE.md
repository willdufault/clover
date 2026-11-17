# Clover architecture

Single prod environment in `us-east-1`. Terraform manages the API and auth; frontend hosting is out of scope. Ordering is not persisted.

## Components

- **Frontend**: React SPA. On load it exchanges any `?code=` for tokens, then renders if a valid id token is stored, otherwise redirects to login.
- **Auth**: Cognito user pool (email username, open self sign-up, email auto-verified). Public app client: code grant + PKCE, no secret, scopes `openid email`, callback/logout URL `app_url`. The SPA stores the **id token** in `localStorage` and sends it as `Authorization: Bearer`; the authorizer checks audience, which only the id token carries. Id and access tokens last 12h. A 401 triggers a fresh login.
- **API**: API Gateway HTTP API, Cognito JWT authorizer on every route, one Lambda proxy integration (payload v2). CORS allows `app_url`, methods `GET POST PATCH DELETE`, headers `authorization content-type`. `$default` stage throttles at 100 rps, burst 100.
- **Lambda** (`clover-api`): Python 3.14, arm64, 30s timeout, stdlib + boto3 from the runtime. `backend/` is zipped by `archive_file`. Env: `TABLE_NAME`. IAM scoped to the table. Logs kept 7 days.
- **DynamoDB**: one table (`clover-tasks`), on-demand.

## Backend code

- `index.py`: `handler` looks up `event["routeKey"]`, reads user id from JWT claim `sub`, maps `ApiError` to `{"error": ...}`.
- `handlers/<name>.py`: `handle(event, user_id)`, one per route.
- `common.py`: table client, parsing, validation, storage helpers, limits.
- `tests/`: pytest with an in-memory fake table.

## Data model

- `PK` = user id (Cognito `sub`), `SK` = `LIST#<id>` | `TASK#<id>` | `STEP#<id>`, id = `uuid.uuid7()`.
- List: `name`.
- Task: `title`, `stage` (`open|inProgress|waiting|done|cancelled`, default `open`), `due` (ISO date or null), `priority` (`low|medium|high`, default `medium`), `addedToToday` (default false), `listId` (null = no list).
- Step: `taskId`, `title`, `completed` (default false). `taskId` is set on create and can't be patched.
- Every request loads all of a user's items with one Query (no pagination; worst case ~210 items).

## API

All JSON. Items are returned as `{id, ...fields}`.

| Route | Behavior |
|---|---|
| `GET /data` | 200 `{"lists": [...], "tasks": [...], "steps": [...]}` |
| `POST /lists`, `/tasks`, `/steps` | Body: one item's fields (defaults filled). Checks limits and that `listId`/`taskId` exists. 201 with the item. |
| `PATCH /lists`, `/tasks`, `/steps` | Body: `[{"id": ..., ...fields}]`, 1–100 unique ids, partial fields. All-or-nothing: one `TransactWriteItems` that SETs only given fields (condition `attribute_exists(PK)`), retried up to 3 times with backoff on `TransactionConflict`; id-only patches are skipped. 200 with full updated items in request order. |
| `DELETE /lists`, `/tasks`, `/steps` | Body: `{"ids": [...]}`, 1–100 unique. Cascades list → its tasks → their steps, task → its steps. Batch writes, children first, so a failed delete leaves no orphans and a retry finishes it. 204. |

Errors (`{"error": "..."}`; nothing is written):

- 400: bad JSON, bad body shape, bad/duplicate ids, unknown, invalid or missing field.
- 404: unknown route, any id not found, referenced `listId`/`taskId` not found.
- 409: limit reached (including a PATCH batch moving too many tasks into a list).
- 500: unexpected error (`Internal server error.`).

## Limits

Defined once in `backend/limits.json`, read by `backend/common.py` and imported by `frontend/src/limits.ts` (the frontend checks them before calling the API).

- Per user: 10 lists, 100 tasks, 100 steps.
- Per parent: 20 tasks per list, 10 steps per task. Tasks with no list count only toward the user cap.
- Count limits apply on create, and on task PATCH when `listId` changes (checked against the whole batch).
- Text: list `name` ≤ 50 chars, task/step `title` ≤ 100 chars, not blank.
- Batch size: 1–100 ids per PATCH/DELETE.

## Frontend data flow

- `GET /data` once on load, then group steps under tasks; sorting is in the UI.
- Not optimistic: await each call, then apply the server response (creates use the server id). On error, state is unchanged and the error is shown.
- Drag-and-drop reordering is local only; moving a task to another list is a `PATCH /tasks` of `listId`.
