# clover

A small todo app with lists, tasks, steps, due dates, priority, stage, a Today view and drag and drop. React frontend, serverless AWS backend.

## Layout

```
frontend/   React 19 + TypeScript SPA (Vite, Tailwind 4, dnd-kit)
  src/          app code (api.ts = auth + API client, limits.ts = limits from backend/limits.json)
  tests/unit/   Vitest + Testing Library
  tests/e2e/    Playwright, API mocked in-browser
backend/    Python 3.14 Lambda (index.py router, handlers/, common.py)
  tests/        pytest with an in-memory fake table
infra/      Terraform: DynamoDB, Cognito, Lambda, HTTP API
```

## Frontend

Run from `frontend/`:

```sh
npm install
npm run dev    # dev server on http://localhost:5173
npm test       # unit tests (vitest)
npm run e2e    # browser tests (playwright, starts dev server)
npm run lint   # oxlint
npm run build  # type-check and build
```

`frontend/.env` (values come from the Terraform outputs):

- `VITE_API_URL`: API base URL (`api_url`)
- `VITE_COGNITO_URL`: Cognito hosted UI URL (`cognito_url`)
- `VITE_COGNITO_CLIENT_ID`: app client ID (`client_id`)

## Backend

Run from `backend/` (uses [uv](https://docs.astral.sh/uv/)):

```sh
uv sync         # install dev deps (boto3, pytest)
uv run pytest   # tests
```

## Infra

Run from `infra/`. State lives in S3 (bucket `wduf-clover-terraform-state` in `us-east-1`, created by hand, native lockfile).

```sh
terraform init
terraform fmt -check
terraform validate
terraform plan
terraform apply
```

Variables: `region` (default `us-east-1`), `cognito_domain_prefix` (default `wduf-clover`), `app_url` (default `http://localhost:5173`, used for Cognito callback/logout and CORS).

Outputs: `api_url`, `cognito_url`, `client_id`, `user_pool_id`.
