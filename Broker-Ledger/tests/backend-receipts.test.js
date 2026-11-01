'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createBackend(receipts) {
  const source = fs.readFileSync(path.join(__dirname, '../backend/Code.gs'), 'utf8');
  const headers = [
    'RECEIPT_ID', 'IDEMPOTENCY_KEY', 'SHIPMENT_ID', 'LR_NO', 'PARTY_NAME',
    'RECEIVED_AMOUNT', 'RECEIVED_DATE', 'PAYMENT_MODE', 'TRANSACTION_REFERENCE',
    'REMAINING_PENDING', 'CREATED_AT', 'CREATED_BY', 'RECEIPT_JSON'
  ];
  const receiptSheet = {
    receipts: receipts.slice(),
    getLastRow: function () { return this.receipts.length + 1; },
    getRange: function (row, column, rowCount, columnCount) {
      return {
        getValues: function () {
          if (row === 1) return [headers.slice(0, columnCount)];
          return this.sheet.receipts.slice(row - 2, row - 2 + rowCount).map(function (receipt) {
            const values = [
              receipt.id, receipt.idempotencyKey, receipt.shipmentId, receipt.lrNo,
              receipt.partyName, receipt.receivedAmount, receipt.receivedDate,
              receipt.paymentMode, receipt.transactionReference, receipt.remainingPending,
              receipt.createdAt, receipt.createdBy, JSON.stringify(receipt)
            ];
            return values.slice(column - 1, column - 1 + columnCount);
          });
        }.bind({ sheet: this }),
        setValues: function () {},
        setNumberFormat: function () {},
        setFontWeight: function () { return this; },
        setBackground: function () { return this; },
        setFontColor: function () { return this; }
      };
    },
    appendRow: function (row) { this.receipts.push(JSON.parse(row[12])); }
  };
  const spreadsheet = {
    getSheetByName: function (name) { return name === 'Receipts' ? receiptSheet : {}; },
    receiptSheet: receiptSheet,
    shipments: [{
      id: 'shipment-193-194',
      lrNo: '193/194',
      transportName: 'ANDHRA GORAKPUR ROADWAYS',
      toPayStatus: 'TOBILLED',
      freight: '1,30,000',
      advance: '1,00,000',
      advance2: '20,000',
      advance3: '',
      tM: '',
      extraAmount: '',
      pM: ''
    }]
  };
  let uuid = 0;
  const context = vm.createContext({
    console: console,
    Date: Date,
    Utilities: {
      getUuid: function () { uuid += 1; return '10000000-0000-4000-8000-' + String(uuid).padStart(12, '0'); },
      formatDate: function () { return '2026-11-01'; }
    },
    Session: { getScriptTimeZone: function () { return 'Asia/Kolkata'; } },
    brokerAudit_: function () { return ''; },
    brokerBumpVersion_: function () {}
  });
  vm.runInContext(source, context);
  context.brokerReadRecords_ = function () { return spreadsheet.shipments; };
  context.brokerAudit_ = function () { return ''; };
  context.brokerBumpVersion_ = function () {};
  return { context: context, spreadsheet: spreadsheet };
}

function originalReceipt() {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'RECEIPT',
    idempotencyKey: '00000000-0000-4000-8000-000000000002',
    shipmentId: 'shipment-193-194',
    lrNo: '193/194',
    partyName: 'ANDHRA GORAKPUR ROADWAYS',
    receivedAmount: 10000,
    receivedDate: '01-11-2026',
    paymentMode: 'Bank Transfer',
    transactionReference: '',
    remainingPending: 0,
    createdAt: '2026-11-01T10:00:00.000Z',
    createdBy: 'Admin'
  };
}

test('admin receipt reversal appends an audited entry and restores the balance', function () {
  const backend = createBackend([originalReceipt()]);
  const result = backend.context.brokerReverseReceipt_(
    backend.spreadsheet,
    { role: 'Admin', username: 'Admin' },
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003'
  );
  assert.equal(result.receipt.type, 'REVERSAL');
  assert.equal(backend.spreadsheet.receiptSheet.receipts.length, 2);
  assert.equal(backend.context.brokerReceiptTotalPaise_(
    backend.context.brokerReadReceipts_(backend.spreadsheet.receiptSheet),
    'shipment-193-194'
  ), 0);
  assert.equal(result.receipt.remainingPending, 10000);
});

test('receipt reversal retry is idempotent and a second reversal is rejected', function () {
  const backend = createBackend([originalReceipt()]);
  const requestId = '00000000-0000-4000-8000-000000000003';
  const first = backend.context.brokerReverseReceipt_(
    backend.spreadsheet, { role: 'Admin', username: 'Admin' },
    '00000000-0000-4000-8000-000000000001', requestId
  );
  const retry = backend.context.brokerReverseReceipt_(
    backend.spreadsheet, { role: 'Admin', username: 'Admin' },
    '00000000-0000-4000-8000-000000000001', requestId
  );
  assert.equal(retry.duplicate, true);
  assert.equal(retry.receipt.id, first.receipt.id);
  assert.throws(function () {
    backend.context.brokerReverseReceipt_(
      backend.spreadsheet, { role: 'Admin', username: 'Admin' },
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000004'
    );
  }, /already been reversed/);
});

test('only an administrator can reverse a received payment', function () {
  const backend = createBackend([originalReceipt()]);
  assert.throws(function () {
    backend.context.brokerReverseReceipt_(
      backend.spreadsheet, { role: 'Rudra', username: 'Rudra' },
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000003'
    );
  }, /Only an administrator/);
});
