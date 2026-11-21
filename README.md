# clover

Todo app: lists, tasks, steps, due dates, priority, stage, Today view, drag and drop. React frontend, serverless AWS backend.

## Layout

```
frontend/   React 19 + TypeScript SPA (Vite, Tailwind 4, dnd-kit)
  src/          app code (api.ts = auth + API client; limits from backend/limits.json)
  tests/unit/   Vitest + Testing Library
  tests/e2e/    Playwright, API mocked in-browser
backend/    Python 3.14 Lambda (index.py router, handlers.py, shared/{api,schema,db}.py)
  tests/        pytest with moto-mocked DynamoDB
infra/      Terraform: DynamoDB, Cognito, Lambda, HTTP API
```

## Frontend

From `frontend/`:

```sh
npm install
npm run dev    # http://localhost:5173
npm test       # unit tests (vitest)
npm run e2e    # browser tests (playwright, starts dev server)
npm run lint   # oxlint
npm run build  # type-check and build
```

`frontend/.env`, values from Terraform outputs:

- `VITE_API_URL`: `api_url`
- `VITE_COGNITO_URL`: `cognito_url`
- `VITE_COGNITO_CLIENT_ID`: `client_id`

## Backend

From `backend/` (uses [uv](https://docs.astral.sh/uv/)):

```sh
uv sync                          # install dev deps (boto3, pytest, moto, hypothesis, ruff, ty)
uv run pytest                    # tests
uv run ruff check --ignore-noqa  # lint
uv run ruff format               # format
uv run ty check                  # type-check
```

## Infra

From `infra/`. State: S3 bucket `wduf-clover-terraform-state` (`us-east-1`, created by hand, native lockfile).

```sh
terraform init
terraform fmt -check
terraform validate
terraform plan
terraform apply
```

Variables: `region` (default `us-east-1`), `cognito_domain_prefix` (default `wduf-clover`), `app_url` (default `http://localhost:5173`; Cognito callback/logout and CORS).

Outputs: `api_url`, `cognito_url`, `client_id`.
