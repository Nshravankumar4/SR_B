# Broker Ledger — Full Report

## Source and scope

- **Source workbook:** `Final Sheet Broker.xlsx`
- **Source worksheet:** `Broker Ledger`
- **Checked workbook:** `Broker_Ledger_Checked.xlsx`
- **Records included:** 4 shipments
- **Layout in the checked workbook:** shipments grouped by `ToPayStatus` as `TOBILLED`, `A/TO-PAY`, and `F/TO-PAY`; the source column headers are repeated before each group.

This report follows that grouped Excel view. Blank rows and repeated header rows are not counted as shipments.

## Calculation summary

| Metric | Calculation basis | Total |
|---|---|---:|
| Freight | Sum of all 4 `FRIGHT` values | ₹2,52,000 |
| Advance | Sum of `ADVANCE` values; `ADVANCE2` and `ADVANCE3` are all zero | ₹1,49,200 |
| T/M | Sum of numeric `T/M` values | ₹800 |
| P/M | Sum of numeric `P/M` values | ₹500 |
| Pending Amount: Tobilled | Numeric values in that column; text placeholders excluded | ₹20,000 |
| Extra Amount | Sum of `Extra Amount` | ₹5,000 |
| Pending Amount | Sum of the formula-calculated `Pending Amount` column | ₹24,500 |
| Numeric COD / To-Pay | Sum of numeric COD values; text placeholders excluded | ₹82,000 |

### How the balance values are calculated

The source worksheet uses formulas for the calculated amount fields:

- **Pending Amount: Tobilled** — freight less T/M and the three advance columns. For the two `TOBILLED` shipments, this is ₹10,000 each.
- **Pending Amount** for `TOBILLED` — `Pending Amount: Tobilled` plus `Extra Amount` less `P/M`:
  - SL No 1: ₹10,000 + ₹0 − ₹200 = **₹9,800**
  - SL No 2: ₹10,000 + ₹5,000 − ₹300 = **₹14,700**
- **COD / To-Pay amount** — the numeric COD values are ₹40,000 for SL No 4 and ₹42,000 for SL No 3. Together they total **₹82,000**.
- The `A/TO-PAY` and `F/TO-PAY` rows have ₹0 in the calculated `Pending Amount` column.

`Pending Amount: Tobilled` and `Pending Amount` are separate columns and should not be treated as the same measure. The total ₹20,000 in the former column is the pre-extra/pre-P/M amount for the two billed shipments; ₹24,500 is the final pending total after applying the `Extra Amount` and `P/M` entries.

## Status breakdown

| ToPayStatus | Shipment count | Freight | Advance | Numeric COD / To-Pay | Pending Amount |
|---|---:|---:|---:|---:|---:|
| TOBILLED | 2 | ₹1,20,000 | ₹99,400 | Not numeric in source | ₹24,500 |
| A/TO-PAY | 1 | ₹90,000 | ₹49,800 | ₹40,000 | ₹0 |
| F/TO-PAY | 1 | ₹42,000 | ₹0 | ₹42,000 | ₹0 |
| **Total** | **4** | **₹2,52,000** | **₹1,49,200** | **₹82,000** | **₹24,500** |

## TOBILLED shipments

| SL No | Transport name | Date | LR No | Truck No | From | To | Account No | IFSC | Bank | Freight | T/M | Advance | Advance 2 / 3 | POD received | COD / To-Pay | Pending Amount: Tobilled | Extra Amount | PM/PA Date | P/M | Pending Amount | POD Amount Status | Remarks |
|---:|---|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---:|---:|---|---:|---:|---:|---|
| 1 | ANTP SAINATH | 20-08-2026 | 207 | AP39UD3564 | LUCKNOW | MEDCHAL | 38216860303 | SBIN0010659 | SBI BANK | ₹60,000 | ₹300 | ₹49,700 | ₹0 / ₹0 | 20-08-2026 | `if Tobilled NA` | ₹10,000 | ₹0 | 28-08-2026 | ₹200 | ₹9,800 | 0 | — |
| 2 | SARITHA TRSP | 03-09-2026 | 208 | TG15T6666 | RAIPUR | MEDCHAL | 0312035592 | KKBK0008406 | KKBK BANK | ₹60,000 | ₹300 | ₹49,700 | ₹0 / ₹0 | 07-09-2026 | `if Tobilled NA` | ₹10,000 | ₹5,000 | 29-08-2026 | ₹300 | ₹14,700 | 0 | Halted |

## A/TO-PAY shipment

| SL No | Transport name | Date | LR No | Truck No | From | To | Account No | IFSC | Bank | Freight | T/M | Advance | Advance 2 / 3 | POD received | COD / To-Pay | Pending Amount: Tobilled | Extra Amount | PM/PA Date | P/M | Pending Amount | POD Amount Status | Remarks |
|---:|---|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---:|---|---:|---|---:|---:|---:|---|
| 4 | SARITHA TRSP | 01-10-2026 | 196 | TG15T6666 | MEDCHAL | MADHAPURA | 0312035592 | KKBK0008406 | KKBK BANK | ₹90,000 | ₹200 | ₹49,800 | ₹0 / ₹0 | 19-10-2026 | ₹40,000 | `if A/Topay&Ftopay Na` | ₹0 | 31-08-2026 | ₹0 | ₹0 | 0 | — |

## F/TO-PAY shipment

| SL No | Transport name | Date | LR No | Truck No | From | To | Account No | IFSC | Bank | Freight | T/M | Advance | Advance 2 / 3 | POD received | COD / To-Pay | Pending Amount: Tobilled | Extra Amount | PM/PA Date | P/M | Pending Amount | POD Amount Status | Remarks |
|---:|---|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|---|---:|---|---:|---|---:|---:|---:|---|
| 3 | CG RANCHI R/WAYS | 29-09-2026 | 195 | CG08AZ4714 | MEDCHAL | PANKANJUR | 29122900001083 | DCBL0000291 | DCB BANK | ₹42,000 | ₹0 | ₹0 | ₹0 / ₹0 | Pending | ₹42,000 | `if A/Topay&Ftopay Na` | ₹0 | 30-08-2026 | ₹0 | ₹0 | 0 | F/TO-PAY Shipment |

## Reconciliation checks

| Check | Expected / calculated result |
|---|---:|
| TOBILLED record count | 2 |
| A/TO-PAY record count | 1 |
| F/TO-PAY record count | 1 |
| Total shipment count | 4 |
| Freight total | ₹2,52,000 |
| Advance total | ₹1,49,200 |
| P/M total | ₹500 |
| Pending Amount total | ₹24,500 |
| Numeric COD / To-Pay total | ₹82,000 |

## Follow-up notes

- **SL No 2** is marked `Halted`; check its status and resolve the ₹14,700 pending amount.
- **SL No 3** has POD received marked `Pending` and is labelled `F/TO-PAY Shipment`; follow up on POD and settlement.
- **SL No 4** is marked `A/TO-PAY` and has ₹40,000 recorded as COD / To-Pay.
- For SL Nos 1 and 2, the COD cell contains the text `if Tobilled NA`, not a numeric amount; it is therefore excluded from COD totals.
- The source contains formula cells. The checked workbook requests recalculation when opened in Excel; displayed formula results may depend on the spreadsheet application recalculating the workbook.

## Conclusion

The four listed shipments have a combined freight value of **₹2,52,000** and advance value of **₹1,49,200**. The two `TOBILLED` entries account for the full **₹24,500** Pending Amount (₹9,800 and ₹14,700). Numeric COD / To-Pay amounts on the `A/TO-PAY` and `F/TO-PAY` entries total **₹82,000**. The separate `Pending Amount: Tobilled` column totals **₹20,000**, before the extra amount and P/M adjustments reflected in the final Pending Amount.
