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
| `advance`, `advance2`, `advance3` | ADVANCE, ADVANCE2, ADVANCE3 | Source advance amounts |
| `podReceivedDate` | POD RECD Date | POD date or blank |
| `codToPay` | Cash on Delivery (COD) :A/Topay&Ftopay | Numeric COD/To-Pay amount or preserved text |
| `pendingTobilled` | Pending Amount: Tobilled | Derived pre-extra/pre-P/M amount for TOBILLED |
| `extraAmount` | Extra Amount | Source adjustment |
| `pmPaDate` | PM/PA Date | P/M or P/A date |
| `pM` | P/M | Source payment amount |
| `pendingAmount` | Pending Amount | Final derived balance |
| `podAmountStatus` | POD Amount Status | POD/amount status text |
| `remarks` | REMARKS / NOTE | Notes |
| `toPayStatus` | ToPayStatus | One of the three allowed statuses |

`Pending Amount: Tobilled` and `Pending Amount` are independent fields. The former is freight less T/M and all three advances; the latter also applies Extra Amount and P/M for TOBILLED shipments.

Records have a stable backend-generated `id`, and audit metadata (`createdAt`, `updatedAt`, `createdBy`) is maintained outside the user-editable form.
