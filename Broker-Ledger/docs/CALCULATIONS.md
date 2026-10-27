# Calculation Rules

## Safe amounts

`parseMoney()` accepts numeric values, plain digit strings, Western comma groups (`1,200,000`), Indian groups (`1,20,000`), a leading `₹`, a leading sign, and up to two decimal places. Money is converted to integer paise before arithmetic. Optional blank T/M, advance, Extra Amount, and P/M values calculate as zero. Invalid, non-empty values are errors and are not coerced to zero.

## Derived fields

For `TOBILLED`:

```text
Pending Amount: Tobilled = FRIGHT - T/M - ADVANCE - ADVANCE2 - ADVANCE3
Pending Amount = Pending Amount: Tobilled + Extra Amount - P/M
```

For `A/TO-PAY` and `F/TO-PAY`, final Pending Amount is zero. Pending Amount: Tobilled is left blank for those statuses; their freight, advances, and COD / To-Pay input are not changed by calculation.

No automatic floor is applied. A negative result remains negative.

## COD / To-Pay

The entered source value is preserved. A numeric amount contributes to the total; a textual note such as `if Tobilled NA` is not numeric and does not contribute. The application does not infer a COD value.

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
