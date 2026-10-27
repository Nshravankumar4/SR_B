# Broker Ledger

The GitHub Pages application entry point is the repository-root `index.html`. The application source, backend, tests, and detailed guides remain organized in `Broker-Ledger/`.

An independent transport brokerage ledger for shipment records, billed balances, and COD / To-Pay tracking. The design takes general layout and interaction cues from the SR_T reference, but this project has its own source code, Google Apps Script backend, Google spreadsheet, accounts, and data.

The application starts with an empty ledger. The example shipments in `tests/fixtures/reference-shipments.json` are test fixtures only; they are never loaded as live records.

## Features

- Responsive sign-in, navigation, dashboard, searchable shipment ledger, and spreadsheet-style view.
- Add, view, edit, and role-authorized delete operations.
- Exact status choices: `TOBILLED`, `A/TO-PAY`, `F/TO-PAY`.
- Shared calculation/validation logic on the browser and server.
- Separate `Pending Amount: Tobilled` and final `Pending Amount`.
- Preserves COD / To-Pay text placeholders and excludes them from numeric totals.
- Excel/CSV import with preview and duplicate checks; XLSX export with a totals row.
- Google Sheets as the backend's authoritative store; Apps Script locking, sessions, role checks, audit entries, and administrator backups.
- No SR_T production URL, spreadsheet, record, password, or token is used.

## Project layout

```text
SR_B/
├── index.html                 # GitHub Pages application entry point
├── reports/summary.html       # Previous static workbook summary
├── Broker_Ledger_Summary.md
└── Broker-Ledger/
    ├── css/styles.css
    ├── js/
    │   ├── app.js
    │   ├── api.js
    │   ├── calculations.js
    │   ├── config.js
    │   └── validation.js
    ├── backend/Code.gs
    ├── libs/xlsx.full.min.js
    ├── tests/
    │   ├── calculations.test.js
    │   ├── validation.test.js
    │   ├── summaries.test.js
    │   ├── browser-runner.html
    │   ├── browser-runner.js
    │   └── fixtures/reference-shipments.json
    └── docs/
        ├── ARCHITECTURE.md
        ├── BACKEND-API.md
        ├── CALCULATIONS.md
        ├── DATA-MODEL.md
        ├── DEPLOYMENT.md
        ├── SECURITY.md
        └── TESTING.md
```

## Open a local read-only preview

The preview displays the actual app styling and empty application views. It is intentionally read-only, has no sample records, does not authenticate, and cannot write data.

From PowerShell:

```powershell
Set-Location 'D:\Repo\SR_B'
python -m http.server 8123 --bind 127.0.0.1
```

Open `http://127.0.0.1:8123/?preview=1`. The app and its assets are served from the repository root; the source files remain in `Broker-Ledger/`. Use Ctrl+C in the server terminal to stop it.

## Configure the live Google Sheets application

1. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to create a **new** Apps Script project and a separate spreadsheet.
2. Set different administrator and employee usernames/passwords (at least 12 characters each) as private Apps Script Script Properties; never add them to frontend source code or commit them.
3. Run `setupBrokerLedger()` and authorize the script.
4. Deploy the script as a Web App and paste its URL into `js/config.js` as `apiUrl`.
5. Host the repository root over HTTPS (for example, with GitHub Pages). The live app at the root will authenticate against the new backend. The backend URL is configuration, not a credential.

Until that separate backend is deployed and configured, normal login and all persistent operations remain unavailable. The application does not silently fall back to browser storage.

## Calculation rules

Money is parsed into integer paise for calculation. Comma-grouped Indian and Western formats and an optional rupee prefix are accepted; empty optional values mean zero; invalid non-empty values are rejected.

```text
Pending Amount: Tobilled = FRIGHT - T/M - ADVANCE - ADVANCE2 - ADVANCE3
Pending Amount (TOBILLED) = Pending Amount: Tobilled + Extra Amount - P/M
Pending Amount (A/TO-PAY or F/TO-PAY) = 0
```

COD / To-Pay is preserved as entered. Numeric values are summarized; notes such as `if Tobilled NA` remain text and are excluded. See [docs/CALCULATIONS.md](docs/CALCULATIONS.md) for formulas, test cases, and edge cases.

## Data and field definitions

The shipment data fields, status contract, and distinction between the two pending columns are documented in [docs/DATA-MODEL.md](docs/DATA-MODEL.md). The app and workbook import use the same source names and order as the Broker Ledger sheet. Derived fields are recalculated from source values whenever records are loaded, saved, imported, or exported.

## Tests

With Node.js 18 or later:

```powershell
node --test tests\calculations.test.js tests\validation.test.js tests\summaries.test.js
```

Run the command from `D:\Repo\SR_B\Broker-Ledger`. The same calculation and validation checks can be run in a browser by serving `D:\Repo\SR_B` and opening `/Broker-Ledger/tests/browser-runner.html`. Test coverage and end-to-end checks are listed in [docs/TESTING.md](docs/TESTING.md).

## Backup, recovery, and security

- The Google Sheet is the live source of truth. Restrict its sharing to trusted administrators.
- Admins can create a dated Google Drive copy from the app. Retain separate Drive history or manually download a copy for additional recovery protection.
- Account numbers and IFSC details are sensitive. Use HTTPS, strong individual passwords, and least-privilege access.
- The backend validates every write. Employees cannot delete records or create backups, even if they construct API requests themselves.
- The app does not contain passwords, API secrets, or production data.
- See [docs/SECURITY.md](docs/SECURITY.md) for security boundaries and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup and redeployment.

## Third-party library

Excel import/export uses the locally bundled SheetJS Community Edition distribution in `libs/xlsx.full.min.js`. Its attribution and license are in `libs/THIRD_PARTY_NOTICES.md` and `libs/LICENSE-APACHE-2.0.txt`.
