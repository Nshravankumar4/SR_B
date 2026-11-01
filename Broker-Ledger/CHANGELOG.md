# Changelog

## Unreleased

- Enforced unique LR Nos across shipments, with a live form warning, submit-time rejection, import duplicate detection, and backend validation.
- Added live received-payment previews that update Received, Remaining, and Status while entering an amount; previews are not saved before submission.
- Added TOBILLED received-payment history with audited reversals; a reversal restores the shipment balance without deleting the original receipt.
- Kept legacy POD Amount Status data for import/edit compatibility while removing its form and spreadsheet display; payment status remains separately calculated.
- Kept received-payment management available for fully paid shipments so signed-in users can review history and undo a mistaken payment.
- Split ledger actions into independent columns and added receipt-status filtering.
- Improved the Bank/POD and received-payment summary layouts.
- Added dashboard Done/Pending counts with click-through filters; pending dashboard rows open the exact shipment in the Live Excel Sheet.
- Added received total, latest receipt date/mode, and payment status columns to the ledger and Live Excel Sheet.
- Added the same receipt-summary columns to styled Excel downloads, including payment-status colors.
- Enabled receipt management from both View and Edit forms; hides receipt-entry fields when no balance is available and shows the payment history instead.

## 1.0.0

- Created an independent Broker Ledger web application and Google Apps Script backend.
- Added shared calculation and validation modules, shipment CRUD, status filters, spreadsheet view, and Excel import/export.
- Added reference-fixture regression tests and setup/deployment documentation.
