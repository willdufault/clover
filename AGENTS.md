# AGENTS.md

For project details, see @README.md. For backend design, see @ARCHITECTURE.md.

CI (`.github/workflows/ci.yml`) runs all checks below on every push to `stage`. Pushes to `main` deploy the frontend to https://willdufault.dev/clover/ via `.github/workflows/pages.yml`.

## Verification

Check your own work before finishing. Exercise the behavior you changed, not just the build, and report what you ran and what happened. Add or update tests when behavior changes (new logic, state, interactions, bug fixes). Skip for copy, styling, and layout-only changes. Changes to `shared/` require both frontend and backend checks.

### Frontend (run from `frontend/`)

- Run `npm test`, `npm run lint`, `npm run format:check`, and `npm run build` (type-check).
- UI changes: run `npm run e2e` exercising the changed behavior (click, drag, set due date/stage), not just page load. Fail on console errors. Screenshot the changed UI and check it. For PR evidence, record with Playwright `video: 'on'`, then convert to GIF: `$(node -p "require('ffmpeg-static')") -i video.webm -vf "fps=25,scale=<width>:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" <name>.gif`.

### Backend (run from `backend/`)

- Run `uv run pytest -q`, `uv run ruff check --ignore-noqa .`, `uv run ruff format --check .`, and `uv run ty check`.

### Infra (run from `infra/`)

- Run `terraform fmt -check`, `terraform init -backend=false`, and `terraform validate`.
- When credentials are available, run `terraform plan` and review it for unexpected changes, especially replacements and destroys.

## Setup

- `shared/` (`limits.json`, `enums.json`) is symlinked as `backend/shared` and `frontend/src/shared`.
- Frontend: install with `npm install`. Run with `npm run dev` (http://localhost:5173/clover/). `frontend/.env` values come from Terraform outputs: `VITE_API_URL` = `api_url`, `VITE_COGNITO_URL` = `cognito_url`, `VITE_COGNITO_ISSUER` = `cognito_issuer`, `VITE_COGNITO_CLIENT_ID` = `client_id`.
- Backend: install with `uv sync`.
- Infra: run Terraform with `AWS_PROFILE=wduf_clover`. State lives in S3 bucket `wduf-clover-terraform-state` (`us-east-1`, created by hand, native lockfile). Variables: `region` (default `us-east-1`), `cognito_domain_prefix` (default `wduf-clover`), `app_origins` (default localhost:5173, `willdufault.dev`, `willdufault.github.io`; used for CORS and Cognito callback/logout at `<origin>/clover/`).

## Rules

- Never run `terraform apply` or `terraform destroy` without explicit approval.
