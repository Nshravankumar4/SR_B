'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
global.BrokerCalculations = require('../js/calculations.js');
const validation = require('../js/validation.js');

const valid = {
  transportName: 'Example Transport',
  date: '2026-10-27',
  lrNo: 'LR-100',
  truckNo: 'AP00AA0000',
  from: 'Origin',
  to: 'Destination',
  freight: '60,000',
  toPayStatus: 'TOBILLED',
  tM: '',
  advance: '',
  advance2: '',
  advance3: '',
  extraAmount: '',
  pM: '',
  codToPay: 'if Tobilled NA'
};

test('valid source record passes and preserves COD text', function () {
  const result = validation.validateShipment(valid);
  assert.equal(result.valid, true);
  assert.equal(valid.codToPay, 'if Tobilled NA');
  assert.equal(result.calculated.pendingAmount, 60000);
});

test('invalid monetary text is rejected instead of becoming zero', function () {
  const result = validation.validateShipment(Object.assign({}, valid, { advance: 'unknown' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.advance);
});

test('only the three specified statuses are accepted', function () {
  assert.equal(validation.validateShipment(Object.assign({}, valid, { toPayStatus: 'TO-PAY' })).valid, false);
  for (const status of global.BrokerCalculations.STATUS) {
    assert.equal(validation.validateShipment(Object.assign({}, valid, { toPayStatus: status })).valid, true);
  }
});

test('dates must be real calendar dates', function () {
  assert.equal(validation.validateShipment(Object.assign({}, valid, { date: '2026-02-30' })).valid, false);
});
