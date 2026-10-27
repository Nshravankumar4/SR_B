(function () {
  'use strict';
  const results = [];
  function check(name, run) {
    try { run(); results.push({ name: name, ok: true }); }
    catch (error) { results.push({ name: name, ok: false, error: error.message }); }
  }
  function equal(actual, expected) {
    if (actual !== expected) throw new Error('Expected ' + expected + ', received ' + actual);
  }
  const c = window.BrokerCalculations;
  const fixture = [
    { toPayStatus: 'TOBILLED', freight: '60,000', tM: '300', advance: '49,700', extraAmount: '', pM: '200', codToPay: 'if Tobilled NA' },
    { toPayStatus: 'TOBILLED', freight: '60,000', tM: '300', advance: '49,700', extraAmount: '5,000', pM: '300', codToPay: 'if Tobilled NA' },
    { toPayStatus: 'A/TO-PAY', freight: '90,000', tM: '200', advance: '49,800', codToPay: 40000 },
    { toPayStatus: 'F/TO-PAY', freight: '42,000', codToPay: '42,000' }
  ];
  check('TOBILLED formula examples', function () {
    equal(c.calculateShipment(fixture[0]).pendingAmount, 9800);
    equal(c.calculateShipment(fixture[1]).pendingAmount, 14700);
  });
  check('To-Pay pending amounts are zero', function () {
    equal(c.calculateShipment(fixture[2]).pendingAmount, 0);
    equal(c.calculateShipment(fixture[3]).pendingAmount, 0);
  });
  check('workbook COD formulas recalculate A/TO-PAY and F/TO-PAY values', function () {
    equal(c.calculateShipment(Object.assign({}, fixture[2], { codToPay: '999999' })).codToPay, 40000);
    equal(c.calculateShipment(Object.assign({}, fixture[3], { codToPay: 'stale' })).codToPay, 42000);
  });
  check('To-Pay pending formula preserves ADVANCE2 and ADVANCE3 balance', function () {
    const result = c.calculateShipment(Object.assign({}, fixture[2], { advance2: '1,000', advance3: '500' }));
    equal(result.codToPay, 38500);
    equal(result.pendingAmount, 1500);
  });
  check('status case and whitespace normalize to canonical values', function () {
    equal(c.normalizeStatus(' a / to-pay '), 'A/TO-PAY');
    equal(c.calculateShipment(Object.assign({}, fixture[2], { toPayStatus: ' a / to-pay ' })).codToPay, 40000);
  });
  check('invalid amount does not produce calculated zero values', function () {
    const result = c.calculateShipment(Object.assign({}, fixture[2], { tM: 'not an amount' }));
    equal(result.codToPay, null);
    equal(result.pendingAmount, null);
  });
  check('source changes and status changes recalculate without mutating inputs', function () {
    const record = Object.assign({}, fixture[0], { freight: '62,000' });
    const billed = c.calculateShipment(record);
    equal(billed.pendingTobilled, 12000);
    equal(billed.pendingAmount, 11800);
    equal(record.freight, '62,000');
    record.toPayStatus = 'A/TO-PAY';
    const toPay = c.calculateShipment(record);
    equal(toPay.pendingTobilled, null);
    equal(toPay.pendingAmount, 0);
    equal(record.freight, '62,000');
  });
  check('numeric parsing and paise precision', function () {
    equal(c.parseMoney('₹1,20,000.50').paise, 12000050);
    equal(c.parseMoney('1,200,000.05').paise, 120000005);
  });
  check('optional empty money and invalid text', function () {
    equal(c.parseMoney('', { allowEmpty: true }).paise, 0);
    equal(c.parseMoney('if Tobilled NA', { allowEmpty: true }).ok, false);
  });
  check('shipment validation rejects invalid amounts, dates and statuses', function () {
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
    equal(window.BrokerValidation.validateShipment(valid).valid, true);
    equal(window.BrokerValidation.validateShipment(Object.assign({}, valid, { advance: 'unknown' })).valid, false);
    equal(window.BrokerValidation.validateShipment(Object.assign({}, valid, { date: '2026-02-30' })).valid, false);
    equal(window.BrokerValidation.validateShipment(Object.assign({}, valid, { toPayStatus: 'TO-PAY' })).valid, false);
  });
  check('summary reconciliation and placeholder exclusion', function () {
    const summary = c.summarize(fixture);
    equal(summary.shipmentCount, 4);
    equal(summary.statusCounts.TOBILLED, 2);
    equal(summary.statusCounts['A/TO-PAY'], 1);
    equal(summary.statusCounts['F/TO-PAY'], 1);
    equal(summary.freightPaise, 25200000);
    equal(summary.advancePaise, 14920000);
    equal(summary.tMPaise, 80000);
    equal(summary.pMPaise, 50000);
    equal(summary.extraAmountPaise, 500000);
    equal(summary.pendingTobilledPaise, 2000000);
    equal(summary.pendingAmountPaise, 2450000);
    equal(summary.codToPayPaise, 8200000);
  });
  check('summary recalculates COD values rather than trusting stale To-Pay cells', function () {
    const rows = fixture.map(function (record) { return Object.assign({}, record); });
    rows[2].codToPay = '999999';
    rows[3].codToPay = 'stale';
    equal(c.summarize(rows).codToPayPaise, 8200000);
  });
  function renderResults() {
    const list = document.getElementById('test-results');
    list.textContent = '';
    results.forEach(function (item) {
      const row = document.createElement('li');
      row.textContent = (item.ok ? 'PASS: ' : 'FAIL: ') + item.name + (item.error ? ' — ' + item.error : '');
      row.style.color = item.ok ? '#166534' : '#991b1b';
      list.appendChild(row);
    });
    const failed = results.filter(function (item) { return !item.ok; }).length;
    const output = document.getElementById('result');
    output.textContent = failed ? failed + ' test(s) failed.' : results.length + ' browser tests passed.';
    output.className = 'notice ' + (failed ? 'notice-error' : 'notice-success');
    document.title = failed ? 'FAIL — Broker Ledger Tests' : 'PASS — Broker Ledger Tests';
  }

  renderResults();
  fetch('../backend/Code.gs', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Backend source could not be loaded for the browser test.');
      return response.text();
    })
    .then(function (source) {
      const backend = new Function(source + '\nreturn { login: brokerLogin_, rowNumberForId: brokerRowNumberForId_, recordVersionMatches: brokerRecordVersionMatches_, validateAndCalculate: brokerValidateAndCalculate_ };')();
      check('backend login cleans expired sessions and keeps rate-limit properties bounded', function () {
        const values = {
          BROKER_SPREADSHEET_ID: 'test-spreadsheet',
          ADMIN_USERNAME: 'admin',
          ADMIN_PASSWORD: 'admin-test-password-2026',
          EMPLOYEE_USERNAME: 'employee',
          EMPLOYEE_PASSWORD: 'employee-test-password-2026',
          BROKER_SESSION_expired: JSON.stringify({ expiresAt: Date.now() - 1 }),
          BROKER_SESSION_corrupt: '{invalid',
          BROKER_SESSION_active: JSON.stringify({ expiresAt: Date.now() + 60000 })
        };
        const properties = {
          getProperty: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
          setProperty: function (key, value) { values[key] = String(value); },
          deleteProperty: function (key) { delete values[key]; },
          getProperties: function () { return Object.assign({}, values); }
        };
        const originalPropertiesService = window.PropertiesService;
        const originalUtilities = window.Utilities;
        window.PropertiesService = { getScriptProperties: function () { return properties; } };
        window.Utilities = {
          getUuid: function () { return '123e4567-e89b-12d3-a456-426614174000'; }
        };
        try {
          for (let attempt = 0; attempt < 8; attempt += 1) {
            equal(backend.login({ username: 'unknown-user', password: 'wrong-password' }).success, false);
          }
          equal(backend.login({ username: 'unknown-user', password: 'wrong-password' }).message.indexOf('Too many'), 0);
          const login = backend.login({ username: 'ADMIN', password: 'admin-test-password-2026' });
          equal(login.success, true);
          equal(login.role, 'Admin');
          equal(Boolean(values.BROKER_SESSION_expired), false);
          equal(Boolean(values.BROKER_SESSION_corrupt), false);
          equal(Boolean(values.BROKER_SESSION_active), true);
          equal(Boolean(values.BROKER_LOGIN_FAIL_COUNT_UNKNOWN), true);
          equal(Object.keys(values).filter(function (key) { return key.indexOf('BROKER_LOGIN_FAIL_COUNT_') === 0; }).length, 1);
        } finally {
          if (originalPropertiesService === undefined) delete window.PropertiesService;
          else window.PropertiesService = originalPropertiesService;
          if (originalUtilities === undefined) delete window.Utilities;
          else window.Utilities = originalUtilities;
        }
      });
      check('backend update and delete row lookup uses stable IDs across blank rows', function () {
        const sheet = {
          getLastRow: function () { return 5; },
          getRange: function (firstRow, firstColumn, rowCount, columnCount) {
            equal(firstRow, 2);
            equal(firstColumn, 1);
            equal(columnCount, 1);
            return {
              getValues: function () {
                equal(rowCount, 4);
                return [['record-a'], [''], ['record-b'], ['record-c']];
              }
            };
          }
        };
        equal(backend.rowNumberForId(sheet, 'record-b'), 4);
        equal(backend.rowNumberForId(sheet, 'missing-record'), null);
      });
      check('optimistic updates reject a stale or missing record version', function () {
        equal(backend.recordVersionMatches('2026-10-28T10:00:00.000Z', { updatedAt: '2026-10-28T10:00:00.000Z' }), true);
        equal(backend.recordVersionMatches('2026-10-28T09:00:00.000Z', { updatedAt: '2026-10-28T10:00:00.000Z' }), false);
        equal(backend.recordVersionMatches('', { updatedAt: '2026-10-28T10:00:00.000Z' }), false);
      });
      check('backend derives COD from workbook source fields and canonicalizes status', function () {
        const record = backend.validateAndCalculate({
          transportName: 'Example Transport',
          date: '2026-10-27',
          lrNo: 'LR-100',
          truckNo: 'AP00AA0000',
          from: 'Origin',
          to: 'Destination',
          freight: '90,000',
          tM: '200',
          advance: '49,800',
          advance2: '',
          advance3: '',
          extraAmount: '',
          pM: '',
          advance2: '1,000',
          advance3: '500',
          codToPay: '999999',
          toPayStatus: ' a / to-pay '
        });
        equal(record.toPayStatus, 'A/TO-PAY');
        equal(record.codToPay, 38500);
        equal(record.pendingAmount, 1500);
      });
      renderResults();
    })
    .catch(function (error) {
      results.push({ name: 'backend login/session cleanup', ok: false, error: error.message });
      renderResults();
    });
})();
