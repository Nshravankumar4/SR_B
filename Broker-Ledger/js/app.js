(function () {
  'use strict';

  const CALC = window.BrokerCalculations;
  const VALIDATION = window.BrokerValidation;
  const state = {
    user: null,
    records: [],
    filtered: [],
    view: 'dashboard',
    editingId: null,
    formMode: 'edit',
    pendingImport: null,
    busy: false,
    preview: false,
    version: 0,
    sortField: 'slNo',
    sortDirection: 1,
    toastTimer: null
  };

  const FIELD_ORDER = [
    'slNo', 'transportName', 'date', 'lrNo', 'truckNo', 'from', 'to', 'accountNo',
    'ifscCode', 'bank', 'freight', 'tM', 'advance', 'advance2', 'advance3',
    'podReceivedDate', 'codToPay', 'pendingTobilled', 'extraAmount', 'pmPaDate',
    'pM', 'pendingAmount', 'podAmountStatus', 'remarks', 'toPayStatus'
  ];
  const LABELS = {
    slNo: 'SL NO', transportName: 'TRSP NAME', date: 'DATE', lrNo: 'LR NO', truckNo: 'TRUCK NO',
    from: 'FROM', to: 'TO', accountNo: 'ACCOUNT NO', ifscCode: 'IFSC CODE', bank: 'PAYMENT MADE',
    freight: 'FRIGHT', tM: 'T/M', advance: 'ADVANCE', advance2: 'ADVANCE2', advance3: 'ADVANCE3',
    podReceivedDate: 'POD RECD Date', codToPay: 'Cash on Delivery (COD) :A/Topay&Ftopay',
    pendingTobilled: 'Pending Amount: Tobilled', extraAmount: 'Extra Amount',
    pmPaDate: 'PM/PA Date', pM: 'P/M', pendingAmount: 'Pending Amount',
    podAmountStatus: 'POD Amount Status', remarks: 'REMARKS / NOTE', toPayStatus: 'ToPayStatus'
  };
  const MONEY_FIELDS = new Set([
    'freight', 'tM', 'advance', 'advance2', 'advance3',
    'pendingTobilled', 'extraAmount', 'pM', 'pendingAmount'
  ]);
  const DATE_FIELDS = new Set(['date', 'podReceivedDate', 'pmPaDate']);

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatMoneyPaise(paise) {
    return '₹' + CALC.fromPaise(paise).toLocaleString('en-IN', {
      minimumFractionDigits: 0, maximumFractionDigits: 2
    });
  }
  function displayMoney(value) {
    const parsed = CALC.parseMoney(value, { allowEmpty: true });
    if (!parsed.ok) return escapeHtml(value);
    return parsed.empty ? '—' : formatMoneyPaise(parsed.paise);
  }
  function formatDate(value) {
    const text = String(value || '');
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return iso[3] + '-' + iso[2] + '-' + iso[1];
    return text || '—';
  }
  function toDateInput(value) {
    const text = String(value || '');
    const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return dmy[3] + '-' + dmy[2] + '-' + dmy[1];
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }
  function toast(message, type) {
    const element = byId('toast');
    element.textContent = message;
    element.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { element.className = 'toast'; }, 4200);
  }
  function setCloudStatus(online, text) {
    byId('cloud-dot').className = 'status-dot ' + (online ? 'online' : 'offline');
    byId('cloud-status').textContent = text;
  }
  function setAuthMessage(text, isError) {
    const box = byId('auth-message');
    box.textContent = text;
    box.className = 'notice ' + (isError ? 'notice-error' : 'notice-info');
  }
  function getCurrentSession() {
    try { return JSON.parse(sessionStorage.getItem('broker-ledger-session') || 'null'); }
    catch (error) { sessionStorage.removeItem('broker-ledger-session'); return null; }
  }
  function showAuth(message) {
    byId('app-shell').hidden = true;
    byId('auth-view').hidden = false;
    if (message) setAuthMessage(message, true);
  }
  function showApp(user) {
    state.user = user;
    byId('auth-view').hidden = true;
    byId('app-shell').hidden = false;
    byId('add-shipment-top').hidden = state.preview;
    byId('user-name').textContent = user.name || user.username;
    byId('user-role').textContent = user.role;
    byId('mobile-user-name').textContent = user.name || user.username;
    render();
  }
  function setBusy(busy) {
    state.busy = busy;
    const login = byId('login-button');
    const save = byId('save-shipment');
    if (login) login.disabled = busy;
    if (save) save.disabled = busy;
  }
  function activeRecords() {
    return state.filtered;
  }
  function numericTotals(records) {
    return CALC.summarize(records);
  }
  function fieldValue(record, key) {
    if (DATE_FIELDS.has(key)) return formatDate(record[key]);
    if (MONEY_FIELDS.has(key)) {
      if (key === 'pendingTobilled' && record[key] === null) return '—';
      return displayMoney(record[key]);
    }
    if (key === 'codToPay') {
      const parsed = CALC.parseMoney(record[key], { allowEmpty: true });
      return parsed.ok && !parsed.empty ? formatMoneyPaise(parsed.paise) : (record[key] || '—');
    }
    return record[key] === null || record[key] === undefined || record[key] === '' ? '—' : record[key];
  }

  function statusBadge(status) {
    const cls = status === 'A/TO-PAY' ? 'atopay' : status === 'F/TO-PAY' ? 'ftopay' : '';
    return '<span class="status-badge ' + cls + '">' + escapeHtml(status) + '</span>';
  }
  function headerCell(field) {
    const cls = MONEY_FIELDS.has(field) ? ' class="numeric' + (field === 'pendingAmount' || field === 'pendingTobilled' ? ' calculated' : '') + '"' :
      field === 'toPayStatus' ? ' class="status-head"' : '';
    return '<th' + cls + '>' + escapeHtml(LABELS[field]) + '</th>';
  }
  function recordCell(record, field) {
    const value = fieldValue(record, field);
    if (field === 'toPayStatus') return '<td>' + statusBadge(record.toPayStatus) + '</td>';
    if (MONEY_FIELDS.has(field)) {
      const cls = 'numeric' + ((field === 'pendingAmount' || field === 'pendingTobilled') ? ' calculated' : '');
      return '<td class="' + cls + '">' + (value === '—' ? '—' : escapeHtml(value)) + '</td>';
    }
    return '<td>' + escapeHtml(value) + '</td>';
  }
  function renderMetric(label, value, note) {
    return '<article class="metric-card"><span class="metric-label">' + escapeHtml(label) +
      '</span><strong class="metric-value">' + escapeHtml(value) +
      '</strong>' + (note ? '<span class="metric-note">' + escapeHtml(note) + '</span>' : '') + '</article>';
  }
  function renderDashboard() {
    const summary = numericTotals(state.records);
    const metrics = [
      ['Total shipments', String(summary.shipmentCount), 'All statuses'],
      ['Total FRIGHT', formatMoneyPaise(summary.freightPaise), 'All shipments'],
      ['Total advances', formatMoneyPaise(summary.advancePaise), 'ADVANCE + ADVANCE2 + ADVANCE3'],
      ['Total T/M', formatMoneyPaise(summary.tMPaise), 'Broker deductions'],
      ['Total P/M', formatMoneyPaise(summary.pMPaise), 'Payments made'],
      ['Extra Amount', formatMoneyPaise(summary.extraAmountPaise), 'All shipments'],
      ['Pending Amount: Tobilled', formatMoneyPaise(summary.pendingTobilledPaise), 'TOBILLED only'],
      ['Final Pending Amount', formatMoneyPaise(summary.pendingAmountPaise), 'All statuses'],
      ['Numeric COD / To-Pay', formatMoneyPaise(summary.codToPayPaise), 'Text placeholders excluded']
    ];
    const cards = metrics.map(function (m) { return renderMetric(m[0], m[1], m[2]); }).join('');
    const statuses = CALC.STATUS.map(function (status) {
      return '<article class="status-card">' + statusBadge(status) + '<span>' +
        summary.statusCounts[status] + ' shipment' + (summary.statusCounts[status] === 1 ? '' : 's') + '</span></article>';
    }).join('');
    return '<div class="metrics-grid">' + cards + '</div>' +
      '<section class="panel"><h2 class="section-title">Shipment status</h2><div class="status-grid">' + statuses + '</div></section>' +
      '<section class="panel"><div class="toolbar"><div><h2 class="section-title">Recent shipments</h2><p class="toolbar-help">Calculated balances update from the source values.</p></div>' +
      '<button class="btn btn-secondary" type="button" data-action="go-ledger">Open Shipment Ledger</button></div>' +
      renderTable(state.records.slice().sort(sortBySlNo).slice(0, 5), false) + '</section>';
  }
  function sortBySlNo(a, b) {
    return (Number(a.slNo) || 0) - (Number(b.slNo) || 0);
  }
  function renderTable(records, showActions) {
    const actions = showActions !== false;
    if (!records.length) {
      return '<div class="empty-state"><strong>No shipments yet</strong><p>Add a shipment or import an Excel workbook to begin.</p></div>';
    }
    const heads = FIELD_ORDER.map(headerCell).join('') + (actions ? '<th>Actions</th>' : '');
    const rows = records.map(function (record) {
      const cells = FIELD_ORDER.map(function (field) { return recordCell(record, field); }).join('');
      const actionCell = actions ? '<td class="row-actions"><div class="view-actions">' +
        '<button class="btn btn-secondary btn-sm" type="button" data-action="view" data-id="' + escapeHtml(record.id) + '" aria-label="View shipment">View</button>' +
        (!state.preview ? '<button class="btn btn-secondary btn-sm" type="button" data-action="edit" data-id="' + escapeHtml(record.id) + '" aria-label="Edit shipment">Edit</button>' : '') +
        (state.user && state.user.role === 'Admin' ? '<button class="btn btn-danger btn-sm" type="button" data-action="delete" data-id="' + escapeHtml(record.id) + '" aria-label="Delete shipment">Delete</button>' : '') +
        '</div></td>' : '';
      return '<tr data-id="' + escapeHtml(record.id) + '">' + cells + actionCell + '</tr>';
    }).join('');
    return '<div class="table-wrap" tabindex="0" aria-label="Scrollable shipment table"><table class="ledger-table"><thead><tr>' + heads +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function renderLedger() {
    const filteredSummary = numericTotals(activeRecords());
    const filterValues = getFilterValues();
    return '<section class="panel"><div class="toolbar"><div class="toolbar-group">' +
      '<div class="filter-control search-control"><label for="ledger-search">Search shipments</label><input id="ledger-search" type="search" placeholder="LR No, transporter, truck, route..." value="' + escapeHtml(filterValues.search) + '"></div>' +
      '<div class="filter-control"><label for="ledger-status">ToPayStatus</label><select id="ledger-status"><option value="ALL">All statuses</option>' +
      CALC.STATUS.map(function (status) { return '<option value="' + status + '"' + (filterValues.status === status ? ' selected' : '') + '>' + status + '</option>'; }).join('') +
      '</select></div></div><div class="view-actions"><button class="btn btn-secondary" type="button" data-action="refresh">Refresh</button><button class="btn btn-secondary" type="button" data-action="export">Export Excel</button></div></div>' +
      '<div class="table-meta"><span>' + state.filtered.length + ' shipment' + (state.filtered.length === 1 ? '' : 's') + ' in view</span>' +
      '<span>FRIGHT in view: <strong>' + formatMoneyPaise(filteredSummary.freightPaise) + '</strong> · Pending in view: <strong>' + formatMoneyPaise(filteredSummary.pendingAmountPaise) + '</strong></span></div>' +
      renderTable(state.filtered, true) + '</section>';
  }
  function renderSheet() {
    const summary = numericTotals(state.filtered);
    const rows = state.filtered.length ? state.filtered.map(function (record) {
      return '<tr data-id="' + escapeHtml(record.id) + '">' + FIELD_ORDER.map(function (field) {
        return recordCell(record, field).replace('<td', '<td');
      }).join('') + '</tr>';
    }).join('') : '<tr><td class="empty-state" colspan="' + FIELD_ORDER.length + '">No shipments in the current view.</td></tr>';
    const totals = '<tr><td class="total-label" colspan="10">TOTAL (' + state.filtered.length + ' records)</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.freightPaise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.tMPaise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.advancePaise - summary.advance2Paise - summary.advance3Paise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.advance2Paise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.advance3Paise) + '</td>' +
      '<td></td><td class="numeric">' + formatMoneyPaise(summary.codToPayPaise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.pendingTobilledPaise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.extraAmountPaise) + '</td>' +
      '<td></td><td class="numeric">' + formatMoneyPaise(summary.pMPaise) + '</td>' +
      '<td class="numeric">' + formatMoneyPaise(summary.pendingAmountPaise) + '</td><td colspan="3"></td></tr>';
    return '<section class="panel"><div class="toolbar"><div class="toolbar-help">Spreadsheet view uses the same calculation and filter results as the ledger.</div>' +
      '<div class="view-actions"><button class="btn btn-secondary" type="button" data-action="refresh">Refresh</button><div class="zoom-controls"><label for="sheet-zoom">Zoom</label><select id="sheet-zoom"><option value="0.8">80%</option><option value="0.9">90%</option><option value="1" selected>100%</option><option value="1.15">115%</option></select></div>' +
      '<button class="btn btn-secondary" type="button" data-action="fullscreen">Full screen</button><button class="btn btn-secondary" type="button" data-action="print">Print</button><button class="btn btn-primary" type="button" data-action="export">Export Excel</button></div></div>' +
      '<div class="table-meta"><span>' + state.filtered.length + ' rows</span><span>Calculated columns are highlighted.</span></div>' +
      '<div id="sheet-wrap" class="sheet-wrap" tabindex="0" aria-label="Spreadsheet-style shipment ledger"><table class="sheet-table"><thead><tr>' +
      FIELD_ORDER.map(headerCell).join('') + '</tr></thead><tbody>' + rows + '</tbody><tfoot>' + totals + '</tfoot></table></div>' +
      '<div class="summary-strip"><span>Freight: <strong>' + formatMoneyPaise(summary.freightPaise) + '</strong></span><span>Pending: <strong>' +
      formatMoneyPaise(summary.pendingAmountPaise) + '</strong></span><span>COD / To-Pay: <strong>' + formatMoneyPaise(summary.codToPayPaise) + '</strong></span></div></section>';
  }
  function renderImport() {
    if (state.preview) {
      return '<section class="panel"><h2 class="section-title">Import and export preview</h2>' +
        '<p class="toolbar-help">This read-only preview has no connected backend and contains no shipment data. Configure the Google Apps Script URL to enable import, export, and cloud backup.</p></section>';
    }
    const adminTools = state.user && state.user.role === 'Admin' ?
      '<button class="btn btn-secondary" type="button" data-action="backup">Create cloud backup</button>' : '';
    let preview = '';
    if (state.pendingImport) {
      preview = '<div class="import-preview"><p class="preview-count">' + state.pendingImport.records.length +
        ' valid shipment row' + (state.pendingImport.records.length === 1 ? '' : 's') + ' ready to import.</p>' +
        '<p class="toolbar-help">' + state.pendingImport.duplicates.length + ' row(s) match existing records or duplicate another row in this file. Resolve duplicates before importing.</p>' +
        (state.pendingImport.error ? '<div class="notice notice-error">' + escapeHtml(state.pendingImport.error) + '</div>' : '') +
        renderTable(state.pendingImport.records.slice(0, 5), false) +
        '<div class="view-actions" style="margin-top:.8rem"><button class="btn btn-secondary" type="button" data-action="cancel-import">Cancel preview</button>' +
        '<button class="btn btn-primary" type="button" data-action="confirm-import"' + (state.pendingImport.error || !state.pendingImport.records.length ? ' disabled' : '') + '>Confirm import</button></div></div>';
    }
    return '<section class="panel"><h2 class="section-title">Import a workbook</h2><p class="toolbar-help">Select an Excel or CSV file. Repeated headers and blank rows are ignored. Derived amounts are recalculated from source fields.</p>' +
      '<div class="import-drop"><label for="import-file">Choose an .xlsx, .xls, or .csv file</label><input id="import-file" type="file" accept=".xlsx,.xls,.csv"><span class="toolbar-help">No records are changed until you review the preview and confirm import.</span></div>' +
      preview + '</section><section class="panel"><h2 class="section-title">Export and backup</h2><p class="toolbar-help">Exports all records with a single header row and formula-derived values.</p>' +
      '<div class="view-actions"><button class="btn btn-primary" type="button" data-action="export">Download Excel workbook</button>' + adminTools + '</div></section>';
  }
  function getFilterValues() {
    return {
      search: byId('ledger-search') ? byId('ledger-search').value : (state.search || ''),
      status: byId('ledger-status') ? byId('ledger-status').value : (state.status || 'ALL')
    };
  }
  function applyFilters() {
    const filter = getFilterValues();
    state.search = filter.search;
    state.status = filter.status;
    const query = filter.search.trim().toLowerCase();
    state.filtered = state.records.filter(function (record) {
      const statusMatches = filter.status === 'ALL' || record.toPayStatus === filter.status;
      if (!statusMatches) return false;
      if (!query) return true;
      return ['transportName', 'lrNo', 'truckNo', 'from', 'to', 'accountNo', 'ifscCode', 'bank', 'remarks']
        .some(function (key) { return String(record[key] || '').toLowerCase().includes(query); });
    }).sort(function (a, b) {
      const comparison = String(a[state.sortField] || '').localeCompare(String(b[state.sortField] || ''), undefined, { numeric: true });
      return state.sortDirection * (comparison || sortBySlNo(a, b));
    });
  }
  function render() {
    applyFilters();
    const pages = {
      dashboard: ['Dashboard', 'Shipment activity and financial reconciliation', renderDashboard],
      ledger: ['Shipment Ledger', 'Search, filter, add and edit shipment records', renderLedger],
      sheet: ['Live Excel Sheet', 'Spreadsheet-style view of the current ledger', renderSheet],
      import: ['Excel Import & Export', 'Bring in shipment rows or download the live ledger', renderImport]
    };
    const page = pages[state.view] || pages.dashboard;
    byId('page-title').textContent = page[0];
    byId('page-subtitle').textContent = page[1];
    byId('view-container').innerHTML = (state.preview ?
      '<div class="notice notice-info">Read-only UI preview. No backend is connected and no shipment data is loaded.</div>' : '') + page[2]();
    document.querySelectorAll('.nav-tab').forEach(function (button) {
      button.classList.toggle('active', button.dataset.view === state.view);
    });
  }

  function withDerivedValues(record) {
    const result = Object.assign({}, record);
    const calculation = CALC.calculateShipment(result);
    result.pendingTobilled = calculation.pendingTobilled;
    result.pendingAmount = calculation.pendingAmount;
    return result;
  }
  async function refreshRecords() {
    setCloudStatus(false, 'Syncing…');
    const result = await window.BrokerApi.list();
    if (!Array.isArray(result.records)) throw new Error('Backend response did not contain shipment records.');
    if (Number(result.version) >= state.version) {
      state.records = result.records.map(withDerivedValues);
      state.version = Number(result.version) || state.version;
    }
    setCloudStatus(true, 'Cloud connected');
    byId('footer-sync').textContent = 'Last synced ' + new Date().toLocaleTimeString();
    render();
  }
  async function initializeSession() {
    const existing = getCurrentSession();
    if (!existing || !existing.token) {
    showAuth();
    return;
    }
    try {
    await refreshRecords();
    showApp(existing);
    } catch (error) {
    sessionStorage.removeItem('broker-ledger-session');
    showAuth('Your session could not be verified: ' + error.message);
    }
  }
  function formRecord() {
    const formData = new FormData(byId('shipment-form'));
    const record = {};
    FIELD_ORDER.forEach(function (field) {
    if (field === 'slNo' || field === 'pendingTobilled' || field === 'pendingAmount') return;
    const value = formData.get(field);
    record[field] = value === null ? '' : String(value).trim();
    });
    const calculated = CALC.calculateShipment(record);
    record.pendingTobilled = calculated.pendingTobilled;
    record.pendingAmount = calculated.pendingAmount;
    return record;
  }
  function updateFormCalculations() {
    if (!byId('shipment-form')) return;
    const record = formRecord();
    const computed = CALC.calculateShipment(record);
    byId('shipment-form').elements.pendingTobilled.value =
    computed.pendingTobilled === null ? '' : CALC.fromPaise(Math.round(computed.pendingTobilled * 100)).toLocaleString('en-IN');
    byId('shipment-form').elements.pendingAmount.value =
    computed.pendingAmount === null ? '' : CALC.fromPaise(Math.round(computed.pendingAmount * 100)).toLocaleString('en-IN');
  }
  function setFormValues(record) {
    const form = byId('shipment-form');
    form.reset();
    FIELD_ORDER.forEach(function (field) {
    if (field === 'slNo') return;
    const input = form.elements[field];
    if (!input) return;
    let value = record && record[field] !== null && record[field] !== undefined ? record[field] : '';
    if (DATE_FIELDS.has(field)) value = toDateInput(value);
    if (field === 'pendingTobilled' || field === 'pendingAmount') {
      value = value === '' || value === null ? '' : displayMoney(value).replace(/^₹/, '');
    }
    input.value = value;
    });
    if (!record) form.elements.toPayStatus.value = 'TOBILLED';
    updateFormCalculations();
  }
  function openShipmentDialog(mode, id) {
    const existing = id ? state.records.find(function (record) { return record.id === id; }) : null;
    if (id && !existing) {
    toast('This shipment is no longer available. Refresh the ledger and try again.', 'error');
    return;
    }
    state.editingId = id || null;
    state.formMode = mode;
    const form = byId('shipment-form');
    setFormValues(existing);
    const viewOnly = mode === 'view';
    Array.from(form.elements).forEach(function (element) {
    if (element.name) element.disabled = viewOnly || element.readOnly;
    });
    byId('save-shipment').hidden = viewOnly;
    byId('cancel-dialog').textContent = viewOnly ? 'Close' : 'Cancel';
    byId('shipment-dialog-title').textContent = viewOnly ? 'Shipment Details' : (existing ? 'Edit Shipment' : 'Add Shipment');
    byId('form-error').hidden = true;
    byId('shipment-dialog').showModal();
  }
  function closeShipmentDialog() {
    if (byId('shipment-dialog').open) byId('shipment-dialog').close();
    state.editingId = null;
  }
  function errorList(errors) {
    return Object.keys(errors).map(function (field) {
    return (LABELS[field] || field) + ': ' + errors[field];
    }).join(' ');
  }
  async function saveShipment(event) {
    event.preventDefault();
    if (state.busy || state.formMode === 'view') return;
    const record = formRecord();
    const validation = VALIDATION.validateShipment(record);
    const errorBox = byId('form-error');
    if (!validation.valid) {
    errorBox.textContent = errorList(validation.errors);
    errorBox.hidden = false;
    return;
    }
    const isEditing = Boolean(state.editingId);
    setBusy(true);
    let response;
    try {
      if (state.editingId) response = await window.BrokerApi.update(state.editingId, record);
      else response = await window.BrokerApi.create(record);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      setBusy(false);
      return;
    }
    closeShipmentDialog();
    try {
      await refreshRecords();
      toast((isEditing ? 'Shipment updated.' : 'Shipment saved.') + (response.warning ? ' ' + response.warning : ''), response.warning ? 'error' : 'success');
    } catch (error) {
      setCloudStatus(false, 'Offline — last data may be stale');
      byId('footer-sync').textContent = 'Save completed, but refresh failed; displayed data may be outdated.';
      toast((isEditing ? 'Shipment updated.' : 'Shipment saved.') + ' Refresh failed: ' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function deleteShipment(id) {
    if (!state.user || state.user.role !== 'Admin') {
    toast('Only an administrator can delete a shipment.', 'error');
    return;
    }
    const record = state.records.find(function (item) { return item.id === id; });
    if (!record || !window.confirm('Delete shipment LR No ' + record.lrNo + '? This cannot be undone.')) return;
    let response;
    try {
    response = await window.BrokerApi.remove(id);
    } catch (error) {
    toast(error.message, 'error');
    return;
    }
    try {
    await refreshRecords();
    toast('Shipment deleted.' + (response.warning ? ' ' + response.warning : ''), response.warning ? 'error' : 'success');
    } catch (error) {
    setCloudStatus(false, 'Offline — last data may be stale');
    toast('Shipment was deleted, but refresh failed: ' + error.message, 'error');
    }
  }
  function dateForExport(value) {
    if (!value) return '';
    const text = String(value);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return iso ? iso[3] + '-' + iso[2] + '-' + iso[1] : text;
  }
  function numericExportValue(value) {
    if (value === null || value === undefined || value === '') return '';
    const parsed = CALC.parseMoney(value);
    return parsed.ok ? CALC.fromPaise(parsed.paise) : String(value);
  }
  function exportWorkbook() {
    if (!window.XLSX) {
    toast('The local Excel library did not load. Reload the page and try again.', 'error');
    return;
    }
    const data = state.records.slice().sort(sortBySlNo).map(withDerivedValues);
    const rows = data.map(function (record) {
    return FIELD_ORDER.map(function (field) {
      if (DATE_FIELDS.has(field)) return dateForExport(record[field]);
      if (field === 'codToPay') {
        const parsed = CALC.parseMoney(record[field], { allowEmpty: true });
        return parsed.ok && !parsed.empty ? CALC.fromPaise(parsed.paise) : (record[field] || '');
      }
      if (MONEY_FIELDS.has(field)) return numericExportValue(record[field]);
      return record[field] === null || record[field] === undefined ? '' : record[field];
    });
    });
    const summary = CALC.summarize(data);
    const totals = Array(FIELD_ORDER.length).fill('');
    totals[0] = 'TOTAL (' + data.length + ' shipments)';
    totals[10] = CALC.fromPaise(summary.freightPaise);
    totals[11] = CALC.fromPaise(summary.tMPaise);
    totals[12] = CALC.fromPaise(summary.advancePaise - summary.advance2Paise - summary.advance3Paise);
    totals[13] = CALC.fromPaise(summary.advance2Paise);
    totals[14] = CALC.fromPaise(summary.advance3Paise);
    totals[17] = CALC.fromPaise(summary.pendingTobilledPaise);
    totals[18] = CALC.fromPaise(summary.extraAmountPaise);
    totals[20] = CALC.fromPaise(summary.pMPaise);
    totals[21] = CALC.fromPaise(summary.pendingAmountPaise);
    totals[16] = CALC.fromPaise(summary.codToPayPaise);
    const worksheet = window.XLSX.utils.aoa_to_sheet([FIELD_ORDER.map(function (field) { return LABELS[field]; })].concat(rows, [totals]));
    worksheet['!cols'] = FIELD_ORDER.map(function (field) { return { wch: Math.max(12, Math.min(30, LABELS[field].length + 3)) }; });
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Broker Ledger');
    window.XLSX.writeFile(workbook, 'Broker_Ledger_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }
  function normalizeHeader(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const IMPORT_HEADERS = {
    slNo: ['slno', 'slnumber', 'serialno'], transportName: ['trspname', 'transportname', 'tradertransportname'],
    date: ['date'], lrNo: ['lrno'], truckNo: ['truckno', 'vehiclenumber'],
    from: ['from', 'fromcity'], to: ['to', 'tocity'], accountNo: ['accountno'],
    ifscCode: ['ifsccode', 'ifsc'], bank: ['paymentmade', 'bank', 'bankname'],
    freight: ['fright', 'freight'], tM: ['tm', 't/m'], advance: ['advance'],
    advance2: ['advance2'], advance3: ['advance3'], podReceivedDate: ['podrecddate', 'podreceiveddate'],
    codToPay: ['cashondeliverycodatopayftopay', 'codtopay', 'cashondelivery'],
    pendingTobilled: ['pendingamounttobilled'], extraAmount: ['extraamount'],
    pmPaDate: ['pmapadate', 'pmapdate'], pM: ['pm'], pendingAmount: ['pendingamount'],
    podAmountStatus: ['podamountstatus'], remarks: ['remarksnote', 'remarks', 'note'],
    toPayStatus: ['topaystatus']
  };
  function parseImportDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return String(value.getUTCFullYear()) + '-' + String(value.getUTCMonth() + 1).padStart(2, '0') + '-' + String(value.getUTCDate()).padStart(2, '0');
    }
    if (typeof value === 'number' && window.XLSX && window.XLSX.SSF) {
    const date = window.XLSX.SSF.parse_date_code(value);
    if (date) return String(date.y).padStart(4, '0') + '-' + String(date.m).padStart(2, '0') + '-' + String(date.d).padStart(2, '0');
    }
    const text = String(value || '').trim();
    const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) return dmy[3] + '-' + dmy[2].padStart(2, '0') + '-' + dmy[1].padStart(2, '0');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    return text;
  }
  function recordIdentity(record) {
    return [record.lrNo, formatDate(record.date), record.truckNo].map(function (item) {
    return String(item || '').trim().toLowerCase();
    }).join('|');
  }
  function rowToRecord(row, headers) {
    const record = {};
    const positions = {};
    headers.forEach(function (value, index) {
    const normalized = normalizeHeader(value);
    Object.keys(IMPORT_HEADERS).forEach(function (field) {
      if (positions[field] !== undefined) return;
      if (IMPORT_HEADERS[field].includes(normalized)) positions[field] = index;
    });
    });
    FIELD_ORDER.forEach(function (field) {
    if (field === 'pendingTobilled' || field === 'pendingAmount' || field === 'slNo') return;
    if (positions[field] === undefined) return;
    let value = row[positions[field]];
    if (DATE_FIELDS.has(field)) value = parseImportDate(value);
    if (value === null || value === undefined) value = '';
    if (field === 'codToPay') record[field] = typeof value === 'number' ? value : String(value).trim();
    else record[field] = String(value).trim();
    });
    const validation = VALIDATION.validateShipment(record);
    if (!validation.valid) throw new Error(errorList(validation.errors));
    record.pendingTobilled = validation.calculated.pendingTobilled;
    record.pendingAmount = validation.calculated.pendingAmount;
    return record;
  }
  function rowIsRepeatedHeader(row, headerKeys) {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('slno') && (normalized.includes('trspname') || normalized.includes('transportname')) &&
    normalized.includes('topaystatus') && headerKeys.length > 4;
  }
  async function readImportFile(file) {
    if (!window.XLSX) throw new Error('The local Excel library is unavailable.');
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
    if (!workbook.SheetNames.length) throw new Error('The selected workbook has no worksheets.');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const headerIndex = matrix.findIndex(function (row) {
    const keys = row.map(normalizeHeader);
    return keys.includes('slno') && (keys.includes('trspname') || keys.includes('transportname')) && keys.includes('topaystatus');
    });
    if (headerIndex < 0) throw new Error('Could not find the Broker Ledger header row in this worksheet.');
    const headers = matrix[headerIndex];
    const records = [];
    for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (!row || row.every(function (value) { return value === '' || value === null || value === undefined; })) continue;
    if (rowIsRepeatedHeader(row, headers)) continue;
    records.push(rowToRecord(row, headers));
    }
    if (!records.length) throw new Error('No valid shipment rows were found.');
    const existingKeys = new Set(state.records.map(recordIdentity));
    const seen = new Set();
    const duplicates = [];
    records.forEach(function (record, index) {
    const key = recordIdentity(record);
    if (existingKeys.has(key) || seen.has(key)) duplicates.push(index + 1);
    seen.add(key);
    });
    state.pendingImport = {
    records: records,
    duplicates: duplicates,
    error: duplicates.length ? 'Duplicate shipment identity found. Remove duplicates from this workbook before importing.' : ''
    };
    render();
  }
  async function confirmImport() {
    if (!state.pendingImport || state.pendingImport.error) return;
    if (!window.confirm('Import ' + state.pendingImport.records.length + ' shipments? Existing records will not be overwritten.')) return;
    const records = state.pendingImport.records;
    setBusy(true);
    let result;
    try {
    result = await window.BrokerApi.importMany(records);
    state.pendingImport = null;
    } catch (error) {
    toast(error.message, 'error');
    setBusy(false);
    return;
    }
    try {
    await refreshRecords();
    toast((result.imported || records.length) + ' shipments imported.' + (result.warning ? ' ' + result.warning : ''), result.warning ? 'error' : 'success');
    } catch (error) {
    setCloudStatus(false, 'Offline — last data may be stale');
    toast((result.imported || records.length) + ' shipments imported, but refresh failed: ' + error.message, 'error');
    } finally {
    setBusy(false);
    }
  }
  async function createBackup() {
    try {
    const result = await window.BrokerApi.backup();
    toast('Cloud backup created: ' + result.name + (result.warning ? '. ' + result.warning : ''), result.warning ? 'error' : 'success');
    } catch (error) {
    toast(error.message, 'error');
    }
  }
  async function handleLogin(event) {
    event.preventDefault();
    if (state.busy) return;
    if (!window.BrokerApi.configured()) {
    setAuthMessage('Backend setup required. Deploy backend/Code.gs, then add its Web App URL to js/config.js. See README.md.', true);
    return;
    }
    const username = byId('login-username').value.trim();
    const password = byId('login-password').value;
    setBusy(true);
    try {
    const user = await window.BrokerApi.login(username, password);
    sessionStorage.setItem('broker-ledger-session', JSON.stringify(user));
    byId('login-password').value = '';
    state.user = user;
    await refreshRecords();
    showApp(user);
    } catch (error) {
    sessionStorage.removeItem('broker-ledger-session');
    state.user = null;
    showAuth(error.message);
    } finally {
    setBusy(false);
    }
  }
  async function logout() {
    try { await window.BrokerApi.logout(); }
    catch (error) { toast('Cloud logout could not be confirmed. The local session was cleared.', 'error'); }
    sessionStorage.removeItem('broker-ledger-session');
    state.user = null;
    state.records = [];
    showAuth();
  }
  function toggleSidebar(open) {
    byId('sidebar').classList.toggle('open', open);
    byId('sidebar-scrim').classList.toggle('visible', open);
  }
  function bindEvents() {
    byId('login-form').addEventListener('submit', handleLogin);
    byId('logout-button').addEventListener('click', logout);
    byId('add-shipment-top').addEventListener('click', function () { openShipmentDialog('edit'); });
    byId('close-dialog').addEventListener('click', closeShipmentDialog);
    byId('cancel-dialog').addEventListener('click', closeShipmentDialog);
    byId('shipment-dialog').addEventListener('click', function (event) {
    if (event.target === byId('shipment-dialog')) closeShipmentDialog();
    });
    byId('shipment-form').addEventListener('input', updateFormCalculations);
    byId('shipment-form').addEventListener('change', updateFormCalculations);
    byId('shipment-form').addEventListener('submit', saveShipment);
    byId('sidebar-open').addEventListener('click', function () { toggleSidebar(true); });
    byId('sidebar-close').addEventListener('click', function () { toggleSidebar(false); });
    byId('sidebar-scrim').addEventListener('click', function () { toggleSidebar(false); });
    document.querySelectorAll('.nav-tab').forEach(function (button) {
    button.addEventListener('click', function () {
      state.view = button.dataset.view;
      toggleSidebar(false);
      render();
    });
    });
    byId('view-container').addEventListener('input', function (event) {
    if (event.target.id !== 'ledger-search') return;
    const position = event.target.selectionStart;
    state.search = event.target.value;
    render();
    const search = byId('ledger-search');
    if (search) { search.focus(); search.setSelectionRange(position, position); }
    });
    byId('view-container').addEventListener('change', function (event) {
    if (event.target.id === 'ledger-status') {
      state.status = event.target.value;
      render();
    }
    if (event.target.id === 'sheet-zoom') {
      const table = document.querySelector('.sheet-table');
      if (table) table.style.zoom = event.target.value;
    }
    if (event.target.id === 'import-file' && event.target.files && event.target.files[0]) {
      readImportFile(event.target.files[0]).catch(function (error) { toast(error.message, 'error'); });
    }
    });
    byId('view-container').addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'go-ledger') { state.view = 'ledger'; render(); }
    if (action === 'view') openShipmentDialog('view', button.dataset.id);
    if (action === 'edit') openShipmentDialog('edit', button.dataset.id);
    if (action === 'delete') deleteShipment(button.dataset.id);
    if (action === 'export') exportWorkbook();
    if (action === 'fullscreen') {
      const sheet = byId('sheet-wrap');
      if (sheet) sheet.classList.toggle('fullscreen');
    }
    if (action === 'print') window.print();
    if (action === 'confirm-import') confirmImport();
    if (action === 'cancel-import') { state.pendingImport = null; render(); }
    if (action === 'backup') createBackup();
    if (action === 'refresh') refreshRecords().catch(function (error) {
      setCloudStatus(false, 'Offline — last data may be stale');
      byId('footer-sync').textContent = 'Refresh failed: ' + error.message;
      toast(error.message, 'error');
    });
    });
    window.addEventListener('broker:session-invalid', function () {
    state.user = null;
    state.records = [];
    showAuth('Your session expired. Please sign in again.');
    });
  }

  bindEvents();
  if (!window.BrokerApi.configured() && new URLSearchParams(location.search).get('preview') === '1') {
    state.preview = true;
    showApp({ username: 'Preview', name: 'Read-only preview', role: 'Employee' });
    setCloudStatus(false, 'Preview only');
  } else if (!window.BrokerApi.configured()) {
    setAuthMessage('Backend is not configured. Deploy the independent Apps Script and enter its Web App URL in js/config.js.', false);
  }
  if (!state.preview) {
    initializeSession();
    window.setInterval(function () {
      if (!state.user || state.busy) return;
      refreshRecords().catch(function () {
        setCloudStatus(false, 'Offline — last data may be stale');
        byId('footer-sync').textContent = 'Cloud sync is unavailable; displayed data may be outdated.';
      });
    }, 60000);
  }
})();
