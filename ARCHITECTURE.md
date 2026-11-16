# Clover backend architecture

## Context
Move Clover from local-only state to a full-stack AWS app. A single prod environment covering the API and auth only; frontend hosting is out of scope. Ordering is not persisted.

## Terraform (`infra/`, one flat root module)
- `main.tf`:
  - S3 remote state (bucket `wduf-clover-terraform-state`, created by hand), `use_lockfile = true`.
  - DynamoDB: one table, on-demand billing.
  - Cognito: user pool, public app client (code grant + PKCE, no secret, scopes `openid email`), hosted UI domain, callback/logout URL `app_url`.
  - Lambda: one Python 3.14 function (`index.handler`), `backend/` zipped with `archive_file` (excluding `.venv`, `tests`, uv and pytest files), IAM role scoped to the table. Env: `TABLE_NAME`, `TABLE_REGION`.
  - HTTP API: Cognito JWT authorizer, one route per handler, all pointing to the Lambda.
- `variables.tf`: `cognito_domain_prefix`, `app_url`. Region is hardcoded to `us-east-1`.
- `outputs.tf`: API URL, Cognito hosted UI URL, client ID, user pool ID.

## Data model (single table)
- `PK=userId` (Cognito `sub`), `SK=<LIST|TASK|STEP>#<id>`, id = `uuid.uuid7()`.
- List: `name` (any emoji is just part of the name).
- Task: `title`, `stage` (`open|inProgress|waiting|done|cancelled`, default `open`), `due` (ISO date or null), `priority` (`low|medium|high`, default `medium`), `addedToToday` (default false), `listId` (null = unassigned).
- Step: `taskId`, `title`, `completed` (default false). `taskId` can't be changed.
- Limits (enforced on create, and on task update when `listId` changes):
  - Per user: 10 lists, 100 tasks, 100 steps.
  - Per parent: 20 tasks per list, 10 steps per task.
  - Unassigned tasks count only toward the user cap.
  - Text: list `name` max 50 chars; task and step `title` max 100 chars; none may be blank.
- Worst case ≈ 210 items ≈ 75 KB/user → fits one Query page; no pagination anywhere.
- Est. cost, 100 users, no free tier: ~$1.50/mo worst case.

## API routes (one handler module each)
All JSON. Items are returned as `{id, ...fields}`.

| Route | Handler |
|---|---|
| `GET /data` | `get_data`: one Query on `PK=userId`, returns `{"lists": [...], "tasks": [...], "steps": [...]}` |
| `POST /lists`, `/tasks`, `/steps` | `create_*` (checks limits), 201 with the item |
| `PATCH /lists/{id}`, `/tasks/{id}`, `/steps/{id}` | `update_*` (partial; checks limits when `listId` changes), 200 with the item |
| `DELETE /lists/{id}`, `/tasks/{id}`, `/steps/{id}` | `delete_*` (list → its tasks and their steps; task → its steps; batched), 204 |

Errors: `{"error": "..."}` with 400 (bad JSON, unknown/invalid/missing field), 404 (route, item, or referenced `listId`/`taskId` not found), 409 (limit reached).

## Lambda (`backend/`, Python 3.14 stdlib + boto3, managed with uv)
- `index.py`: `handler` routes on `event["routeKey"]`, reads `userId` from JWT claims `sub`.
- `handlers/<name>.py`: `handle(event, user_id)`, one per route.
- `common.py`: table client, JSON response helpers, validation, limits.
- `tests/`: pytest with an in-memory fake table (`uv run pytest`).

## Frontend changes
- Auth: redirect to hosted UI, PKCE code exchange, token storage, attach `Authorization` header.
- API client: fetch `GET /data` once, then group by `listId`/`taskId`; sort in the UI.
- Replace local state mutations with API calls. Not optimistic: await each call, then apply the server's response to state (creates use the server-assigned id). On error, leave state unchanged and show the error.
- Drag-and-drop reordering is local-only (not persisted); moving a task to another list is a `PATCH` of `listId`.

## Verification
- `terraform plan/apply`; `uv run pytest`; e2e: login → CRUD → reload persists.
