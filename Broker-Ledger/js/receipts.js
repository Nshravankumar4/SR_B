(function (root) {
  'use strict';

  function calculateBalance(originalPending, receipts, shipmentId) {
    const original = root.BrokerCalculations.parseMoney(originalPending);
    if (!original.ok) throw new Error('Shipment pending amount is invalid.');
    let receivedPaise = 0;
    (receipts || []).forEach(function (receipt) {
      if (!receipt || receipt.shipmentId !== shipmentId) return;
      const amount = root.BrokerCalculations.parseMoney(receipt.receivedAmount);
      if (!amount.ok || amount.paise <= 0) throw new Error('Receipt contains an invalid received amount.');
      receivedPaise += amount.paise;
    });
    const remainingPaise = original.paise - receivedPaise;
    return {
      originalPaise: original.paise,
      receivedPaise: receivedPaise,
      remainingPaise: remainingPaise,
      status: remainingPaise < 0 ? 'OVER-RECEIVED' : remainingPaise === 0 ? 'PAID' : receivedPaise ? 'PARTIAL' : 'PENDING'
    };
  }

  function summarize(records, receipts) {
    const summary = root.BrokerCalculations.summarize(records);
    (records || []).forEach(function (record) {
      if (!record || root.BrokerCalculations.normalizeStatus(record.toPayStatus) !== 'TOBILLED') return;
      const calculation = root.BrokerCalculations.calculateShipment(record);
      if (Object.keys(calculation.errors).length) return;
      const balance = calculateBalance(calculation.pendingAmount, receipts, record.id);
      summary.pendingAmountPaise += balance.remainingPaise - balance.originalPaise;
    });
    return summary;
  }

  const api = Object.freeze({ calculateBalance: calculateBalance, summarize: summarize });
  root.BrokerReceipts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
