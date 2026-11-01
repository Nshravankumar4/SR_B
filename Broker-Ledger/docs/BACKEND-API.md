# Backend API

All requests are JSON POSTs to the Apps Script Web App URL with `Content-Type: text/plain;charset=utf-8`, avoiding a browser preflight. Responses are JSON `{ "success": true, ... }` or `{ "success": false, "message": "..." }`.

Except `login`, actions require the server-issued `token`:

| Action | Role | Data | Result |
|---|---|---|---|
| `login` | Public entry point | `username`, `password` | `token`, `role`, and display name |
| `logout` | Signed in | — | Invalidates the current token |
| `getAll` | Signed in | — | Recalculated `records`, append-only `recoveries`, and dataset `version` |
| `ping` | Signed in | — | Current dataset `version`, without shipment rows |
| `createShipment` | Signed in | `record` | Validated, calculated shipment |
| `updateShipment` | Signed in | `id`, `record`, `expectedUpdatedAt` | Updated shipment; preserves ID, SL No, and creation metadata. Rejects stale versions with `RECORD_CONFLICT`. |
| `deleteShipment` | Admin | `id` | Deletes one record |
| `importShipments` | Signed in | `records[]` | Atomic import after validation and duplicate checks |
| `createRecovery` | Signed in | `recovery` with shipment, category, amount, actual date, payment mode, optional reference/remarks, and idempotency key | Appends a validated TOBILLED recovery; rejects duplicate/over-balance transactions |
| `reverseRecovery` | Signed in | `reversal` with recovery ID, actual reversal date, reason, and idempotency key | Appends one auditable negative reversal; does not edit/delete the original |
| `createBackup` | Admin | — | Dated copy of the backend spreadsheet in Google Drive |

Every write is serialized with `LockService.getScriptLock()`. An import validates the complete batch and checks duplicate identities before appending any rows. Recovery writes re-read the current shipment and recovery ledger inside the lock, validate the latest balance, and enforce idempotency. The first call to `setupBrokerLedger()` after updating the backend creates the `Recoveries` sheet without changing existing shipment rows.

The browser polls `ping` every 8 seconds while a signed-in tab is visible and requests `getAll` only when the version changes. `ping` checks the authenticated session and script-property data version without waiting for the global spreadsheet lock or opening the spreadsheet; data writes and full reads remain serialized. `updateShipment` requires the record's `updatedAt` value from the edit form; the Apps Script lock protects the version check and write as one operation.

## Deployment notes

`backend/Code.gs` is a standalone Apps Script project file. The deployment identity must have access to its own Broker Ledger spreadsheet. Deploy and authorize the script independently from SR_T.
