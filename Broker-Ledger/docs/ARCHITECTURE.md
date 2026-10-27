# Architecture

## Components

- `index.html` and `css/styles.css` provide the responsive user interface, following the general navy sidebar, cards, and spreadsheet styling of the SR_T reference.
- `js/calculations.js` is the browser's shared safe amount parser, calculation engine, and summary function.
- `js/validation.js` performs client-side input validation before requests are sent.
- `js/api.js` is the only browser-to-backend request layer. It sends `text/plain` JSON POST requests to the configured Apps Script URL.
- `js/app.js` handles navigation, forms, search/status filters, spreadsheet rendering, import, and export. It uses the shared calculation module rather than defining its own formulas.
- `backend/Code.gs` handles authentication, validation, calculations, CRUD, duplicate detection, locking, audit entries, and backups.
- A new Google spreadsheet is created for this application. The backend's `Shipments` sheet stores stable record IDs and JSON rows; `Audit` records write actions. Script Properties hold the spreadsheet ID, account configuration, temporary login counters, sessions, and data version.

## Data flow

1. A user signs in; the backend verifies the account and returns a short-lived server-issued session token.
2. Every read/write request includes the token. The backend resolves the token and enforces the role for protected operations.
3. The server validates source fields and recalculates both derived amounts before writing.
4. Browser views, the dashboard, spreadsheet view, and Excel export calculate derived values through the same shared rules from source fields.
5. Refreshes and a 60-second sync poll reload the authoritative dataset. A failed refresh is shown as offline/stale rather than a confirmed current sync.

The application is not connected to the reference project's backend or spreadsheet. No sample shipment data is seeded at setup.
