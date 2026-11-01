# Changelog

## Unreleased

- Added TOBILLED received-payment history with audited administrator reversals; a reversal restores the shipment balance without deleting the original receipt.
- Kept POD Balance Amount / Status as a user-entered field, while showing derived payment status separately and leaving an empty field empty.
- Kept received-payment management available for fully paid shipments so administrators can review history and undo a mistaken receipt.
- Split ledger actions into independent columns and added receipt-status filtering.
- Improved the Bank/POD and received-payment summary layouts.
- Added dashboard Done/Pending counts with click-through filters; pending dashboard rows open the exact shipment in the Live Excel Sheet.
- Added received total, latest receipt date/mode, and payment status columns to the ledger and Live Excel Sheet.
- Enabled receipt management from both View and Edit forms; hides receipt-entry fields when no balance is available and shows the payment history instead.

## 1.0.0

- Created an independent Broker Ledger web application and Google Apps Script backend.
- Added shared calculation and validation modules, shipment CRUD, status filters, spreadsheet view, and Excel import/export.
- Added reference-fixture regression tests and setup/deployment documentation.
