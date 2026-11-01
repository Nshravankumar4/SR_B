'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

class MockRange {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }
  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        (this.sheet.rows[this.row + rowOffset - 1] || [])[this.column + columnOffset - 1] || ''
      )
    );
  }
  setValues(values) {
    values.forEach((row, rowOffset) => {
      const target = this.sheet.rows[this.row + rowOffset - 1] || [];
      row.forEach((value, columnOffset) => { target[this.column + columnOffset - 1] = value; });
      this.sheet.rows[this.row + rowOffset - 1] = target;
    });
    return this;
  }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
}

class MockSheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.rows[index].some(function (value) { return value !== '' && value !== null && value !== undefined; })) return index + 1;
    }
    return 0;
  }
  getRange(row, column, rowCount, columnCount) {
    if (typeof row === 'string') return new MockRange(this, 1, 1, 1, 1);
    return new MockRange(this, row, column, rowCount, columnCount);
  }
  setFrozenRows() {}
  appendRow(row) { this.rows.push(row); }
}

class MockSpreadsheet {
  constructor(shipment) {
    this.sheets = {
      Shipments: new MockSheet('Shipments')
    };
    this.sheets.Shipments.appendRow(['ID', 'RECORD_JSON', 'CREATED_AT', 'UPDATED_AT', 'CREATED_BY']);
    this.sheets.Shipments.appendRow([shipment.id, JSON.stringify(shipment), shipment.createdAt, shipment.updatedAt, shipment.createdBy]);
  }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) {
    this.sheets[name] = new MockSheet(name);
    return this.sheets[name];
  }
}

function setup() {
  let uuid = 0;
  const context = vm.createContext({
    console: console,
    Utilities: { getUuid: function () { uuid += 1; return '00000000-0000-4000-8000-' + String(uuid).padStart(12, '0'); } }
  });
  const code = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8');
  vm.runInContext(code, context, { filename: 'Code.gs' });
  context.brokerAudit_ = function () { return ''; };
  context.brokerBumpVersion_ = function () {};
  const shipment = {
    id: 'shipment-1', slNo: 1, transportName: 'Example Transport', lrNo: 'LR-100',
    truckNo: 'AP00AA0000', date: '25-10-2026', freight: '10,000', tM: '',
    advance: '', advance2: '', advance3: '', extraAmount: '', pM: '',
    toPayStatus: 'TOBILLED', codToPay: '', createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z', createdBy: 'Admin'
  };
  const spreadsheet = new MockSpreadsheet(shipment);
  const session = { username: 'Admin' };
  const idempotencyKey = '12345678-1234-4234-8234-123456789abc';
  return { context, spreadsheet, session, idempotencyKey };
}

function request(key, amount, overrides) {
  return Object.assign({
    idempotencyKey: key,
    shipmentId: 'shipment-1',
    category: 'pendingAmount',
    receivedAmount: amount,
    receivedDate: '2026-10-25',
    paymentMode: 'UPI',
    transactionReference: '',
    remarks: ''
  }, overrides || {});
}

test('backend records partial and full recoveries with actual dates and exact balances', function () {
  const env = setup();
  const first = env.context.brokerCreateRecovery_(env.spreadsheet, env.session, request(env.idempotencyKey, 4000)).recovery;
  assert.equal(first.originalPending, 10000);
  assert.equal(first.remainingPending, 6000);
  assert.equal(first.recoveryStatus, 'PARTIALLY RECEIVED');
  assert.equal(first.recoveryDate, '25-10-2026');

  const second = env.context.brokerCreateRecovery_(env.spreadsheet, env.session,
    request('22345678-1234-4234-8234-123456789abc', 6000)).recovery;
  assert.equal(second.remainingPending, 0);
  assert.equal(second.recoveryStatus, 'FULLY RECEIVED');
  assert.equal(env.context.brokerReadRecoveries_(env.spreadsheet.getSheetByName('Recoveries')).length, 2);
});

test('backend idempotency returns the original payment without appending a duplicate', function () {
  const env = setup();
  const payment = request(env.idempotencyKey, 4000);
  const first = env.context.brokerCreateRecovery_(env.spreadsheet, env.session, payment);
  const retry = env.context.brokerCreateRecovery_(env.spreadsheet, env.session, payment);
  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.recovery.id, first.recovery.id);
  assert.equal(env.context.brokerReadRecoveries_(env.spreadsheet.getSheetByName('Recoveries')).length, 1);
  assert.throws(function () {
    env.context.brokerCreateRecovery_(env.spreadsheet, env.session, request(env.idempotencyKey, 3000));
  }, /already used for different payment data/);
});

test('backend prevents reusing a transaction reference on another category', function () {
  const env = setup();
  env.context.brokerCreateRecovery_(env.spreadsheet, env.session, request(env.idempotencyKey, 1000, {
    category: 'pendingTobilled',
    transactionReference: 'UTR-100'
  }));
  assert.throws(function () {
    env.context.brokerCreateRecovery_(env.spreadsheet, env.session,
      request('22345678-1234-4234-8234-123456789abc', 1000, {
        category: 'pendingAmount',
        transactionReference: 'utr-100'
      }));
  }, /transaction reference is already recorded/);
  assert.equal(env.context.brokerReadRecoveries_(env.spreadsheet.getSheetByName('Recoveries')).length, 1);
});

test('backend rejects over-recovery and invalid date/category without writing a row', function () {
  const env = setup();
  assert.throws(function () {
    env.context.brokerCreateRecovery_(env.spreadsheet, env.session, request(env.idempotencyKey, 10000.01));
  }, /exceeds the current outstanding amount/);
  assert.throws(function () {
    env.context.brokerCreateRecovery_(env.spreadsheet, env.session,
      request(env.idempotencyKey, 100, { receivedDate: '2026-02-30' }));
  }, /not a valid calendar date/);
  assert.throws(function () {
    env.context.brokerCreateRecovery_(env.spreadsheet, env.session,
      request(env.idempotencyKey, 100, { category: 'codToPay' }));
  }, /supported TOBILLED recovery category/);
  assert.equal(env.context.brokerReadRecoveries_(env.spreadsheet.getSheetByName('Recoveries')).length, 0);
});

test('shipment edits cannot invalidate existing recovery amounts', function () {
  const env = setup();
  env.context.brokerCreateRecovery_(env.spreadsheet, env.session, request(env.idempotencyKey, 4000));
  const updated = {
    id: 'shipment-1', transportName: 'Example Transport', lrNo: 'LR-100',
    truckNo: 'AP00AA0000', date: '25-10-2026', freight: '3,000', tM: '',
    advance: '', advance2: '', advance3: '', extraAmount: '', pM: '',
    toPayStatus: 'TOBILLED'
  };
  assert.throws(function () {
    env.context.brokerAssertRecoveriesCompatible_(env.spreadsheet, updated, 'shipment-1');
  }, /below amounts already recovered/);
});

test('backend reversal is appended once and restores the outstanding balance', function () {
  const env = setup();
  const original = env.context.brokerCreateRecovery_(env.spreadsheet, env.session,
    request(env.idempotencyKey, 4000)).recovery;
  const reversalRequest = {
    recoveryId: original.id,
    idempotencyKey: '32345678-1234-4234-8234-123456789abc',
    reversalDate: '2026-10-26',
    reason: 'Payment was entered against the wrong transaction'
  };
  const reversal = env.context.brokerReverseRecovery_(env.spreadsheet, env.session, reversalRequest);
  assert.equal(reversal.recovery.type, 'REVERSAL');
  assert.equal(reversal.recovery.receivedAmount, -4000);
  assert.equal(reversal.recovery.recoveryStatus, 'REVERSED');
  assert.equal(reversal.recovery.remainingPending, 10000);

  const retry = env.context.brokerReverseRecovery_(env.spreadsheet, env.session, reversalRequest);
  assert.equal(retry.duplicate, true);
  assert.equal(env.context.brokerReadRecoveries_(env.spreadsheet.getSheetByName('Recoveries')).length, 2);
  assert.throws(function () {
    env.context.brokerReverseRecovery_(env.spreadsheet, env.session, Object.assign({}, reversalRequest, {
      idempotencyKey: '42345678-1234-4234-8234-123456789abc'
    }));
  }, /already been reversed/);
});
