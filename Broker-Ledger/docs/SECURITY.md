# Security Notes

- No default accounts, passwords, API tokens, or sample production data are included.
- Usernames/passwords are configured in the private Apps Script Script Properties, not frontend files. Script editors can access those properties and must be trusted.
- Passwords are checked on the server. Login attempts are limited globally, and tokens are generated and validated by the server with an eight-hour expiration.
- Every shipment read/write except sign-in requires a valid server session. Employees cannot delete records or create Drive backups; those operations are enforced again on the backend.
- The Apps Script endpoint is public at the HTTP layer when deployed for external browser access. Use strong, unique credentials and the narrowest Apps Script access scope your organization can support. Never expose a user's password in source or query strings.
- Use HTTPS for the hosted frontend. Treat account numbers and IFSC values as sensitive and restrict spreadsheet and Drive access.
- Dynamic content is HTML-escaped. The import library runs locally; runtime assets do not require a third-party CDN.
- The `?preview=1` mode only shows an empty, read-only UI shell while no API URL is configured. It contains no records, does not create a session, and is not an authentication fallback.
- Browser `sessionStorage` contains a short-lived session token. Protect the device and log out when finished.
- Manual edits to backend spreadsheet rows should be avoided; the server treats invalid/corrupt records as errors rather than silently dropping them.

This small application has not undergone an independent security audit. Review the Apps Script deployment and organizational data-handling requirements before storing financial/account data.
