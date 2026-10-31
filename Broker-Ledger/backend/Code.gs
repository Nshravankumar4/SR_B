var BROKER_SHEET_NAME = 'Shipments';
var BROKER_AUDIT_SHEET_NAME = 'Audit';
var BROKER_DATA_VERSION_KEY = 'BROKER_LEDGER_DATA_VERSION';
var BROKER_FIELDS = [
  'slNo', 'transportName', 'date', 'lrNo', 'truckNo', 'from', 'to', 'accountNo',
  'ifscCode', 'bank', 'freight', 'tM', 'advance', 'date1', 'advance2', 'date2', 'advance3', 'date3',
  'unloadingDate', 'podReceivedDate', 'balanceDate', 'codToPay', 'pendingTobilled', 'extraAmount', 'pmPaDate',
  'pM', 'pendingAmount', 'podAmountStatus', 'remarks', 'note', 'toPayStatus'
];
var BROKER_TEXT_LIMITS = {
  transportName: 120, lrNo: 60, truckNo: 40, from: 100, to: 100,
  accountNo: 40, ifscCode: 20, bank: 100, codToPay: 80,
  podAmountStatus: 100, remarks: 500, note: 500
};
var BROKER_STATUSES = ['TOBILLED', 'A/TO-PAY', 'F/TO-PAY'];
var BROKER_OPTIONAL_MONEY = ['tM', 'advance', 'advance2', 'advance3', 'extraAmount', 'pM'];
var BROKER_SOURCE_MONEY = ['freight', 'tM', 'advance', 'advance2', 'advance3', 'extraAmount', 'pM'];

function brokerCleanExpiredSessions_(properties) {
  var all = properties.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf('BROKER_SESSION_') !== 0) return;
    try {
      var value = JSON.parse(all[key]);
      if (!value || Number(value.expiresAt) < Date.now()) properties.deleteProperty(key);
    } catch (error) {
      properties.deleteProperty(key);
    }
  });
}

function setupBrokerLedger() {
  var properties = PropertiesService.getScriptProperties();
  var required = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'EMPLOYEE_USERNAME', 'EMPLOYEE_PASSWORD'];
  var missing = required.filter(function(key) { return !properties.getProperty(key); });
  if (missing.length) {
    throw new Error('Set these Script Properties before setup: ' + missing.join(', '));
  }

  if (String(properties.getProperty('ADMIN_USERNAME')).toLowerCase() ===
      String(properties.getProperty('EMPLOYEE_USERNAME')).toLowerCase()) {
    throw new Error('Administrator and employee usernames must be different.');
  }
  if (String(properties.getProperty('ADMIN_PASSWORD')).length < 12 ||
      String(properties.getProperty('EMPLOYEE_PASSWORD')).length < 12) {
    throw new Error('Set both account passwords to at least 12 characters.');
  }
  if (properties.getProperty('ADMIN_PASSWORD') === properties.getProperty('EMPLOYEE_PASSWORD')) {
    throw new Error('Administrator and employee passwords must be different.');
  }

  var spreadsheetId = properties.getProperty('BROKER_SPREADSHEET_ID');
  var spreadsheet;
  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create('Broker Ledger Data');
    properties.setProperty('BROKER_SPREADSHEET_ID', spreadsheet.getId());
  }

  var dataSheet = spreadsheet.getSheetByName(BROKER_SHEET_NAME);
  if (!dataSheet) {
    var defaultSheet = spreadsheet.getSheets()[0];
    if (defaultSheet && defaultSheet.getLastRow() === 0 && spreadsheet.getSheets().length === 1) {
      defaultSheet.setName(BROKER_SHEET_NAME);
      dataSheet = defaultSheet;
    } else {
      dataSheet = spreadsheet.insertSheet(BROKER_SHEET_NAME);
    }
  }
  if (dataSheet.getLastRow() === 0) {
    dataSheet.getRange(1, 1, 1, 5).setValues([['ID', 'RECORD_JSON', 'CREATED_AT', 'UPDATED_AT', 'CREATED_BY']]);
    dataSheet.setFrozenRows(1);
    dataSheet.getRange('A:E').setNumberFormat('@');
    dataSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  }
  var auditSheet = spreadsheet.getSheetByName(BROKER_AUDIT_SHEET_NAME);
  if (!auditSheet) auditSheet = spreadsheet.insertSheet(BROKER_AUDIT_SHEET_NAME);
  if (auditSheet.getLastRow() === 0) {
    auditSheet.getRange(1, 1, 1, 5).setValues([['TIMESTAMP', 'USERNAME', 'ACTION', 'RECORD_ID', 'DETAIL']]);
    auditSheet.setFrozenRows(1);
    auditSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }
  if (!properties.getProperty(BROKER_DATA_VERSION_KEY)) {
    properties.setProperty(BROKER_DATA_VERSION_KEY, '1');
  }
  return {
    success: true,
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: spreadsheet.getId(),
    message: 'Broker Ledger database initialized. Keep the spreadsheet private to authorized administrators.'
  };
}

function doGet() {
  return brokerJson_({
    success: false,
    message: 'Broker Ledger API accepts POST requests only. Configure the app with this Web App URL.'
  });
}

function doPost(event) {
  var body = event && event.postData && event.postData.contents ? event.postData.contents : '';
  if (!body || body.length > 2000000) return brokerJson_({ success: false, message: 'Request is empty or too large.' });
  var request;
  try { request = JSON.parse(body); }
  catch (parseError) { return brokerJson_({ success: false, message: 'Request JSON is invalid.' }); }
  request = request || {};

  var action = String(request.action || '');
  if (action === 'ping' || action === 'login' || action === 'version') {
    try { return brokerJson_(brokerHandle_(request)); }
    catch (error) {
      return brokerJson_({ success: false, message: String(error && error.message ? error.message : error) });
    }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (error) {
    return brokerJson_({ success: false, code: 'SERVER_BUSY', message: 'Another update is in progress. Try again shortly.' });
  }
  try {
    var response = brokerHandle_(request);
    return brokerJson_(response);
  } catch (error) {
    return brokerJson_({ success: false, message: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function brokerHandle_(request) {
  var action = String(request.action || '');
  if (action === 'login') return brokerLogin_(request);

  var session = brokerSession_(request.token);
  if (!session) return { success: false, error: 'SESSION_INVALID', message: 'Session is invalid or expired. Sign in again.' };
  if (action === 'logout') {
    PropertiesService.getScriptProperties().deleteProperty('BROKER_SESSION_' + request.token);
    return { success: true };
  }
  if (action === 'ping') {
    return { success: true, records: [], version: brokerVersion_() };
  }

  var spreadsheet = brokerGetSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(BROKER_SHEET_NAME);
  if (!sheet) throw new Error('The shipment sheet is missing. Run setupBrokerLedger() again.');
  if (action === 'getAll') {
    return { success: true, records: brokerReadRecords_(sheet), version: brokerVersion_() };
  }
  if (action === 'createShipment') {
    var record = brokerValidateAndCalculate_(request.record);
    var existing = brokerReadRecords_(sheet);
    brokerAssertUnique_(record, existing, null);
    record.id = Utilities.getUuid();
    record.slNo = brokerNextSlNo_(existing);
    var now = new Date().toISOString();
    record.createdAt = now;
    record.updatedAt = now;
    record.createdBy = session.username;
    brokerAppend_(sheet, record);
    var createAuditWarning = brokerAudit_(spreadsheet, session, 'CREATE', record.id, record.lrNo);
    brokerBumpVersion_();
    return { success: true, record: record, warning: createAuditWarning, version: brokerVersion_() };
  }
  if (action === 'updateShipment') {
    var id = String(request.id || '').trim();
    if (!id) throw new Error('A shipment ID is required for editing.');
    var records = brokerReadRecords_(sheet);
    var existingRecord = records.find(function(item) { return item.id === id; });
    var rowNumber = brokerRowNumberForId_(sheet, id);
    if (!existingRecord || !rowNumber) throw new Error('Shipment no longer exists. Reload the ledger and try again.');
    if (!brokerRecordVersionMatches_(request.expectedUpdatedAt, existingRecord)) {
      return {
        success: false,
        error: 'RECORD_CONFLICT',
        message: 'This shipment was changed by another user. Your edits were not saved. Close and reopen the latest record before editing again.'
      };
    }
    var updated = brokerValidateAndCalculate_(request.record);
    brokerAssertUnique_(updated, records, id);
    updated.id = id;
    updated.slNo = existingRecord.slNo;
    updated.createdAt = existingRecord.createdAt;
    updated.createdBy = existingRecord.createdBy;
    updated.updatedAt = new Date().toISOString();
    brokerWriteAt_(sheet, rowNumber, updated);
    var updateAuditWarning = brokerAudit_(spreadsheet, session, 'UPDATE', id, updated.lrNo);
    brokerBumpVersion_();
    return { success: true, record: updated, warning: updateAuditWarning, version: brokerVersion_() };
  }
  if (action === 'deleteShipment') {
    if (session.role !== 'Admin') throw new Error('Only an administrator can delete shipments.');
    var deleteId = String(request.id || '').trim();
    var deleteRecords = brokerReadRecords_(sheet);
    var deleteRecord = deleteRecords.find(function(item) { return item.id === deleteId; });
    var deleteRowNumber = brokerRowNumberForId_(sheet, deleteId);
    if (!deleteRecord || !deleteRowNumber) throw new Error('Shipment not found. Reload and try again.');
    sheet.deleteRow(deleteRowNumber);
    var deleteAuditWarning = brokerAudit_(spreadsheet, session, 'DELETE', deleteId, deleteRecord.lrNo);
    brokerBumpVersion_();
    return { success: true, warning: deleteAuditWarning, version: brokerVersion_() };
  }
  if (action === 'importShipments') {
    var imported = brokerImport_(spreadsheet, sheet, session, request.records);
    return { success: true, imported: imported.count, warning: imported.warning, version: brokerVersion_() };
  }
  if (action === 'createBackup') {
    if (session.role !== 'Admin') throw new Error('Only an administrator can create backups.');
    var driveFile = DriveApp.getFileById(spreadsheet.getId());
    var backupName = 'Broker Ledger Backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmmss');
    var copy = driveFile.makeCopy(backupName);
    var backupAuditWarning = brokerAudit_(spreadsheet, session, 'BACKUP', copy.getId(), backupName);
    return { success: true, name: backupName, warning: backupAuditWarning };
  }
  return { success: false, message: 'Unsupported action.' };
}

function brokerLogin_(request) {
  var properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('BROKER_SPREADSHEET_ID')) {
    return { success: false, message: 'The backend is not initialized. The administrator must run setupBrokerLedger().' };
  }
  var username = String(request.username || '').trim();
  var password = String(request.password || '');
  if (!username || username.length > 120 || !password || password.length > 256) return { success: false, message: 'Enter a valid username and password.' };
  var adminName = String(properties.getProperty('ADMIN_USERNAME') || '');
  var employeeName = String(properties.getProperty('EMPLOYEE_USERNAME') || '');
  var account = null;
  if (brokerConstantTimeEqual_(username.toLowerCase(), adminName.toLowerCase())) account = 'ADMIN';
  if (brokerConstantTimeEqual_(username.toLowerCase(), employeeName.toLowerCase())) account = 'EMPLOYEE';
  var role = null;
  if (brokerConstantTimeEqual_(username.toLowerCase(), adminName.toLowerCase()) &&
      brokerConstantTimeEqual_(password, String(properties.getProperty('ADMIN_PASSWORD') || ''))) role = 'Admin';
  if (brokerConstantTimeEqual_(username.toLowerCase(), employeeName.toLowerCase()) &&
      brokerConstantTimeEqual_(password, String(properties.getProperty('EMPLOYEE_PASSWORD') || ''))) role = 'Employee';

  var accountKey = account || 'UNKNOWN';
  var attemptsKey = 'BROKER_LOGIN_FAIL_COUNT_' + accountKey;
  var blockedKey = 'BROKER_LOGIN_BLOCK_UNTIL_' + accountKey;
  var attempts = Number(properties.getProperty(attemptsKey) || 0);
  var blockedUntil = Number(properties.getProperty(blockedKey) || 0);
  if (blockedUntil > Date.now()) return { success: false, message: 'Too many failed sign-in attempts. Wait a few minutes and try again.' };
  if (!role) {
    attempts += 1;
    if (attempts >= 8) {
      properties.setProperty(attemptsKey, '0');
      properties.setProperty(blockedKey, String(Date.now() + 5 * 60 * 1000));
    } else {
      properties.setProperty(attemptsKey, String(attempts));
    }
    return { success: false, message: 'Invalid username or password.' };
  }
  properties.deleteProperty(attemptsKey);
  properties.deleteProperty(blockedKey);
  brokerCleanExpiredSessions_(properties);
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  properties.setProperty('BROKER_SESSION_' + token, JSON.stringify({
    username: role === 'Admin' ? adminName : employeeName,
    role: role,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000
  }));
  return { success: true, username: role === 'Admin' ? adminName : employeeName, name: role === 'Admin' ? 'Administrator' : employeeName, role: role, token: token };
}

function brokerRowNumberForId_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var matchingRows = [];
  ids.forEach(function(row, index) {
    if (String(row[0] || '') === id) matchingRows.push(index + 2);
  });
  if (matchingRows.length > 1) {
    throw new Error('Duplicate shipment IDs were found in the sheet. No record was changed. Contact the administrator.');
  }
  return matchingRows.length ? matchingRows[0] : null;
}

function brokerRecordVersionMatches_(expectedUpdatedAt, existingRecord) {
  return Boolean(expectedUpdatedAt) &&
    String(expectedUpdatedAt) === String(existingRecord && existingRecord.updatedAt || '');
}

function brokerSession_(token) {
  token = String(token || '');
  if (!/^[a-f0-9-]{36,80}$/i.test(token)) return null;
  var properties = PropertiesService.getScriptProperties();
  var key = 'BROKER_SESSION_' + token;
  var raw = properties.getProperty(key);
  if (!raw) return null;
  var session;
  try { session = JSON.parse(raw); }
  catch (error) { properties.deleteProperty(key); return null; }
  if (!session || Number(session.expiresAt) < Date.now()) {
    properties.deleteProperty(key);
    return null;
  }
  return session;
}

function brokerValidateAndCalculate_(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Shipment data must be an object.');
  var record = {};
  BROKER_FIELDS.forEach(function(field) {
    var value = source[field];
    if (value === null || value === undefined) value = '';
    if (field === 'slNo' || field === 'pendingTobilled' || field === 'pendingAmount') return;
    if (field === 'date' || field === 'date1' || field === 'date2' || field === 'date3' || field === 'unloadingDate' || field === 'podReceivedDate' || field === 'pmPaDate' || field === 'balanceDate') {
      record[field] = !value ? '' : brokerNormalizeDate_(value, field);
    } else if (field === 'toPayStatus') {
      record[field] = brokerNormalizeStatus_(value);
    } else if (field === 'codToPay') {
      if (typeof value !== 'string' && typeof value !== 'number') throw new Error('COD / To-Pay must be an amount or text.');
      record[field] = String(value).trim();
      if (record[field].length > BROKER_TEXT_LIMITS.codToPay) throw new Error('COD / To-Pay text is too long.');
    } else if (BROKER_SOURCE_MONEY.indexOf(field) >= 0) {
      var isEmpty = value === '';
      var parsed = brokerParseMoney_(value, BROKER_OPTIONAL_MONEY.indexOf(field) >= 0);
      if (!parsed.ok) throw new Error((field === 'freight' ? 'FRIGHT' : field) + ': ' + parsed.error);
      record[field] = isEmpty ? '' : String(value).trim();
    } else {
      record[field] = String(value).trim();
      if (BROKER_TEXT_LIMITS[field] && record[field].length > BROKER_TEXT_LIMITS[field]) {
        throw new Error(field + ' exceeds its maximum length.');
      }
    }
  });
  ['transportName', 'date', 'lrNo', 'truckNo', 'from', 'to', 'freight', 'toPayStatus'].forEach(function(field) {
    if (!record[field]) throw new Error(field + ' is required.');
  });
  if (BROKER_STATUSES.indexOf(record.toPayStatus) < 0) throw new Error('ToPayStatus must be TOBILLED, A/TO-PAY, or F/TO-PAY.');
  var calc = brokerCalculate_(record);
  record.codToPay = calc.codToPay;
  record.pendingTobilled = calc.pendingTobilled;
  record.pendingAmount = calc.pendingAmount;
  if (!record.podAmountStatus || String(record.podAmountStatus).trim() === '') {
    record.podAmountStatus = String(calc.podAmountStatus !== undefined ? calc.podAmountStatus : '0');
  }
  return record;
}

function brokerNormalizeStatus_(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function brokerCalculate_(record) {
  var parsed = {};
  BROKER_SOURCE_MONEY.forEach(function(field) {
    var result = brokerParseMoney_(record[field], BROKER_OPTIONAL_MONEY.indexOf(field) >= 0);
    if (!result.ok) throw new Error(field + ': ' + result.error);
    parsed[field] = result.paise;
  });
  var status = brokerNormalizeStatus_(record.toPayStatus);
  if (status === 'TOBILLED') {
    var pendingTobilled = parsed.freight - parsed.tM - parsed.advance - parsed.advance2 - parsed.advance3;
    return {
      codToPay: record.codToPay === null || record.codToPay === undefined ? '' : record.codToPay,
      pendingTobilled: pendingTobilled / 100,
      pendingAmount: (pendingTobilled + parsed.extraAmount - parsed.pM) / 100,
      podAmountStatus: 0
    };
  }
  if (status !== 'A/TO-PAY' && status !== 'F/TO-PAY') {
    throw new Error('Unsupported ToPayStatus in the shipment data.');
  }
  var codToPay = parsed.freight - parsed.tM - parsed.advance - parsed.advance2 - parsed.advance3;
  var pendingAmount = parsed.freight - parsed.tM - parsed.advance - codToPay;
  return { codToPay: codToPay / 100, pendingTobilled: '', pendingAmount: pendingAmount / 100, podAmountStatus: 0 };
}

function brokerParseMoney_(value, allowEmpty) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return allowEmpty ? { ok: true, paise: 0 } : { ok: false, error: 'Enter an amount.' };
  }
  if (typeof value === 'number') {
    if (!isFinite(value)) return { ok: false, error: 'Enter a valid amount.' };
    var cents = Math.round((value + 1e-10) * 100);
    return Number.isSafeInteger(cents) ? { ok: true, paise: cents } : { ok: false, error: 'Amount is too large.' };
  }
  var text = String(value).trim().replace(/^₹\s*/, '').replace(/\s*₹$/, '').replace(/\s/g, '');
  var sign = 1;
  if (text.charAt(0) === '-' || text.charAt(0) === '+') {
    if (text.charAt(0) === '-') sign = -1;
    text = text.slice(1);
  }
  var match = text.match(/^((?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3}))(?:\.(\d{1,2}))?$/);
  if (!match) return { ok: false, error: 'Enter a valid amount with no more than 2 decimal places.' };
  var whole = match[1].replace(/,/g, '');
  var decimal = match[2] || '';
  var rupees = Number(whole);
  var paise = rupees * 100 + Number((decimal + '00').slice(0, 2));
  if (!Number.isSafeInteger(paise)) return { ok: false, error: 'Amount is too large.' };
  return { ok: true, paise: sign * paise };
}

function brokerNormalizeDate_(value, field) {
  if (!value) return '';
  var text = String(value).trim();
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  var year, month, day;
  if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
  else if (dmy) { day = Number(dmy[1]); month = Number(dmy[2]); year = Number(dmy[3]); }
  else throw new Error(field + ' must be a valid DD-MM-YYYY date.');
  var date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(field + ' is not a valid calendar date.');
  }
  return ('0' + day).slice(-2) + '-' + ('0' + month).slice(-2) + '-' + year;
}

function brokerReadRecords_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var result = [];
  rows.forEach(function(row) {
    if (!row[0] || !row[1]) return;
    var record;
    try { record = JSON.parse(String(row[1])); }
    catch (error) { throw new Error('A shipment row is corrupt. No records were changed. Contact the administrator.'); }
    if (!record || typeof record !== 'object' || !record.id) return;
    var calculated = brokerCalculate_(record);
    record.toPayStatus = brokerNormalizeStatus_(record.toPayStatus);
    record.codToPay = calculated.codToPay;
    record.pendingTobilled = calculated.pendingTobilled;
    record.pendingAmount = calculated.pendingAmount;
    result.push(record);
  });
  return result;
}

function brokerAppend_(sheet, record) {
  sheet.appendRow([record.id, JSON.stringify(record), record.createdAt, record.updatedAt, record.createdBy]);
}

function brokerWriteAt_(sheet, rowNumber, record) {
  sheet.getRange(rowNumber, 1, 1, 5).setValues([[
    record.id, JSON.stringify(record), record.createdAt, record.updatedAt, record.createdBy
  ]]);
}

function brokerImport_(spreadsheet, sheet, session, incoming) {
  if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 1000) {
    throw new Error('Import must contain between 1 and 1,000 shipment rows.');
  }
  var existing = brokerReadRecords_(sheet);
  var seen = {};
  existing.forEach(function(record) { seen[brokerIdentity_(record)] = true; });
  var prepared = incoming.map(function(item) { return brokerValidateAndCalculate_(item); });
  prepared.forEach(function(record) {
    var identity = brokerIdentity_(record);
    if (!identity || seen[identity]) throw new Error('Import stopped: a shipment with the same LR No, date, and truck already exists.');
    seen[identity] = true;
  });
  var nextSlNo = brokerNextSlNo_(existing);
  var now = new Date().toISOString();
  prepared.forEach(function(record, index) {
    record.id = Utilities.getUuid();
    record.slNo = nextSlNo + index;
    record.createdAt = now;
    record.updatedAt = now;
    record.createdBy = session.username;
  });
  if (prepared.length) {
    var rows = prepared.map(function(record) {
      return [record.id, JSON.stringify(record), record.createdAt, record.updatedAt, record.createdBy];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
  var warning = brokerAudit_(spreadsheet, session, 'IMPORT', '', String(prepared.length) + ' shipments');
  brokerBumpVersion_();
  return { count: prepared.length, warning: warning };
}

function brokerIdentity_(record) {
  return [record.lrNo, record.date, record.truckNo].map(function(value) {
    return String(value || '').trim().toLowerCase();
  }).join('|');
}

function brokerAssertUnique_(record, records, exceptId) {
  var identity = brokerIdentity_(record);
  var duplicate = records.some(function(item) {
    return item.id !== exceptId && brokerIdentity_(item) === identity;
  });
  if (duplicate) throw new Error('A shipment with this LR No, date, and truck already exists.');
}

function brokerNextSlNo_(records) {
  return records.reduce(function(max, record) {
    return Math.max(max, Number(record.slNo) || 0);
  }, 0) + 1;
}

function brokerGetSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('BROKER_SPREADSHEET_ID');
  if (!id) throw new Error('Backend is not initialized. The administrator must run setupBrokerLedger().');
  return SpreadsheetApp.openById(id);
}

function brokerAudit_(spreadsheet, session, action, recordId, detail) {
  try {
    var sheet = spreadsheet.getSheetByName(BROKER_AUDIT_SHEET_NAME);
    if (!sheet) throw new Error('Audit sheet is missing.');
    sheet.appendRow([
      new Date().toISOString(),
      brokerSafeSheetText_(session.username),
      action,
      brokerSafeSheetText_(recordId || ''),
      brokerSafeSheetText_(detail || '')
    ]);
    return '';
  } catch (error) {
    return 'The data change succeeded, but its audit entry could not be written. Contact the administrator.';
  }
}

function brokerSafeSheetText_(value) {
  var text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function brokerBumpVersion_() {
  var properties = PropertiesService.getScriptProperties();
  var current = Number(properties.getProperty(BROKER_DATA_VERSION_KEY) || 0);
  properties.setProperty(BROKER_DATA_VERSION_KEY, String(current + 1));
}

function brokerVersion_() {
  return Number(PropertiesService.getScriptProperties().getProperty(BROKER_DATA_VERSION_KEY) || 1);
}

function brokerConstantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  var difference = left.length ^ right.length;
  var length = Math.max(left.length, right.length);
  for (var index = 0; index < length; index++) {
    difference |= (left.charCodeAt(index % Math.max(1, left.length)) || 0) ^
      (right.charCodeAt(index % Math.max(1, right.length)) || 0);
  }
  return difference === 0;
}

function brokerJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
