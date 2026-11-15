# Clover backend architecture (brainstorm, not implemented)

## Context
Move Clover from local-only state to a full-stack AWS app. A single prod environment covering the API and auth only; frontend hosting is out of scope. Ordering is deferred.

## Terraform (`infra/`, one flat root module)
- `main.tf`:
  - S3 remote state (bucket `wduf-clover-terraform-state`, created by hand), `use_lockfile = true`.
  - DynamoDB: one table, on-demand billing.
  - Cognito: user pool, public app client (code grant + PKCE, no secret, scopes `openid email`), hosted UI domain, callback/logout URL `app_url`.
  - Lambda: one Python function, zipped with `archive_file`, IAM role scoped to the table.
  - HTTP API: Cognito JWT authorizer, one route per handler, all pointing to the Lambda.
- `variables.tf`: `cognito_domain_prefix`, `app_url`. Region is hardcoded to `us-east-1`.
- `outputs.tf`: API URL, Cognito hosted UI URL, client ID, user pool ID.

## Data model (single table)
- `PK=userId` (Cognito `sub`), `SK=<LIST|TASK|STEP>#<ulid>`.
- List: `name`.
- Task: `listId` (null = unassigned), `title`, due date, stage.
- Step: `taskId`, `title`, `done`.
- Limits (enforced on create/update):
  - Per user: 10 lists, 100 tasks, 100 steps.
  - Per parent: 20 tasks per list, 10 steps per task.
  - Unassigned tasks count only toward the user cap.
  - Text: list `name` max 50 chars; task and step `title` max 100 chars.
- Worst case ≈ 210 items ≈ 75 KB/user → fits one Query page; no pagination anywhere.
- Est. cost, 100 users, no free tier: ~$1.50/mo worst case.

## API routes (one handler module each)
| Route | Handler |
|---|---|
| `GET /data` | `get_data`: one Query on `PK=userId`, returns everything |
| `POST /lists`, `/tasks`, `/steps` | `create_*` (checks limits) |
| `PATCH /lists/{id}`, `/tasks/{id}`, `/steps/{id}` | `update_*` (checks limits when `listId` changes) |
| `DELETE /lists/{id}`, `/tasks/{id}`, `/steps/{id}` | `delete_*` (cascade to children, batched) |

## Lambda (`backend/`, Python stdlib + boto3)
- `app.py`: router keyed on `event["routeKey"]`, reads `userId` from JWT claims.
- `handlers/<name>.py`: `handle(event, user_id)`, isolated per route.
- `common.py`: table client, JSON response helpers.

## Frontend changes
- Auth: redirect to hosted UI, PKCE code exchange, token storage, attach `Authorization` header.
- API client: fetch `GET /data` once, then group by `listId`/`taskId`; sort in the UI.
- Replace local state mutations with API calls.

## Deferred
- Manual ordering (lists, tasks in a list, steps in a task).

## Verification (when built)
- `terraform plan/apply`; pytest on handlers; e2e: login → CRUD → reload persists.
