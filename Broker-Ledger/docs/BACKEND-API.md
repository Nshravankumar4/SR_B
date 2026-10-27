# Backend API

All requests are JSON POSTs to the Apps Script Web App URL with `Content-Type: text/plain;charset=utf-8`, avoiding a browser preflight. Responses are JSON `{ "success": true, ... }` or `{ "success": false, "message": "..." }`.

Except `login`, actions require the server-issued `token`:

| Action | Role | Data | Result |
|---|---|---|---|
| `login` | Public entry point | `username`, `password` | `token`, `role`, and display name |
| `logout` | Signed in | — | Invalidates the current token |
| `getAll` | Signed in | — | Recalculated `records` and dataset `version` |
| `createShipment` | Signed in | `record` | Validated, calculated shipment |
| `updateShipment` | Signed in | `id`, `record` | Updated shipment; preserves ID, SL No, and creation metadata |
| `deleteShipment` | Admin | `id` | Deletes one record |
| `importShipments` | Signed in | `records[]` | Atomic import after validation and duplicate checks |
| `createBackup` | Admin | — | Dated copy of the backend spreadsheet in Google Drive |

Every write is serialized with `LockService.getScriptLock()`. An import validates the complete batch and checks duplicate identities before appending any rows.

## Deployment notes

`backend/Code.gs` is a standalone Apps Script project file. The deployment identity must have access to its own Broker Ledger spreadsheet. Deploy and authorize the script independently from SR_T.
