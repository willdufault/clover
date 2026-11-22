# AGENTS.md

For project details, see @README.md. For backend design, see @ARCHITECTURE.md.

CI (`.github/workflows/ci.yml`) runs all checks below on every push to `stage`.

## Backend (run from `backend/`)

- Before finishing, run `uv run pytest -q`, `uv run ruff check --ignore-noqa .`, `uv run ruff format --check .`, and `uv run ty check`.

## Frontend (run from `frontend/`)

- Before finishing, run `npm test`, `npm run lint` (includes type-check), and `npm run format:check`.
- Add or update tests when behavior changes (new logic, state, interactions, bug fixes). Skip for copy, styling, and layout-only changes.
- UI changes: run `npm run e2e`, exercising the changed behavior (click, drag, set due date/stage), not just page load. Fail on console errors. Screenshot the changed UI and check it.

## Infra (run from `infra/`)

- Run Terraform with `AWS_PROFILE=wduf_clover`.
- Before finishing, run `terraform fmt -check`, `terraform init -backend=false`, and `terraform validate`.
- Never run `terraform apply` or `terraform destroy` without explicit approval.
- When credentials are available, run `terraform plan` and review it for unexpected changes, especially replacements and destroys.
