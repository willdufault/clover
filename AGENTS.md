# AGENTS.md

For project details, see @README.md. For backend design, see @ARCHITECTURE.md.

## Frontend (`frontend/`)

Run commands from `frontend/`.

### Validation

- Before finishing, run `npm test`, `npm run lint`, and `npm run build` (type-check).
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
