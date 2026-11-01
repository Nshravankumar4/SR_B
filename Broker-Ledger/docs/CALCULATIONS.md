# Calculation Rules

## Safe amounts

`parseMoney()` accepts numeric values, plain digit strings, Western comma groups (`1,200,000`), Indian groups (`1,20,000`), a leading `₹`, a leading sign, and up to two decimal places. Money is converted to integer paise before arithmetic. Optional blank T/M, advance, Extra Amount, and P/M values calculate as zero. Invalid, non-empty values are errors and are not coerced to zero.

## Derived fields

The rules below were verified against the `Broker Ledger` sheet in `Final Sheet Broker.xlsx` (28 columns). For the sample rows in that workbook, the source formulas are `V2 = K2-N2-O2-Q2-S2`, `Z2 = V2+W2-Y2`, `U8 = K8-N8-O8-Q8-S8`, `Z8 = K8-N8-O8-U8`, `U12 = K12-N12-O12-Q12-S12`, and `Z12 = K12-N12-O12-U12`. Here K is FRIGHT, M is ToPayStatus, N is T/M, O/Q/S are ADVANCE/ADVANCE2/ADVANCE3, U is COD / To-Pay, V is Pending Amount: Tobilled, W is Extra Amount, Y is P/M, and Z is Pending Amount.

For `TOBILLED`:

```text
Pending Amount: Tobilled = FRIGHT - T/M - ADVANCE - ADVANCE2 - ADVANCE3
Pending Amount = Pending Amount: Tobilled + Extra Amount - P/M
```

For `A/TO-PAY` and `F/TO-PAY`, COD / To-Pay is calculated as `FRIGHT - T/M - ADVANCE - ADVANCE2 - ADVANCE3`. Final Pending Amount is `FRIGHT - T/M - ADVANCE - COD`; this evaluates to `ADVANCE2 + ADVANCE3`, and is zero for the current workbook rows because both fields are zero. Pending Amount: Tobilled is left blank for those statuses.

No automatic floor is applied. A negative result remains negative.

## Pending recovery ledger

Recovery is a separate transaction ledger; it never replaces source shipment amounts or derived calculation fields. The selected recovery categories are the two TOBILLED outputs above, tracked independently:

- `pendingTobilled`: Pending Amount: Tobilled, before Extra Amount and P/M.
- `pendingAmount`: final Pending Amount, after Extra Amount and P/M.

These are overlapping calculation bases, not additive liabilities. The dashboard and party report display them separately and do not calculate one combined recovery total. Recovery is currently restricted to TOBILLED shipments; COD / To-Pay and A/TO-PAY/F/TO-PAY balances are not recovery categories.

For each category:

```text
Remaining Pending = current calculated category amount - signed recovery transactions
```

Amounts are stored as rupees and calculated in integer paise. A positive recovery is checked against the current outstanding amount by the server while holding the Apps Script lock. Duplicate requests use an idempotency key. A correction appends a negative REVERSAL linked to the original recovery; existing recovery rows are never overwritten or deleted. Changing a shipment so that existing recoveries exceed its newly calculated amount is rejected.

The shipment form and JSON record continue to hold the original formula-derived amounts. The ledger, dashboard, pending filters, and Excel export display outstanding amounts after net recoveries; the recovery dialog and transaction snapshots retain the original amount, recovered total, and remaining amount for each category.

The `Recoveries` sheet is separate from the existing JSON-backed `Shipments` sheet. Each row has readable recovery columns plus a JSON snapshot containing the exact transaction, idempotency key, category, shipment, party, received date, mode, reference, amount, remaining amount, status, remarks, and audit metadata.

## COD / To-Pay

For A/TO-PAY and F/TO-PAY, the server and client independently calculate COD / To-Pay from source amounts; a stale imported COD value is not trusted. For TOBILLED, the workbook contains explanatory text such as `if Tobilled NA`, which is preserved as a user-entered note. Numeric COD values contribute to the total; text placeholders do not.

## Summary

The summary recalculates derived values for each valid shipment, counts only the three supported statuses, and excludes malformed/non-shipment objects. Dashboard totals are over all records; the table and sheet view may show filtered record totals.

## Reference regression fixture

The four examples in `tests/fixtures/reference-shipments.json` assert:

| Metric | Expected |
|---|---:|
| Shipment count | 4 |
| TOBILLED / A/TO-PAY / F/TO-PAY | 2 / 1 / 1 |
| Total FRIGHT | ₹2,52,000 |
| Total ADVANCE (all three fields) | ₹1,49,200 |
| Total T/M | ₹800 |
| Total P/M | ₹500 |
| Total Extra Amount | ₹5,000 |
| Pending Amount: Tobilled | ₹20,000 |
| Final Pending Amount | ₹24,500 |
| Numeric COD / To-Pay | ₹82,000 |

The fixture's A/TO-PAY and F/TO-PAY COD expectations are ₹40,000 and ₹42,000, respectively, independently computed from their workbook source amounts. A separate regression uses nonzero ADVANCE2 / ADVANCE3 to verify the corresponding To-Pay pending formula.
