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
      const backend = new Function(source + '\nreturn { login: brokerLogin_ };')();
      check('backend login cleans expired sessions and limits attempts per username', function () {
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
          DigestAlgorithm: { SHA_256: 'SHA_256' },
          Charset: { UTF_8: 'UTF-8' },
          computeDigest: function (algorithm, value) {
            return [Array.from(value).reduce(function (sum, character) { return sum + character.charCodeAt(0); }, 0)];
          },
          base64EncodeWebSafe: function (bytes) { return String(bytes[0]); },
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
        } finally {
          if (originalPropertiesService === undefined) delete window.PropertiesService;
          else window.PropertiesService = originalPropertiesService;
          if (originalUtilities === undefined) delete window.Utilities;
          else window.Utilities = originalUtilities;
        }
      });
      renderResults();
    })
    .catch(function (error) {
      results.push({ name: 'backend login/session cleanup', ok: false, error: error.message });
      renderResults();
    });
})();
