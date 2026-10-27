# Deployment and Setup

## Local UI preview

Run Python's static server from the repository root (`D:\Repo\SR_B`) and open `http://127.0.0.1:8123/?preview=1`. The root `index.html` loads this folder's app assets. This is a read-only, empty preview, not a local database, login, or production mode.

## Create an independent Apps Script backend

1. Sign in to the Google account that should own the new database and create a new standalone Apps Script project. Do not copy the SR_T project or its Script Properties.
2. Copy `Broker-Ledger/backend/Code.gs` into the new project's `Code.gs`.
3. In **Project Settings → Script Properties**, add these private properties:

   | Property | Value |
   |---|---|
   | `ADMIN_USERNAME` | A new administrator username |
   | `ADMIN_PASSWORD` | A new unique password of at least 12 characters |
   | `EMPLOYEE_USERNAME` | A different employee username |
   | `EMPLOYEE_PASSWORD` | A different unique password of at least 12 characters |

   Do not use passwords from the reference project. Do not place account values in project source files.
4. In the Apps Script editor, run `setupBrokerLedger()` and authorize the requested spreadsheet access. It creates a new `Broker Ledger Data` spreadsheet and stores its ID in Script Properties. Keep the spreadsheet private to authorized data administrators.
5. Use **Deploy → New deployment → Web app**. Choose the organization's approved access setting and run it as the spreadsheet-owning deployment account. Copy the resulting `/exec` URL.
6. Add the URL to `apiUrl` in `Broker-Ledger/js/config.js`. Do not add a shared API password or a user's login password there.
7. Serve the repository root over HTTPS for normal use. GitHub Pages hosts the frontend at the repository root; it does not host the Apps Script backend, which is a separate service.
8. Sign in with the two accounts configured in Script Properties. Test with non-sensitive data first.

The Web App may need to be reachable by both users for Google Apps Script's Web App endpoint to receive requests. The endpoint does not expose data without a valid server-issued session token, but the login endpoint itself is public and rate-limited per username. Confirm the deployment's access setting with your organization's administrator before using account/bank data.

## Updating and backups

- To update backend code, save the Apps Script project, create a **new version**, and update the deployment. The spreadsheet ID and records remain stored in Script Properties and the existing spreadsheet.
- The app's administrator backup operation creates a dated copy of the Google spreadsheet in the deployment owner's Drive. Verify that Drive permissions and retention meet your needs.
- To restore, use Google Drive/Sheets to recover a backup. This project intentionally does not expose an unauthenticated restore endpoint.

## GitHub Pages

The repository-root `index.html` is the Broker Ledger application entry point. The previous workbook summary is available at `reports/summary.html`, and the Markdown report remains at `Broker_Ledger_Summary.md`. Configure GitHub Pages to publish the `main` branch from the repository root.

The app's frontend and Google Apps Script backend are deployed separately. Add the Apps Script `/exec` URL to `Broker-Ledger/js/config.js`, commit that URL-only configuration, and redeploy the static site. Never commit account credentials or Script Properties.
