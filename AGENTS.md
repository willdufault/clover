# AGENTS.md

For project details, see @README.md.

## Validation

- Run `npm test` and `npm run lint` after changes.
- Run `npm run build` (type-check) before finishing.
- Add a test in `tests/` for new logic.

## Browser validation

- For UI changes, add or update an e2e test and run the e2e tests.
- Exercise the changed behavior (click, drag, set due date/stage), not just page load.
- Fail on console errors.
- Take a screenshot of the changed UI at 640x360 and check it.
