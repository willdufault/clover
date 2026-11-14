# AGENTS.md

For project details, see @README.md.

## Validation

- Before finishing, run `npm test`, `npm run lint`, and `npm run build` (type-check).
- Add or update tests when behavior changes (new logic, state, interactions, bug fixes). Skip for copy, styling, and layout-only changes.

## UI changes

- Run `npm run e2e`. Exercise the changed behavior (click, drag, set due date/stage), not just page load. Fail on console errors.
- Screenshot the changed UI and check it.

## PR evidence

- Open the PR first. Then commit its screenshots to the `pr-evidence` branch under `pr-<N>/` and push.
- In the same commit, delete `pr-<N-10>/` and older.
- Embed them in the PR body: `![](https://raw.githubusercontent.com/willdufault/clover/pr-evidence/pr-<N>/<name>.png)`.
