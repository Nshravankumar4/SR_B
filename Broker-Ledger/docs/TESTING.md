# Testing

## Automated test suites

The project includes 3 automated test suites (60 total checks) executable in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -Command "& '.\verify_broker_ledger.ps1'; & '.\run_behavioral_tests.ps1'; & '.\Broker-Ledger\tests\verify_dates_and_login.ps1'"
```

1. **`verify_broker_ledger.ps1` (25 checks)**:
   - Form datalist bindings and autocomplete.
   - Non-destructive bank autofill.
   - Status preservation across TOBILLED, A/TO-PAY, and F/TO-PAY.
   - Compound duplicate key collision prevention (`LR No + Date + Truck No`).
   - Double-click submission prevention.
   - Exact mathematical formula verification against workbook test rows.
   - Numeric 0 POD status verification (never substituting text 'DONE').
   - Decimal paise precision and negative balance preservation.

2. **`run_behavioral_tests.ps1` (17 checks)**:
   - Emulates browser UI state transitions, datalist loading, modal initialization, non-destructive editing, live calculations, duplicate prevention, and view/edit permissions.

3. **`Broker-Ledger/tests/verify_dates_and_login.ps1` (18 checks)**:
   - Independent 1st, 2nd, 3rd Advance Given Dates and independent Unloading Date.
   - Dedicated Balance Date.
   - 3 Advance Cards grouping (amounts + dates).
   - Individual field clear buttons (×).
   - Live Calculation Summary with `⚡ Fill Pending Amount` button.
   - Clear All button (`#clear-all-dialog`) with confirmation.
   - Dynamic button labels: `Add & Submit Shipment` and `Update Shipment`.
   - Sub-second non-blocking login.
   - Password visibility toggle with click/pointer handling.

## Browser checks

Serve the repository root locally and open `/Broker-Ledger/tests/browser-runner.html`. It runs the calculation and validation assertions in the browser JavaScript engine, plus an isolated backend login/session-cleanup check using mocked Apps Script services. The browser test does not connect to a real spreadsheet or validate a deployed backend.

For the visual shell, open `/?preview=1`. This mode is empty and read-only; it does not exercise real authentication, persistence, or mutations.

## Cloud end-to-end checks still require deployment

After deploying a separate Apps Script project and configuring `Broker-Ledger/js/config.js`, verify:

1. Admin and employee sign-in; invalid passwords and rate-limit behavior.
2. Add, edit, status change, and reload; IDs remain stable and records are not duplicated.
3. Employee delete/backup requests are rejected by the server; Admin delete/backup succeeds.
4. Search and all three exact status filters.
5. Excel import preview, duplicate rejection, text placeholder preservation, and export/re-import consistency.
6. Dashboard, filtered ledger, sheet view, and export calculations agree.
7. Sync across two authorized browser sessions and visible offline behavior.
8. Desktop and mobile layouts and browser console.

These live checks cannot be completed until the user configures and authorizes their Google Apps Script deployment. Do not infer cloud success from local calculation tests.
