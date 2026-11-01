'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
global.BrokerCalculations = require('../js/calculations.js');
const recovery = require('../js/recovery.js');

function transaction(amount, date, category, shipmentId) {
  return {
    shipmentId: shipmentId || 'shipment-1',
    category: category || 'pendingAmount',
    receivedAmount: amount,
    recoveryDate: date || '25-10-2026'
  };
}

test('no recoveries leave the original pending balance outstanding', function () {
  const balance = recovery.calculateBalance(10000, [], 'shipment-1', 'pendingAmount');
  assert.deepEqual(balance, {
    category: 'pendingAmount',
    categoryLabel: 'Pending Amount',
    originalPaise: 1000000,
    recoveredPaise: 0,
    remainingPaise: 1000000,
    status: 'PENDING'
  });
});

test('partial and full recoveries use exact paise and retain transaction dates', function () {
  const first = transaction('4,000.01');
  const balance = recovery.calculateBalance(10000, [first], 'shipment-1', 'pendingAmount');
  assert.equal(balance.recoveredPaise, 400001);
  assert.equal(balance.remainingPaise, 599999);
  assert.equal(balance.status, 'PARTIALLY RECEIVED');
  assert.equal(first.recoveryDate, '25-10-2026');

  const full = recovery.calculateBalance(10000, [
    first, transaction(2000), transaction(3999.99)
  ], 'shipment-1', 'pendingAmount');
  assert.equal(full.remainingPaise, 0);
  assert.equal(full.status, 'FULLY RECEIVED');
});

test('recovery categories and shipments remain independent', function () {
  const recoveries = [
    transaction(4000, '', 'pendingTobilled'),
    transaction(2500, '', 'pendingAmount'),
    transaction(5000, '', 'pendingAmount', 'shipment-2')
  ];
  assert.equal(recovery.calculateBalance(10000, recoveries, 'shipment-1', 'pendingTobilled').remainingPaise, 600000);
  assert.equal(recovery.calculateBalance(10000, recoveries, 'shipment-1', 'pendingAmount').remainingPaise, 750000);
  assert.equal(recovery.calculateBalance(10000, recoveries, 'shipment-2', 'pendingAmount').remainingPaise, 500000);
});

test('a reversal is a separate negative audit transaction and restores the balance', function () {
  const original = transaction(4000);
  const reversal = Object.assign({}, transaction(-4000), {
    type: 'REVERSAL',
    reversalOf: 'recovery-1'
  });
  const balance = recovery.calculateBalance(10000, [original, reversal], 'shipment-1', 'pendingAmount');
  assert.equal(balance.recoveredPaise, 0);
  assert.equal(balance.remainingPaise, 1000000);
  assert.equal(balance.status, 'PENDING');
});

test('settlement summary subtracts each category independently and excludes fully settled amounts', function () {
  const record = {
    id: 'shipment-1',
    toPayStatus: 'TOBILLED',
    freight: 10000,
    tM: 0,
    advance: 0,
    advance2: 0,
    advance3: 0,
    extraAmount: 0,
    pM: 0
  };
  const summary = recovery.summarize([record], [
    transaction(5000, '', 'pendingTobilled'),
    transaction(10000, '', 'pendingAmount')
  ]);
  assert.equal(summary.pendingTobilledPaise, 500000);
  assert.equal(summary.pendingAmountPaise, 0);
});

test('over-recovery remains visible as an integrity error, not a false zero balance', function () {
  const balance = recovery.calculateBalance(10000, [transaction(10001)], 'shipment-1', 'pendingAmount');
  assert.equal(balance.remainingPaise, -100);
  assert.equal(balance.status, 'OVER-RECOVERED');
});

test('unsupported categories and invalid transaction amounts are rejected', function () {
  assert.throws(function () {
    recovery.calculateBalance(10000, [], 'shipment-1', 'codToPay');
  }, /Unsupported recovery category/);
  assert.throws(function () {
    recovery.calculateBalance(10000, [transaction('not money')], 'shipment-1', 'pendingAmount');
  }, /invalid received amount/);
});
