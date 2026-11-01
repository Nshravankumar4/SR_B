# Data Model

## Allowed status values

`toPayStatus` accepts exactly `TOBILLED`, `A/TO-PAY`, or `F/TO-PAY`.

## Shipment fields

The UI, import/export headers, and API use the same underlying keys:

| Key | Display label | Meaning |
|---|---|---|
| `slNo` | SL NO | Display sequence number assigned by the backend |
| `transportName` | TRSP NAME | Transporter / broker name |
| `date` | DATE | Shipment date |
| `lrNo` | LR NO | Lorry receipt number |
| `truckNo` | TRUCK NO | Truck/vehicle identifier |
| `from`, `to` | FROM, TO | Origin and destination |
| `accountNo`, `ifscCode`, `bank` | ACCOUNT NO, IFSC CODE, PAYMENT MADE | Payment account details |
| `freight` | FRIGHT | Freight amount (source) |
| `tM` | T/M | T/M amount (source) |
| `advance` | ADVANCE | First advance amount |
| `date1` | 1ST ADV DATE | 1st Advance given date |
| `advance2` | ADVANCE2 | Second advance amount |
| `date2` | 2ND ADV DATE | 2nd Advance given date |
| `advance3` | ADVANCE3 | Third advance amount |
| `date3` | 3RD ADV DATE | 3rd Advance given date |
| `unloadingDate` | UNLOADING DATE | Independent unloading date (not combined with 1st advance date) |
| `podReceivedDate` | POD RECD Date | POD received date |
| `balanceDate` | BALANCE DATE | Balance payment date |
| `codToPay` | Cash on Delivery (COD) :A/Topay&Ftopay | Formula-derived for A/TO-PAY and F/TO-PAY; preserved note for TOBILLED |
| `pendingTobilled` | Pending Amount: Tobilled | Derived pre-extra/pre-P/M amount for TOBILLED |
| `extraAmount` | Extra Amount | Source adjustment |
| `pmPaDate` | PM/PA Date | P/M or P/A date |
| `pM` | P/M | Source payment amount |
| `pendingAmount` | Pending Amount | Final derived balance |
| `podAmountStatus` | Legacy POD Amount Status | Preserved for existing/imported records but hidden from form, ledger, Live Excel Sheet, and exports |
| `remarks` | REMARKS / NOTE | Notes |
| `toPayStatus` | ToPayStatus | One of the three allowed statuses |

`Pending Amount: Tobilled` and formula-derived `Pending Amount` are calculated fields. For TOBILLED, they follow the workbook formulas `FRIGHT - T/M - ADVANCE - ADVANCE2 - ADVANCE3` and `Pending Amount: Tobilled + Extra Amount - P/M`. For A/TO-PAY and F/TO-PAY, COD is `FRIGHT - T/M - ADVANCE - ADVANCE2 - ADVANCE3` and final Pending Amount is `FRIGHT - T/M - ADVANCE - COD`, equivalent to `ADVANCE2 + ADVANCE3`.

Records have a stable backend-generated `id`, and audit metadata (`createdAt`, `updatedAt`, `createdBy`) is maintained outside the user-editable form.

## Received payments

The separate `Receipts` tab is append-only and stores actual money received against TOBILLED shipments. The app displays their outstanding balance as formula-derived `Pending Amount` minus net receipts for that shipment; `Pending Amount: Tobilled` and all shipment source/formula values remain unchanged. The payment form previews the entered amount live but does not persist it until the user submits; the backend rejects amounts above the positive remaining balance. Any signed-in user can append one full reversal per receipt; the original entry remains in the audit history and is excluded from the net received total. Existing `Recoveries` tabs, if any, are not read, edited, or deleted.

The UI displays Received, Remaining, and a derived payment status separately from the legacy `podAmountStatus` field. The workbook's calculated zero for POD Amount Status is not copied into stored user data.

The dashboard and Live Excel Sheet derive payment status from the final remaining balance: exactly zero is `Done`, positive is `Pending`, and negative is `Credit balance`. The ledger and sheet show cumulative net received amount plus the latest non-reversed receipt date and mode. Dashboard status cards filter the sheet; each pending-payment row can open its exact shipment.
