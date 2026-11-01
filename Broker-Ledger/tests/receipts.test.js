'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
global.BrokerCalculations = require('../js/calculations.js');
const receipts = require('../js/receipts.js');

test('TOBILLED receipts reduce only their shipment final pending amount', function () {
  const record = {
    id: 'shipment-1', toPayStatus: 'TOBILLED', freight: '10,000',
    tM: '', advance: '', advance2: '', advance3: '', extraAmount: '', pM: ''
  };
  const balance = receipts.calculateBalance(10000, [
    { shipmentId: 'shipment-1', receivedAmount: 4000 },
    { shipmentId: 'shipment-2', receivedAmount: 5000 }
  ], record.id);
  assert.equal(balance.originalPaise, 1000000);
  assert.equal(balance.receivedPaise, 400000);
  assert.equal(balance.remainingPaise, 600000);
  assert.equal(receipts.summarize([record], [
    { shipmentId: 'shipment-1', receivedAmount: 10000 }
  ]).pendingAmountPaise, 0);
});

test('receipts do not reduce A/TO-PAY or F/TO-PAY balances', function () {
  const record = {
    id: 'to-pay-shipment', toPayStatus: 'A/TO-PAY', freight: '5,000',
    tM: '', advance: '1,000', advance2: '250', advance3: '', codToPay: ''
  };
  assert.equal(receipts.summarize([record], [
    { shipmentId: record.id, receivedAmount: 250 }
  ]).pendingAmountPaise, 25000);
});

test('an audited reversal restores the original receipt amount without deleting history', function () {
  const balance = receipts.calculateBalance(10000, [
    { id: 'receipt-1', shipmentId: 'shipment-1', receivedAmount: 10000 },
    {
      id: 'reversal-1', type: 'REVERSAL', reversalOf: 'receipt-1',
      shipmentId: 'shipment-1', receivedAmount: 10000
    }
  ], 'shipment-1');
  assert.equal(balance.originalPaise, 1000000);
  assert.equal(balance.receivedPaise, 0);
  assert.equal(balance.remainingPaise, 1000000);
});

test('receipt balance preserves zero and negative calculated outcomes', function () {
  assert.equal(receipts.calculateBalance(0, [], 'shipment-1').remainingPaise, 0);
  assert.equal(receipts.calculateBalance(100, [
    { shipmentId: 'shipment-1', receivedAmount: 125 }
  ], 'shipment-1').remainingPaise, -2500);
});

test('invalid receipt amounts are reported instead of treated as zero', function () {
  assert.throws(function () {
    receipts.calculateBalance(100, [
      { shipmentId: 'shipment-1', receivedAmount: 'bad' }
    ], 'shipment-1');
  }, /invalid received amount/);
});
