# Testing

## Automated calculations and validation

The Node test suite covers fixture formulas, summary totals, negative and decimal precision, empty optional values, formatted amounts, invalid text, COD placeholders, status changes, and stale derived values:

```powershell
node --test tests\calculations.test.js tests\validation.test.js tests\summaries.test.js
```

## Browser checks

Serve the project locally and open `tests/browser-runner.html`. It runs the calculation and validation assertions in the browser JavaScript engine.

For the visual shell, open `/?preview=1`. This mode is empty and read-only; it does not exercise authentication, persistence, or mutations.

## Cloud end-to-end checks still require deployment

After deploying a separate Apps Script project and configuring `js/config.js`, verify:

1. Admin and employee sign-in; invalid passwords and rate-limit behavior.
2. Add, edit, status change, and reload; IDs remain stable and records are not duplicated.
3. Employee delete/backup requests are rejected by the server; Admin delete/backup succeeds.
4. Search and all three exact status filters.
5. Excel import preview, duplicate rejection, text placeholder preservation, and export/re-import consistency.
6. Dashboard, filtered ledger, sheet view, and export calculations agree.
7. Sync across two authorized browser sessions and visible offline behavior.
8. Desktop and mobile layouts and browser console.

These live checks cannot be completed until the user configures and authorizes their Google Apps Script deployment. Do not infer cloud success from local calculation tests.
