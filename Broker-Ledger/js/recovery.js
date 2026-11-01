(function (root) {
  'use strict';

  const CATEGORIES = Object.freeze({
    pendingTobilled: 'Pending Amount: Tobilled',
    pendingAmount: 'Pending Amount'
  });

  function calculateBalance(originalPending, recoveries, shipmentId, category) {
    if (!Object.prototype.hasOwnProperty.call(CATEGORIES, category)) {
      throw new Error('Unsupported recovery category.');
    }
    const original = root.BrokerCalculations.parseMoney(originalPending);
    if (!original.ok) throw new Error('Original pending amount is invalid.');

    let recoveredPaise = 0;
    (recoveries || []).forEach(function (recovery) {
      if (!recovery || recovery.shipmentId !== shipmentId || recovery.category !== category) return;
      const received = root.BrokerCalculations.parseMoney(recovery.receivedAmount);
      const type = recovery.type || 'RECOVERY';
      if (!received.ok || (type === 'RECOVERY' && received.paise <= 0) ||
          (type === 'REVERSAL' && (received.paise >= 0 || !recovery.reversalOf)) ||
          (type !== 'RECOVERY' && type !== 'REVERSAL')) {
        throw new Error('A recovery transaction has an invalid received amount or transaction type.');
      }
      recoveredPaise += received.paise;
    });

    const remainingPaise = original.paise - recoveredPaise;
    return {
      category: category,
      categoryLabel: CATEGORIES[category],
      originalPaise: original.paise,
      recoveredPaise: recoveredPaise,
      remainingPaise: remainingPaise,
      status: recoveredPaise < 0 ? 'OVER-REVERSED'
        : recoveredPaise > original.paise ? 'OVER-RECOVERED'
        : remainingPaise === 0 ? 'FULLY RECEIVED'
          : recoveredPaise > 0 ? 'PARTIALLY RECEIVED'
            : original.paise <= 0 ? 'NO POSITIVE BALANCE' : 'PENDING'
    };
  }

  function summarize(records, recoveries) {
    const summary = root.BrokerCalculations.summarize(records);
    (records || []).forEach(function (record) {
      if (!record || root.BrokerCalculations.normalizeStatus(record.toPayStatus) !== 'TOBILLED') return;
      const calculation = root.BrokerCalculations.calculateShipment(record);
      if (Object.keys(calculation.errors).length) return;
      summary.pendingTobilledPaise -= calculateBalance(
        calculation.pendingTobilled, recoveries, record.id, 'pendingTobilled'
      ).recoveredPaise;
      summary.pendingAmountPaise -= calculateBalance(
        calculation.pendingAmount, recoveries, record.id, 'pendingAmount'
      ).recoveredPaise;
    });
    return summary;
  }

  root.BrokerRecovery = Object.freeze({
    CATEGORIES: CATEGORIES,
    calculateBalance: calculateBalance,
    summarize: summarize
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BrokerRecovery;
})(typeof window !== 'undefined' ? window : globalThis);
