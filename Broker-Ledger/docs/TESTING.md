# Testing

## Automated test suites

The Node.js calculation and validation suites run with:

```powershell
node --test .\Broker-Ledger\tests\calculations.test.js .\Broker-Ledger\tests\summaries.test.js .\Broker-Ledger\tests\validation.test.js .\Broker-Ledger\tests\receipts.test.js .\Broker-Ledger\tests\backend-receipts.test.js
```

Run the existing PowerShell suites separately:

```powershell
powershell -ExecutionPolicy Bypass -Command "& '.\verify_broker_ledger.ps1'; & '.\run_behavioral_tests.ps1'; & '.\Broker-Ledger\tests\verify_dates_and_login.ps1'"
```

1. **`verify_broker_ledger.ps1`**:
   - Form datalist bindings and autocomplete.
   - Non-destructive bank autofill.
   - Status preservation across TOBILLED, A/TO-PAY, and F/TO-PAY.
   - Compound duplicate key collision prevention (`LR No + Date + Truck No`).
   - Double-click submission prevention.
   - Exact mathematical formula verification against workbook test rows.
   - POD Balance Amount / Status remains blank unless supplied, while the separate calculated payment-status display updates from pending and receipt totals.
   - POD Amount Status is omitted from the ledger, Live Excel Sheet, and exported workbook while existing stored values remain available to imports and edits.
   - In the shipment form, the receipt summary avoids repeating Remaining because the final Pending Amount field already shows that value; the management dialog shows Received, Remaining, and Status together.
   - Receipt entry recalculates the preview as the amount changes, rejects invalid/over-balance values, and does not persist the preview until Add Payment is selected.
   - Excel export uses the styled ExcelJS workbook and includes the Live Excel Sheet receipt summary columns; if styling/export fails, the user sees an error instead of receiving an unstyled fallback.
   - Dashboard Done/Pending cards, exact-shipment sheet navigation, received total/latest date/payment mode columns, and payment entry visibility when a balance is zero.
   - Decimal paise precision and negative balance preservation.

2. **`run_behavioral_tests.ps1`**:
   - Emulates browser UI state transitions, datalist loading, modal initialization, non-destructive editing, live calculations, duplicate prevention, and view/edit permissions.

3. **`Broker-Ledger/tests/verify_dates_and_login.ps1`**:
   - Independent 1st, 2nd, 3rd Advance Given Dates and independent Unloading Date.
   - Dedicated Balance Date.
   - 3 Advance Cards grouping (amounts + dates).
   - Individual field clear buttons (×).
   - POD Amount Status is no longer an editable form field; existing values remain preserved when editing shipments.
   - Clear All button (`#clear-all-dialog`) with confirmation.
   - Dynamic button labels: `Add & Submit Shipment` and `Update Shipment`.
   - Sub-second non-blocking login.
   - Password visibility toggle with click/pointer handling.
   - Receipt history, live amount preview, reversal behavior, and preservation of blank/user-entered POD values are covered by `receipts.test.js` and `backend-receipts.test.js`; verify the deployed app that receiving ₹10,000 against ₹10,000 TOBILLED pending previews ₹0, then saves ₹0, and reversing it restores ₹10,000 while leaving the original receipt in history.

## Browser checks

Serve the repository root locally and open `/Broker-Ledger/tests/browser-runner.html`. It runs the calculation and validation assertions in the browser JavaScript engine, plus an isolated backend login/session-cleanup check using mocked Apps Script services. The browser test does not connect to a real spreadsheet or validate a deployed backend.

For the visual shell, open `/?preview=1`. This mode is empty and read-only; it does not exercise real authentication, persistence, or mutations.

## Cloud end-to-end checks still require deployment

After deploying a separate Apps Script project and configuring `Broker-Ledger/js/config.js`, verify:

1. Admin and employee sign-in; invalid passwords and rate-limit behavior.
2. Add, edit, status change, and reload; IDs remain stable and records are not duplicated.
3. Rudra can create a backup and reverse a received payment; shipment deletion is rejected for Rudra by both the UI and server, while Admin deletion succeeds.
4. Search and all three exact status filters.
   - Verify the separate received-payment filter (none, partial, fully received), Rudra's table omits the Delete column, and signed-in users can reverse eligible receipts.
5. Excel import preview, duplicate rejection, text placeholder preservation, and export/re-import consistency.
6. Dashboard, filtered ledger, sheet view, and export calculations agree.
7. Sync across two authorized browser sessions and visible offline behavior.
8. Desktop and mobile layouts and browser console.

These live checks cannot be completed until the user configures and authorizes their Google Apps Script deployment. Do not infer cloud success from local calculation tests.
