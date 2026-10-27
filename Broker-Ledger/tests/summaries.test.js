'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calculations.js');
const fixtures = require('./fixtures/reference-shipments.json');

test('reference reconciliation totals are dynamic from the fixture records', function () {
  const summary = calc.summarize(fixtures);
  assert.equal(summary.shipmentCount, 4);
  assert.deepEqual(summary.statusCounts, { 'TOBILLED': 2, 'A/TO-PAY': 1, 'F/TO-PAY': 1 });
  assert.equal(summary.freightPaise, 25200000);
  assert.equal(summary.advancePaise, 14920000);
  assert.equal(summary.tMPaise, 80000);
  assert.equal(summary.pMPaise, 50000);
  assert.equal(summary.extraAmountPaise, 500000);
  assert.equal(summary.pendingTobilledPaise, 2000000);
  assert.equal(summary.pendingAmountPaise, 2450000);
  assert.equal(summary.codToPayPaise, 8200000);
});

test('text COD placeholders are excluded while numeric strings are counted', function () {
  const summary = calc.summarize(fixtures);
  assert.equal(summary.codToPayPaise, 8200000);
});

test('non-shipment rows and unsupported statuses are not counted', function () {
  const summary = calc.summarize(fixtures.concat([
    { slNo: 'SL NO', toPayStatus: 'ToPayStatus', freight: 123 },
    { id: 'bad', toPayStatus: 'OTHER', freight: '100' }
  ]));
  assert.equal(summary.shipmentCount, 4);
});
