# SR Brokerage Ledger

The repository root is the GitHub Pages application entry point. The app's source, Google Apps Script backend, tests, and setup guides are organized under [`Broker-Ledger/`](Broker-Ledger/README.md).

## Local preview

From PowerShell:

```powershell
Set-Location 'D:\Repo\SR_B'
python -m http.server 8123 --bind 127.0.0.1
```

Open `http://127.0.0.1:8123/?preview=1` for the empty, read-only UI preview.

## Configure the live backend

Follow the [deployment guide](Broker-Ledger/docs/DEPLOYMENT.md) to create a separate Google Apps Script Web App and spreadsheet. Configure the `/exec` URL in [`Broker-Ledger/js/config.js`](Broker-Ledger/js/config.js). Do not put account passwords or secrets in frontend files.

## Existing workbook summary

The earlier static summary page remains at [`reports/summary.html`](reports/summary.html), with its Markdown report at [`Broker_Ledger_Summary.md`](Broker_Ledger_Summary.md).
