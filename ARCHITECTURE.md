# Clover architecture

Single prod environment in `us-east-1`. Terraform manages the API and auth. The frontend deploys to GitHub Pages (`https://willdufault.dev/clover/`) from `main` via `.github/workflows/pages.yml`. Ordering is not persisted.

## Components

- **Frontend**: React SPA. On load, `oidc-client-ts` exchanges any `?code=` for tokens, then renders. Any API call returning 401 redirects to login.
- **Auth**: Cognito user pool (email username, admin-only sign-up via `aws cognito-idp admin-create-user`, email auto-verified). Public app client: code grant + PKCE, no secret, scopes `openid email`, callback/logout URLs `<origin>/clover/` for each of `app_origins` (localhost, `willdufault.dev`, `willdufault.github.io`). `oidc-client-ts` stores the user in `localStorage` and silently renews via the refresh token. The SPA sends the **access token** as `Authorization: Bearer`; the authorizer matches its `client_id` claim against the audience. Id tokens last 12h, access tokens 1h. A 401 triggers a fresh login.
- **API**: API Gateway HTTP API. Cognito JWT authorizer on every route requiring the `openid` scope (rejects id tokens, which have no `scope` claim). One Lambda proxy integration (payload v2). CORS allows `app_origins`, methods `GET POST PATCH DELETE`, headers `authorization content-type`. `$default` stage throttles at 100 rps, burst 100.
- **Lambda** (`clover-api`): Python 3.14, arm64, 30s timeout, stdlib + boto3 from the runtime. `backend/` is zipped by `archive_file`. Env: `TABLE_NAME`. IAM scoped to the table. Logs kept 7 days.
- **DynamoDB**: one table (`clover-tasks`), on-demand.

## Backend code

- `index.py`: `handler` looks up `event["routeKey"]`, reads user id from JWT claim `sub`, maps `ApiError` to `{"error": ...}`.
- `handlers.py`: one `(event, user_id)` function per route, plus limit and parent checks.
- `shared/api.py`: `ApiError`/`Stale`, responses, JSON body parsing.
- `shared/schema.py`: limits, field validation, id and patch parsing.
- `shared/db.py`: table client, item helpers, transactions with retry, create/update/delete.
- `tests/`: pytest with moto-mocked DynamoDB.

## Data model

- `PK` = user id (Cognito `sub`), `SK` = `LIST#<id>` | `TASK#<id>` | `STEP#<id>` | `META`, id = `uuid.uuid7()`.
- Meta: `version` (number), one per user.
- List: `name`.
- Task: `title`, `stage` (`open|inProgress|waiting|done|cancelled`, default `open`), `due` (ISO date or null), `priority` (`low|medium|high`, default `medium`), `addedToToday` (default false), `listId` (null = no list).
- Step: `taskId`, `title`, `completed` (default false). `taskId` is set on create and can't be patched.
- Every request loads all of a user's items with one strongly consistent Query (`ConsistentRead=True`, no pagination; worst case ~210 items).
- Writes that change counts or parents (creates, `PATCH /tasks` changing a task's `listId`, `DELETE /lists`/`/tasks`) bump `META.version` in their transaction, conditioned on it being unchanged since the read (or absent). On mismatch the route re-runs from the read, up to 3 tries. This keeps count limits and parent existence strict under concurrency.

## API

All JSON. Items are returned as `{id, ...fields}`.

| Route | Behavior |
|---|---|
| `GET /data` | 200 `{"lists": [...], "tasks": [...], "steps": [...]}` |
| `POST /lists`, `/tasks`, `/steps` | Body: one item's fields (defaults filled). Checks limits and that `listId`/`taskId` exists. One `TransactWriteItems`: Put + META bump. 201 with the item. |
| `PATCH /lists`, `/tasks`, `/steps` | Body: `[{"id": ..., ...fields}]`, 1–99 unique ids, partial fields. All-or-nothing: one `TransactWriteItems` that SETs only given fields (condition `attribute_exists(PK)`), plus a META bump if any task moves into a list. Retried up to 3 times with backoff and jitter on `TransactionConflict`. Id-only patches are skipped. 200 with full updated items in request order. |
| `DELETE /lists`, `/tasks`, `/steps` | Body: `{"ids": [...]}`, 1–99 unique. Cascades list → its tasks → their steps, and task → its steps. Lists/tasks: one `TransactWriteItems` {META bump, Delete parents} first (on mismatch, re-read and retry), then batch delete children. Steps: batch delete, plus any orphan steps (task gone, e.g. after a crash mid-cascade). Ids already gone are skipped, so retries are safe. 204. |

Errors (`{"error": "..."}`; nothing is written):

- 400: bad JSON, bad body shape, bad/duplicate ids, unknown, invalid or missing field.
- 404: unknown route, PATCH id not found, referenced `listId`/`taskId` not found.
- 409: limit reached (including a PATCH batch moving too many tasks into a list), or concurrent update after retries (`Concurrent update`).
- 500: unexpected error (`Internal error`).

## Limits

Defined once in `backend/limits.json`. Read by `backend/shared/schema.py` and imported directly by the frontend, which uses the text limits as input `maxLength`.

- Per user: 10 lists, 99 tasks, 100 steps.
- Per parent: 20 tasks per list, 10 steps per task. Tasks with no list count only toward the user cap.
- Count limits apply on create, and on task PATCH when `listId` changes (checked against the whole batch).
- Text: list `name` ≤ 50 chars, task/step `title` ≤ 100 chars, not blank.
- Batch size: 1–99 ids per PATCH/DELETE (`batchMax`; transactions cap at 100 actions and META takes one).

## Frontend data flow

- `GET /data` once on load, then group steps under tasks. Sorting is in the UI.
- Not optimistic: await each call, then apply the server response (creates use the server id). On error, state is unchanged and the error is shown.
- Drag-and-drop reordering is local only. Moving a task to another list is a `PATCH /tasks` of `listId`.
