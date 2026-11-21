# AGENTS.md

For project details, see @README.md. For backend design, see @ARCHITECTURE.md.

## Backend (`backend/`)

Run commands from `backend/`.

### Validation

- Before finishing, run `uv run pytest -q`, `uv run ruff check --ignore-noqa .`, `uv run ruff format --check .`, and `uv run ty check`.

## Frontend (`frontend/`)

Run commands from `frontend/`.

### Validation

- Before finishing, run `npm test`, `npm run lint`, `npm run format:check`, and `npm run build` (type-check).
- Add or update tests when behavior changes (new logic, state, interactions, bug fixes). Skip for copy, styling, and layout-only changes.

### UI changes

- Run `npm run e2e`. Exercise the changed behavior (click, drag, set due date/stage), not just page load. Fail on console errors.
- Screenshot the changed UI and check it.

## Infra (`infra/`)

Run commands from `infra/`.

### Validation

- Before finishing, run `terraform fmt -check`, `terraform init -backend=false`, and `terraform validate`.
- Never run `terraform apply` or `terraform destroy` without explicit approval.
- When credentials are available, run `terraform plan` and review it for unexpected changes, especially replacements and destroys.
