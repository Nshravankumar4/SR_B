'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calculations.js');
const fixtures = require('./fixtures/reference-shipments.json');

test('TOBILLED examples use source values, not stale derived values', function () {
  const first = calc.calculateShipment(fixtures[0]);
  const second = calc.calculateShipment(fixtures[1]);
  assert.equal(first.pendingTobilled, 10000);
  assert.equal(first.pendingAmount, 9800);
  assert.equal(second.pendingTobilled, 10000);
  assert.equal(second.pendingAmount, 14700);
});

test('A/TO-PAY and F/TO-PAY pending amounts are zero', function () {
  assert.equal(calc.calculateShipment(fixtures[2]).pendingAmount, 0);
  assert.equal(calc.calculateShipment(fixtures[3]).pendingAmount, 0);
  assert.equal(calc.calculateShipment(fixtures[2]).pendingTobilled, null);
});

test('A/TO-PAY and F/TO-PAY COD follows the workbook formula, not stale stored values', function () {
  const aToPay = Object.assign({}, fixtures[2], { codToPay: '999999' });
  const fToPay = Object.assign({}, fixtures[3], { codToPay: 'stale' });
  assert.equal(calc.calculateShipment(aToPay).codToPay, 40000);
  assert.equal(calc.calculateShipment(fToPay).codToPay, 42000);
});

test('To-Pay pending balance follows the workbook formula when ADVANCE2 or ADVANCE3 is nonzero', function () {
  const record = Object.assign({}, fixtures[2], { advance2: '1,000', advance3: '500' });
  const result = calc.calculateShipment(record);
  assert.equal(result.codToPay, 38500);
  assert.equal(result.pendingAmount, 1500);
});

test('status comparisons accept case and whitespace while returning canonical values', function () {
  assert.equal(calc.normalizeStatus('  a / to-pay '), 'A/TO-PAY');
  assert.equal(calc.calculateShipment(Object.assign({}, fixtures[2], { toPayStatus: ' a / to-pay ' })).codToPay, 40000);
});

test('invalid monetary inputs do not produce success-shaped calculated zeros', function () {
  const result = calc.calculateShipment(Object.assign({}, fixtures[2], { tM: 'not an amount' }));
  assert.equal(result.codToPay, null);
  assert.equal(result.pendingAmount, null);
  assert.ok(result.errors.tM);
});

test('parser accepts common currency formats and exact paise', function () {
  assert.equal(calc.parseMoney(60000).paise, 6000000);
  assert.equal(calc.parseMoney('60,000').paise, 6000000);
  assert.equal(calc.parseMoney('₹60,000').paise, 6000000);
  assert.equal(calc.parseMoney('1,20,000.50').paise, 12000050);
  assert.equal(calc.parseMoney('1,200,000.05').paise, 120000005);
  assert.equal(calc.parseMoney('-₹0.10').paise, -10);
});

test('empty optional values calculate as zero but invalid text is not zero', function () {
  assert.deepEqual(calc.parseMoney('', { allowEmpty: true }), { ok: true, empty: true, paise: 0 });
  assert.equal(calc.calculateShipment(fixtures[3]).pendingAmount, 0);
  assert.equal(calc.parseMoney('if Tobilled NA', { allowEmpty: true }).ok, false);
  assert.equal(calc.parseMoney('12,34', { allowEmpty: true }).ok, false);
});

test('status changes recalculate derived values without changing source COD', function () {
  const record = Object.assign({}, fixtures[0], { codToPay: 'if Tobilled NA' });
  const before = calc.calculateShipment(record);
  record.toPayStatus = 'A/TO-PAY';
  const after = calc.calculateShipment(record);
  assert.equal(before.pendingAmount, 9800);
  assert.equal(after.pendingAmount, 0);
  assert.equal(record.codToPay, 'if Tobilled NA');
});

test('source edits update pending balances', function () {
  const edited = Object.assign({}, fixtures[0], { extraAmount: '2,000', pM: '500' });
  const result = calc.calculateShipment(edited);
  assert.equal(result.pendingTobilled, 10000);
  assert.equal(result.pendingAmount, 11500);
});

test('negative pending results are preserved without a zero floor', function () {
  const record = Object.assign({}, fixtures[0], { advance: '70,000' });
  assert.equal(calc.calculateShipment(record).pendingAmount, -10500);
});
