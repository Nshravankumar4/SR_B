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
