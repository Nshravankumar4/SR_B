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
    editingUpdatedAt: '',
    codToPayNote: 'if Tobilled NA',
    pendingImport: null,
    busy: false,
    loadingRecords: false,
    loadError: '',
    syncChecking: false,
    preview: false,
    version: 0,
    sortField: 'slNo',
    sortDirection: 1,
    toastTimer: null,
    sheetFilter: null
  };

  const FIELD_ORDER = [
    'slNo', 'transportName', 'date', 'lrNo', 'truckNo', 'from', 'to', 'accountNo',
    'ifscCode', 'bank', 'freight', 'tM', 'advance', 'date1', 'advance2', 'date2', 'advance3', 'date3',
    'unloadingDate', 'podReceivedDate', 'balanceDate', 'codToPay', 'pendingTobilled', 'extraAmount', 'pmPaDate',
    'pM', 'pendingAmount', 'podAmountStatus', 'remarks', 'toPayStatus'
  ];
  const LABELS = {
    slNo: 'SL NO', transportName: 'TRSP NAME', date: 'DATE', lrNo: 'LR NO', truckNo: 'TRUCK NO',
    from: 'FROM', to: 'TO', accountNo: 'ACCOUNT NO', ifscCode: 'IFSC CODE', bank: 'PAYMENT MADE',
    freight: 'FRIGHT', tM: 'T/M', advance: 'ADVANCE', date1: '1ST ADV DATE',
    advance2: 'ADVANCE2', date2: '2ND ADV DATE', advance3: 'ADVANCE3', date3: '3RD ADV DATE',
    unloadingDate: 'UNLOADING DATE', podReceivedDate: 'POD RECD Date', balanceDate: 'BALANCE DATE',
    codToPay: 'Cash on Delivery (COD) :A/Topay&Ftopay',
    pendingTobilled: 'Pending Amount: Tobilled', extraAmount: 'Extra Amount',
    pmPaDate: 'PM/PA Date', pM: 'P/M', pendingAmount: 'Pending Amount',
    podAmountStatus: 'POD Amount Status', remarks: 'REMARKS / NOTE', toPayStatus: 'ToPayStatus'
  };
  const MONEY_FIELDS = new Set([
    'freight', 'tM', 'advance', 'advance2', 'advance3',
    'pendingTobilled', 'extraAmount', 'pM', 'pendingAmount'
  ]);
  const DATE_FIELDS = new Set(['date', 'date1', 'date2', 'date3', 'unloadingDate', 'podReceivedDate', 'pmPaDate', 'balanceDate']);

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
    const text = String(value || '').trim();
    const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) return dmy[3] + '-' + dmy[2].padStart(2, '0') + '-' + dmy[1].padStart(2, '0');
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
    if (!box) return;
    if (!text) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
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
    else setAuthMessage('', false);
    selectLoginUser('Admin');
  }
  function showApp(user) {
    state.user = user;
    byId('auth-view').hidden = true;
    byId('app-shell').hidden = false;
    byId('add-shipment-top').hidden = state.preview || state.loadingRecords || Boolean(state.loadError);
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
  function headerCell(field, sortable) {
    const cls = MONEY_FIELDS.has(field) ? ' class="numeric' + (field === 'pendingAmount' || field === 'pendingTobilled' ? ' calculated' : '') + '"' :
      field === 'toPayStatus' ? ' class="status-head"' : '';
    if (!sortable) return '<th' + cls + '>' + escapeHtml(LABELS[field]) + '</th>';
    const active = state.sortField === field;
    const sortOrder = active ? (state.sortDirection === 1 ? 'ascending' : 'descending') : 'none';
    const indicator = active ? (state.sortDirection === 1 ? ' ▲' : ' ▼') : '';
    return '<th' + cls + ' aria-sort="' + sortOrder + '"><button class="sort-button" type="button" data-action="sort" data-field="' +
      escapeHtml(field) + '" aria-label="Sort by ' + escapeHtml(LABELS[field]) + '">' +
      escapeHtml(LABELS[field] + indicator) + '</button></th>';
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
  function parseRecordDate(val) {
    if (!val) return null;
    const str = String(val).trim();
    if (!str) return null;
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10) - 1;
      const day = parseInt(ymd[3], 10);
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const fallback = new Date(str);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  function getShipmentPendingSince(rec) {
    return rec.balanceDate || rec.unloadingDate || rec.date1 || rec.date || '';
  }

  function getShipmentDaysPending(rec) {
    const dateStr = getShipmentPendingSince(rec);
    const d = parseRecordDate(dateStr);
    if (!d) return 0;
    const diffMs = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  function isShipmentOverdue(rec) {
    const derived = withDerivedValues(rec);
    const parsed = CALC.parseMoney(derived.pendingAmount, { allowEmpty: true });
    if (!parsed.ok || parsed.empty || parsed.paise <= 0) return false;
    const days = getShipmentDaysPending(rec);
    if (days > 15) return true;
    if (rec.balanceDate) {
      const bd = parseRecordDate(rec.balanceDate);
      if (bd && bd.getTime() < (Date.now() - 24 * 60 * 60 * 1000)) return true;
    }
    return false;
  }

  function isShipmentPodMissing(rec) {
    const pod = String(rec.podReceivedDate || '').trim().toUpperCase();
    return !pod || pod === 'PENDING' || pod === 'NO' || pod === '0';
  }

  function isShipmentOpenIssue(rec) {
    if (!rec.lrNo || !String(rec.lrNo).trim()) return true;
    if (!rec.transportName || !String(rec.transportName).trim()) return true;
    if (!rec.truckNo || !String(rec.truckNo).trim()) return true;
    const freightParsed = CALC.parseMoney(rec.freight, { allowEmpty: true });
    if (!freightParsed.ok || freightParsed.empty || freightParsed.paise <= 0) return true;
    const derived = withDerivedValues(rec);
    const pendingParsed = CALC.parseMoney(derived.pendingAmount, { allowEmpty: true });
    if (pendingParsed.ok && !pendingParsed.empty && pendingParsed.paise < 0) return true;
    return false;
  }

  function renderMetric(label, value, note) {
    return '<article class="metric-card"><span class="metric-label">' + escapeHtml(label) +
      '</span><strong class="metric-value">' + escapeHtml(value) +
      '</strong>' + (note ? '<span class="metric-note">' + escapeHtml(note) + '</span>' : '') + '</article>';
  }

  function renderDashboard() {
    const summary = numericTotals(state.records);
    const userName = state.user && (state.user.name || state.user.username);

    // Status section cards (Section A)
    const statusCards = [
      { status: 'TOBILLED', title: 'TOBILLED', colorClass: 'status-card-tobilled', count: summary.statusCounts['TOBILLED'] || 0, badgeClass: 'status-badge-tobilled' },
      { status: 'A/TO-PAY', title: 'A/TO-PAY', colorClass: 'status-card-atopay', count: summary.statusCounts['A/TO-PAY'] || 0, badgeClass: 'status-badge-atopay' },
      { status: 'F/TO-PAY', title: 'F/TO-PAY', colorClass: 'status-card-ftopay', count: summary.statusCounts['F/TO-PAY'] || 0, badgeClass: 'status-badge-ftopay' }
    ];

    const statusGridHtml = statusCards.map(function (item) {
      return '<button type="button" class="control-status-card ' + item.colorClass + '" data-action="sheet-filter" data-filter-type="status" data-filter-value="' + escapeHtml(item.status) + '" data-filter-label="Status: ' + escapeHtml(item.status) + '" title="Click to view ' + item.title + ' shipments in Live Excel Sheet">' +
        '<div class="control-status-top">' +
          '<span class="control-status-count">' + item.count + '</span>' +
          '<span class="control-status-badge ' + item.badgeClass + '">' + escapeHtml(item.title) + '</span>' +
        '</div>' +
        '<div class="control-status-bottom">' +
          '<span class="control-status-sub">' + (item.count === 1 ? 'Shipment' : 'Shipments') + '</span>' +
          '<span class="control-card-cta">View in Sheet →</span>' +
        '</div>' +
      '</button>';
    }).join('');

    // Process Action Cards & Transporter-wise Balance Details (Section B & C)
    let pendingCount = 0;
    let pendingTotalPaise = 0;
    let overdueCount = 0;
    let overdueTotalPaise = 0;
    let podMissingCount = 0;
    let openIssuesCount = 0;
    const pendingShipmentRows = [];

    (state.records || []).forEach(function (rec) {
      const derived = withDerivedValues(rec);
      const parsedPending = CALC.parseMoney(derived.pendingAmount, { allowEmpty: true });
      const hasPending = parsedPending.ok && !parsedPending.empty && parsedPending.paise > 0;
      const days = getShipmentDaysPending(rec);
      const overdue = isShipmentOverdue(rec);
      const podMissing = isShipmentPodMissing(rec);
      const openIssue = isShipmentOpenIssue(rec);

      if (hasPending) {
        pendingCount++;
        pendingTotalPaise += parsedPending.paise;
        if (overdue) {
          overdueCount++;
          overdueTotalPaise += parsedPending.paise;
        }
        const trsp = String(rec.transportName || '').trim() || 'Unassigned Transporter';
        const pendingSince = getShipmentPendingSince(rec);
        pendingShipmentRows.push({
          record: rec,
          transporter: trsp,
          lrNo: rec.lrNo || '—',
          truckNo: rec.truckNo || '—',
          balancePaise: parsedPending.paise,
          pendingSince: pendingSince ? formatDate(pendingSince) : '—',
          daysPending: days,
          isOverdue: overdue
        });
      }
      if (podMissing) podMissingCount++;
      if (openIssue) openIssuesCount++;
    });

    const actionCards = [
      {
        category: 'pending',
        title: 'Pending',
        badgeText: '⏳ Outstanding',
        badgeClass: 'badge-pending',
        subtitle: 'Outstanding payments',
        count: pendingCount,
        amount: formatMoneyPaise(pendingTotalPaise),
        note: 'Shipments with balance payable',
        filterLabel: 'Pending Balance Shipments'
      },
      {
        category: 'overdue',
        title: 'Overdue',
        badgeText: '⚠️ Past Due (>15d)',
        badgeClass: 'badge-overdue',
        subtitle: 'Payments past due',
        count: overdueCount,
        amount: formatMoneyPaise(overdueTotalPaise),
        note: 'Payments pending > 15 days',
        filterLabel: 'Overdue Shipments (>15 days)'
      },
      {
        category: 'pod_missing',
        title: 'POD Missing',
        badgeText: '📄 Awaiting POD',
        badgeClass: 'badge-pod-missing',
        subtitle: 'Shipments awaiting POD',
        count: podMissingCount,
        amount: podMissingCount + (podMissingCount === 1 ? ' shipment' : ' shipments'),
        note: 'Missing delivery proof confirmation',
        filterLabel: 'POD Missing Shipments'
      },
      {
        category: 'open_issues',
        title: 'Open Issues',
        badgeText: '🔍 Unresolved',
        badgeClass: 'badge-open-issues',
        subtitle: 'Incomplete or unresolved items',
        count: openIssuesCount,
        amount: openIssuesCount + (openIssuesCount === 1 ? ' item' : ' items'),
        note: 'Missing LR/Truck/Transporter or discrepancy',
        filterLabel: 'Open Issues / Unresolved Records'
      }
    ];

    const actionCardsHtml = actionCards.map(function (card) {
      return '<button type="button" class="control-action-card" data-action="sheet-filter" data-filter-type="category" data-filter-value="' + card.category + '" data-filter-label="' + escapeHtml(card.filterLabel) + '" title="Click to view ' + card.title + ' in Live Excel Sheet">' +
        '<div class="action-card-header">' +
          '<span class="action-card-badge ' + card.badgeClass + '">' + card.badgeText + '</span>' +
          '<span class="action-card-count">' + card.count + '</span>' +
        '</div>' +
        '<div class="action-card-body">' +
          '<h4 class="action-card-title">' + card.title + '</h4>' +
          '<p class="action-card-sub">' + card.subtitle + '</p>' +
          '<strong class="action-card-amount">' + card.amount + '</strong>' +
          '<span class="action-card-note">' + card.note + '</span>' +
        '</div>' +
        '<div class="action-card-footer">' +
          '<span class="control-card-cta">Open in Live Sheet →</span>' +
        '</div>' +
      '</button>';
    }).join('');

    // Balance Payment Transporter-wise Table Rows
    pendingShipmentRows.sort(function (a, b) {
      const trspCmp = a.transporter.localeCompare(b.transporter);
      if (trspCmp !== 0) return trspCmp;
      return b.daysPending - a.daysPending;
    });

    const pendingTableRows = pendingShipmentRows.length ? pendingShipmentRows.map(function (row) {
      const statusBadge = row.isOverdue
        ? '<span class="status-badge overdue">⚠️ Overdue</span>'
        : '<span class="status-badge pending">⏳ Pending</span>';
      const daysBadge = '<span class="days-pill ' + (row.isOverdue ? 'pill-overdue' : 'pill-normal') + '">' + row.daysPending + ' days</span>';
      return '<tr>' +
        '<td><button type="button" class="table-transporter-btn" data-action="sheet-filter" data-filter-type="transporter" data-filter-value="' + escapeHtml(row.transporter) + '" data-filter-label="Transporter: ' + escapeHtml(row.transporter) + '" title="Click to filter sheet by ' + escapeHtml(row.transporter) + '"><strong>' + escapeHtml(row.transporter) + '</strong> <span class="filter-icon">🔍</span></button></td>' +
        '<td>' + escapeHtml(row.lrNo) + '</td>' +
        '<td>' + escapeHtml(row.truckNo) + '</td>' +
        '<td class="numeric" style="color: #b91c1c; font-weight: 800;">' + formatMoneyPaise(row.balancePaise) + '</td>' +
        '<td style="text-align: center;">' + escapeHtml(row.pendingSince) + '</td>' +
        '<td style="text-align: center;">' + daysBadge + '</td>' +
        '<td style="text-align: center;">' + statusBadge + '</td>' +
        '<td style="text-align: center;"><button type="button" class="btn btn-secondary btn-sm" data-action="sheet-filter" data-filter-type="transporter" data-filter-value="' + escapeHtml(row.transporter) + '" data-filter-label="Transporter: ' + escapeHtml(row.transporter) + '">View in Sheet</button></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="8" class="empty-state">🎉 All caught up — no outstanding balance payments!</td></tr>';

    // Financial Metrics Summary
    const metrics = [
      ['Total Ledger Closing', formatMoneyPaise(summary.pendingAmountPaise), 'Net outstanding ledger closing'],
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

    return '<section class="dashboard-hero-banner"><div class="banner-welcome">' +
      '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.3rem;">' +
      '<h2 style="margin:0;">👋 Hello, ' + escapeHtml(userName || 'there') + '! Welcome to SR Brokerage Ledger</h2>' +
      '<span class="control-centre-live-badge">● SHIPMENT CONTROL CENTRE</span></div>' +
      '<p>Live shipment overview · Status distribution, outstanding payments, and action items.</p></div>' +
      '<div class="banner-quick-actions">' +
      (state.preview || state.loadingRecords || state.loadError ? '' : '<button class="btn btn-primary" type="button" data-action="add-shipment">＋ Add Shipment</button>') +
      '<button class="btn btn-secondary" type="button" data-action="go-sheet">View Excel Sheet</button>' +
      '<button class="btn btn-secondary" type="button" data-action="export">Export Excel</button>' +
      '</div></section>' +
      '<section class="panel control-centre-panel"><div class="section-header-wrap"><div>' +
      '<h3 class="section-title">📊 Shipment Status</h3>' +
      '<p class="toolbar-help">Total volume by payment status. Click any status card to filter in Live Excel Sheet.</p></div>' +
      '<span class="section-hint-pill">⚡ Click card to filter sheet</span></div>' +
      '<div class="status-control-grid">' + statusGridHtml + '</div></section>' +
      '<section class="panel control-centre-panel"><div class="section-header-wrap"><div>' +
      '<h3 class="section-title">⚡ Payment and Issue Overview</h3>' +
      '<p class="toolbar-help">High-priority operational action items and outstanding balances. Click any card to view records.</p></div>' +
      '<span class="section-hint-pill">⚡ Click card to filter sheet</span></div>' +
      '<div class="action-cards-grid">' + actionCardsHtml + '</div></section>' +
      '<section class="panel control-centre-panel"><div class="section-header-wrap"><div>' +
      '<h3 class="section-title">💰 Balance Payment – Transporter-wise</h3>' +
      '<p class="toolbar-help">Pending freight balances grouped transporter-wise with duration and payment status. Click a transporter name to filter the Live Excel Sheet.</p></div>' +
      '<div class="section-header-actions"><span class="balance-summary-pill">Total Pending: <strong>' + formatMoneyPaise(pendingTotalPaise) + '</strong> (' + pendingShipmentRows.length + ' shipments)</span></div></div>' +
      '<div class="table-wrap" tabindex="0" aria-label="Transporter balance payments table"><table class="ledger-table"><thead><tr>' +
      '<th>Transporter Name</th><th>LR Number</th><th>Truck Number</th><th class="numeric">Balance Amount</th><th style="text-align:center;">Pending Since</th><th style="text-align:center;">Days Pending</th><th style="text-align:center;">Payment Status</th><th style="text-align:center;">Action</th>' +
      '</tr></thead><tbody>' + pendingTableRows + '</tbody></table></div></section>' +
      '<section class="panel"><div class="section-header-wrap"><div>' +
      '<h3 class="section-title">📈 Ledger Closing &amp; Financial Summary</h3>' +
      '<p class="toolbar-help">Aggregated financial figures across all shipments and payment statuses.</p></div></div>' +
      '<div class="metrics-grid">' + cards + '</div></section>' +
      '<section class="panel"><div class="toolbar"><div><h3 class="section-title">Recent shipments</h3><p class="toolbar-help">Calculated balances update from the source values.</p></div>' +
      '<button class="btn btn-secondary" type="button" data-action="go-ledger">Open Shipment Ledger</button></div>' +
      renderTable(state.records.slice().sort(sortBySlNo).slice(0, 5), false) + '</section>';
  }
  function sortBySlNo(a, b) {
    return (Number(a.slNo) || 0) - (Number(b.slNo) || 0);
  }
  function renderTable(records, showActions) {
    const actions = showActions !== false;
    if (!records.length) {
      if (state.loadingRecords) {
        return '<div class="empty-state" role="status"><strong>Loading shipments…</strong><p>Fetching the latest verified ledger.</p></div>';
      }
      if (state.loadError) {
        return '<div class="empty-state" role="alert"><strong>Ledger data could not be loaded</strong><p>' +
          escapeHtml(state.loadError) + '</p><button class="btn btn-secondary" type="button" data-action="refresh">Retry loading</button></div>';
      }
      return '<div class="empty-state"><strong>No shipments yet</strong><p>Add a shipment or import an Excel workbook to begin.</p></div>';
    }
    const heads = FIELD_ORDER.map(function (field) { return headerCell(field, actions); }).join('') + (actions ? '<th>Actions</th>' : '');
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
      '</select></div></div><div class="view-actions"><button class="btn btn-secondary" type="button" data-action="clear-filters"' +
      (filterValues.status === 'ALL' && !filterValues.search.trim() ? ' disabled' : '') + '>Clear filters</button><button class="btn btn-secondary" type="button" data-action="refresh">Refresh</button><button class="btn btn-secondary" type="button" data-action="export">Export Excel</button></div></div>' +
      '<div class="table-meta"><span>' + state.filtered.length + ' shipment' + (state.filtered.length === 1 ? '' : 's') + ' in view</span>' +
      '<span>FRIGHT in view: <strong>' + formatMoneyPaise(filteredSummary.freightPaise) + '</strong> · Pending in view: <strong>' + formatMoneyPaise(filteredSummary.pendingAmountPaise) + '</strong></span></div>' +
      renderTable(state.filtered, true) + '</section>';
  }
  function getFilteredSheetRecords() {
    let records = state.records.slice().sort(sortBySlNo).map(withDerivedValues);
    if (!state.sheetFilter) return records;
    const filter = state.sheetFilter;
    if (filter.type === 'status') {
      return records.filter(function (r) {
        return r.toPayStatus === filter.value;
      });
    }
    if (filter.type === 'transporter') {
      const target = String(filter.value || '').trim().toLowerCase();
      return records.filter(function (r) {
        return String(r.transportName || '').trim().toLowerCase() === target;
      });
    }
    if (filter.type === 'category') {
      if (filter.value === 'pending') {
        return records.filter(function (r) {
          const parsed = CALC.parseMoney(r.pendingAmount, { allowEmpty: true });
          return parsed.ok && !parsed.empty && parsed.paise > 0;
        });
      }
      if (filter.value === 'overdue') {
        return records.filter(function (r) {
          return isShipmentOverdue(r);
        });
      }
      if (filter.value === 'pod_missing') {
        return records.filter(function (r) {
          return isShipmentPodMissing(r);
        });
      }
      if (filter.value === 'open_issues') {
        return records.filter(function (r) {
          return isShipmentOpenIssue(r);
        });
      }
    }
    return records;
  }

  function renderSheet() {
    const fullRecords = getFilteredSheetRecords();
    const summary = numericTotals(fullRecords);
    const totalAllCount = state.records.length;
    const filterBanner = state.sheetFilter ?
      ('<div class="sheet-filter-banner" role="status">' +
        '<div class="sheet-filter-info">' +
          '<span class="sheet-filter-badge">🔍 FILTERED VIEW</span>' +
          '<span class="sheet-filter-label">Filtered by: <strong>' + escapeHtml(state.sheetFilter.label) + '</strong></span>' +
          '<span class="sheet-filter-count">(' + fullRecords.length + ' of ' + totalAllCount + ' shipments)</span>' +
        '</div>' +
        '<button class="btn btn-secondary btn-sm sheet-clear-filter-btn" type="button" data-action="clear-sheet-filter">✕ Show all records</button>' +
      '</div>') : '';
    const rows = fullRecords.length ? fullRecords.map(function (record) {
      return '<tr data-id="' + escapeHtml(record.id) + '">' + FIELD_ORDER.map(function (field) {
        return recordCell(record, field).replace('<td', '<td');
      }).join('') + '</tr>';
    }).join('') : '<tr><td class="empty-state" colspan="' + FIELD_ORDER.length + '">' +
      (state.loadingRecords ? 'Loading the latest shipment data…' :
        (state.loadError ? escapeHtml(state.loadError) : (state.sheetFilter ? 'No shipments matching active filter: ' + escapeHtml(state.sheetFilter.label) : 'No shipments in the ledger.'))) + '</td></tr>';
    const totalsCells = FIELD_ORDER.map(function (field, idx) {
      if (idx === 0) return '<td class="total-label">TOTAL (' + fullRecords.length + ' records)</td>';
      if (field === 'freight') return '<td class="numeric">' + formatMoneyPaise(summary.freightPaise) + '</td>';
      if (field === 'tM') return '<td class="numeric">' + formatMoneyPaise(summary.tMPaise) + '</td>';
      if (field === 'advance') return '<td class="numeric">' + formatMoneyPaise(summary.advancePaise - summary.advance2Paise - summary.advance3Paise) + '</td>';
      if (field === 'advance2') return '<td class="numeric">' + formatMoneyPaise(summary.advance2Paise) + '</td>';
      if (field === 'advance3') return '<td class="numeric">' + formatMoneyPaise(summary.advance3Paise) + '</td>';
      if (field === 'codToPay') return '<td class="numeric">' + formatMoneyPaise(summary.codToPayPaise) + '</td>';
      if (field === 'pendingTobilled') return '<td class="numeric">' + formatMoneyPaise(summary.pendingTobilledPaise) + '</td>';
      if (field === 'extraAmount') return '<td class="numeric">' + formatMoneyPaise(summary.extraAmountPaise) + '</td>';
      if (field === 'pM') return '<td class="numeric">' + formatMoneyPaise(summary.pMPaise) + '</td>';
      if (field === 'pendingAmount') return '<td class="numeric">' + formatMoneyPaise(summary.pendingAmountPaise) + '</td>';
      return '<td></td>';
    }).join('');
    const totals = '<tr>' + totalsCells + '</tr>';
    return '<section class="panel"><div class="toolbar"><div class="sheet-toolbar-heading"><h2>📑 Live Excel Spreadsheet View</h2>' +
      '<p class="toolbar-help">Complete shipment records, formulas, and closing calculations directly from the Broker Ledger.</p></div>' +
      '<div class="view-actions"><button class="btn btn-secondary" type="button" data-action="refresh">↻ Refresh</button><div class="zoom-controls"><label for="sheet-zoom">Zoom</label><select id="sheet-zoom"><option value="0.8">80%</option><option value="0.9">90%</option><option value="1" selected>100%</option><option value="1.15">115%</option></select></div>' +
      '<button class="btn btn-secondary" type="button" data-action="fullscreen">⛶ Full Screen</button><button class="btn btn-secondary" type="button" data-action="print">🖨 Print</button><button class="btn btn-primary" type="button" data-action="export">Download Excel (.xlsx)</button></div></div>' +
      filterBanner +
      '<div class="table-meta"><span>' + fullRecords.length + ' rows ' + (state.sheetFilter ? '(filtered view)' : '(full ledger)') + '</span><span>Calculated columns are highlighted.</span></div>' +
      '<div id="sheet-wrap" class="sheet-wrap" tabindex="0" aria-label="Spreadsheet-style shipment ledger"><table class="sheet-table"><thead><tr>' +
      FIELD_ORDER.map(function (field) { return headerCell(field, true); }).join('') + '</tr></thead><tbody>' + rows + '</tbody><tfoot>' + totals + '</tfoot></table></div>' +
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
    }).sort(compareRecords);
  }
  function sortableValue(record, field) {
    const value = record[field];
    if (DATE_FIELDS.has(field)) {
      const text = String(value || '');
      const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      return dmy ? dmy[3] + '-' + dmy[2] + '-' + dmy[1] : text;
    }
    if (MONEY_FIELDS.has(field) || field === 'codToPay') {
      const parsed = CALC.parseMoney(value, { allowEmpty: true });
      if (parsed.ok && !parsed.empty) return parsed.paise;
    }
    return String(value === null || value === undefined ? '' : value);
  }
  function compareRecords(a, b) {
    const left = sortableValue(a, state.sortField);
    const right = sortableValue(b, state.sortField);
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
    return state.sortDirection * (comparison || sortBySlNo(a, b));
  }
  function render() {
    applyFilters();
    byId('add-shipment-top').hidden = state.preview || state.loadingRecords || Boolean(state.loadError);
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
    result.toPayStatus = CALC.normalizeStatus(result.toPayStatus);
    const calculation = CALC.calculateShipment(result);
    result.codToPay = calculation.codToPay;
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
    state.loadingRecords = false;
    state.loadError = '';
    setCloudStatus(true, 'Cloud connected');
    byId('footer-sync').textContent = 'Last synced ' + new Date().toLocaleTimeString();
    updateAutocompleteSuggestions();
    render();
  }
  async function checkForUpdates() {
    if (!state.user || state.busy || state.syncChecking) return;
    state.syncChecking = true;
    try {
      const result = await window.BrokerApi.version();
      const version = Number(result.version);
      if (!Number.isFinite(version)) throw new Error('Backend response did not contain a valid data version.');
      if (version > state.version) {
        await refreshRecords();
      } else {
        setCloudStatus(true, 'Cloud connected');
        byId('footer-sync').textContent = 'Last checked ' + new Date().toLocaleTimeString();
      }
    } finally {
      state.syncChecking = false;
    }
  }
  async function initializeSession() {
    const existing = getCurrentSession();
    if (!existing || !existing.token) {
      showAuth();
      return;
    }
    state.user = existing;
    state.loadingRecords = true;
    state.loadError = '';
    showApp(existing);
    setCloudStatus(false, 'Loading ledger…');
    byId('footer-sync').textContent = 'Loading latest ledger…';
    try {
      await refreshRecords();
    } catch (error) {
      if (state.user) {
        state.loadingRecords = false;
        state.loadError = 'The latest ledger could not be loaded. Check your connection and retry.';
        setCloudStatus(false, 'Ledger unavailable');
        byId('footer-sync').textContent = 'Ledger load failed: ' + error.message;
        render();
        toast('You are signed in, but the latest ledger could not be loaded: ' + error.message, 'error');
        return;
      }
      showAuth('Your session could not be verified: ' + error.message);
    }
  }
  function updateAutocompleteSuggestions() {
    const records = state.records || [];
    function getUnique(key, toUpper) {
      const set = new Set();
      records.forEach(function (r) {
        if (!r) return;
        const val = String(r[key] || '').trim();
        if (val) set.add(toUpper ? val.toUpperCase() : val);
      });
      return Array.from(set).sort();
    }

    const hubSuggestions = ['MEDCHAL', 'WARANGAL', 'HYDERABAD', 'RAIPUR', 'LUCKNOW', 'PANKANJUR', 'MADHAPURA', 'NAGPUR', 'MUMBAI'];
    const fromCities = Array.from(new Set(getUnique('from', true).concat(hubSuggestions))).sort();
    const toCities = Array.from(new Set(getUnique('to', true).concat(hubSuggestions))).sort();

    function populateDatalist(id, list) {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = list.map(function (item) {
        return '<option value="' + escapeHtml(item) + '">';
      }).join('');
    }

    populateDatalist('transport-suggestions', getUnique('transportName', false));
    populateDatalist('truck-suggestions', getUnique('truckNo', true));
    populateDatalist('from-suggestions', fromCities);
    populateDatalist('to-suggestions', toCities);
    populateDatalist('bank-suggestions', getUnique('bank', false));
    populateDatalist('account-suggestions', getUnique('accountNo', false));
    populateDatalist('ifsc-suggestions', getUnique('ifscCode', true));
  }

  function handleTransporterAutofill(transporterName) {
    if (!transporterName || state.formMode === 'view') return;
    const clean = String(transporterName).trim().toLowerCase();
    if (!clean) return;
    const form = byId('shipment-form');
    if (!form) return;

    const records = (state.records || []).slice().reverse();
    const match = records.find(function (r) {
      return String(r.transportName || '').trim().toLowerCase() === clean;
    });

    if (match) {
      // PRESERVATION: Only autofill empty bank fields; never overwrite existing values or clear them
      if (form.elements.accountNo && !form.elements.accountNo.value.trim() && match.accountNo) {
        form.elements.accountNo.value = match.accountNo;
      }
      if (form.elements.ifscCode && !form.elements.ifscCode.value.trim() && match.ifscCode) {
        form.elements.ifscCode.value = match.ifscCode;
      }
      if (form.elements.bank && !form.elements.bank.value.trim() && match.bank) {
        form.elements.bank.value = match.bank;
      }
    }
  }

  function handleTruckAutofill(truckNo) {
    if (!truckNo || state.formMode === 'view') return;
    const clean = String(truckNo).trim().toUpperCase();
    if (!clean) return;
    const form = byId('shipment-form');
    if (!form) return;

    const records = (state.records || []).slice().reverse();
    const match = records.find(function (r) {
      return String(r.truckNo || '').trim().toUpperCase() === clean;
    });

    if (match) {
      if (form.elements.transportName && !form.elements.transportName.value.trim() && match.transportName) {
        form.elements.transportName.value = match.transportName;
        handleTransporterAutofill(match.transportName);
      }
    }
  }

  function formRecord() {
    const form = byId('shipment-form');
    if (!form) return {};
    const record = {};
    FIELD_ORDER.forEach(function (field) {
      if (field === 'slNo' || field === 'pendingTobilled' || field === 'pendingAmount') return;
      const el = form.elements[field];
      const value = el ? el.value : '';
      record[field] = value === null || value === undefined ? '' : String(value).trim();
    });
    record.toPayStatus = CALC.normalizeStatus(record.toPayStatus);
    const calculated = CALC.calculateShipment(record);
    record.codToPay = calculated.codToPay;
    record.pendingTobilled = calculated.pendingTobilled;
    record.pendingAmount = calculated.pendingAmount;
    if (form.elements.podAmountStatus && !form.elements.podAmountStatus.value.trim()) {
      record.podAmountStatus = String(calculated.podAmountStatus !== undefined ? calculated.podAmountStatus : '0');
    }
    return record;
  }

  function updateFormCalculations() {
    if (!byId('shipment-form')) return;
    const form = byId('shipment-form');
    const codInput = form.elements.codToPay;
    const status = CALC.normalizeStatus(form.elements.toPayStatus.value);
    if (status === 'TOBILLED') {
      if (codInput.readOnly) codInput.value = state.codToPayNote;
      codInput.readOnly = false;
      codInput.classList.remove('calculated-field');
      if (document.activeElement === codInput) {
        state.codToPayNote = codInput.value;
      }
    } else {
      codInput.readOnly = true;
      codInput.classList.add('calculated-field');
    }
    const record = formRecord();
    const computed = CALC.calculateShipment(record);
    if (status !== 'TOBILLED') {
      codInput.value = computed.codToPay === null
        ? ''
        : CALC.fromPaise(Math.round(computed.codToPay * 100)).toLocaleString('en-IN');
    } else if (document.activeElement !== codInput && !codInput.value) {
      codInput.value = state.codToPayNote;
    }
    byId('shipment-form').elements.pendingTobilled.value =
      computed.pendingTobilled === null ? '' : CALC.fromPaise(Math.round(computed.pendingTobilled * 100)).toLocaleString('en-IN');
    byId('shipment-form').elements.pendingAmount.value =
      computed.pendingAmount === null ? '' : CALC.fromPaise(Math.round(computed.pendingAmount * 100)).toLocaleString('en-IN');
  }

  function setFormValues(record) {
    const form = byId('shipment-form');
    form.reset();
    const recordStatus = record ? CALC.normalizeStatus(record.toPayStatus) : 'TOBILLED';
    state.codToPayNote = recordStatus === 'TOBILLED'
      ? String(record && record.codToPay !== null && record.codToPay !== undefined ? record.codToPay : '')
      : 'if Tobilled NA';
    if (!record) state.codToPayNote = 'if Tobilled NA';
    FIELD_ORDER.forEach(function (field) {
      if (field === 'slNo') return;
      const input = form.elements[field];
      if (!input) return;
      let value = record && record[field] !== null && record[field] !== undefined ? record[field] : '';
      if (field === 'toPayStatus') value = CALC.normalizeStatus(value);
      if (DATE_FIELDS.has(field)) value = toDateInput(value);
      if (field === 'pendingTobilled' || field === 'pendingAmount') {
        value = value === '' || value === null ? '' : displayMoney(value).replace(/^₹/, '');
      }
      input.value = value;
    });

    if (!record) {
      if (form.elements.date && !form.elements.date.value) {
        form.elements.date.value = new Date().toISOString().split('T')[0];
      }
      if (form.elements.toPayStatus && !form.elements.toPayStatus.value) {
        form.elements.toPayStatus.value = 'TOBILLED';
      }
      if (form.elements.podAmountStatus && !form.elements.podAmountStatus.value) {
        form.elements.podAmountStatus.value = '0';
      }
    }
    updateFormCalculations();
  }

  function openShipmentDialog(mode, id) {
    const isView = mode === 'view';
    const existing = id ? state.records.find(function (record) { return record.id === id; }) : null;
    if (id && !existing) {
      toast('This shipment is no longer available. Refresh the ledger and try again.', 'error');
      return;
    }
    state.editingId = id || null;
    state.editingUpdatedAt = existing && existing.updatedAt ? String(existing.updatedAt) : '';
    state.formMode = isView ? 'view' : (id ? 'edit' : 'add');
    const form = byId('shipment-form');
    updateAutocompleteSuggestions();
    setFormValues(existing);

    Array.from(form.elements).forEach(function (element) {
      if (element.name) {
        element.disabled = isView;
        if (!isView && (element.name === 'pendingTobilled' || element.name === 'pendingAmount')) {
          element.readOnly = true;
        }
      }
    });

    const saveBtn = byId('save-shipment');
    const clearAllBtn = byId('clear-all-dialog');
    const fillPendingBtn = byId('btn-fill-pending');
    const clearPaymentBtn = byId('clear-payment-details');
    if (saveBtn) {
      saveBtn.hidden = isView;
      saveBtn.disabled = false;
      saveBtn.textContent = existing ? 'Update Shipment' : 'Add & Submit Shipment';
    }
    if (clearAllBtn) clearAllBtn.hidden = isView;
    if (fillPendingBtn) fillPendingBtn.hidden = isView;
    if (clearPaymentBtn) clearPaymentBtn.hidden = isView;
    byId('cancel-dialog').textContent = isView ? 'Close' : 'Cancel';
    byId('shipment-dialog-title').textContent = isView ? 'Shipment Details' : (existing ? 'Edit Shipment' : 'Add Shipment');
    byId('form-error').hidden = true;
    byId('shipment-dialog').showModal();
  }

  function closeShipmentDialog() {
    if (byId('shipment-dialog').open) byId('shipment-dialog').close();
    state.editingId = null;
    state.editingUpdatedAt = '';
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

    // Client-side duplicate check (LR No + Date + Truck No)
    const recordIdentity = [record.lrNo, record.date, record.truckNo].map(function (v) {
      return String(v || '').trim().toLowerCase();
    }).join('|');
    const isDuplicate = state.records.some(function (item) {
      if (state.editingId && item.id === state.editingId) return false;
      const itemIdentity = [item.lrNo, item.date, item.truckNo].map(function (v) {
        return String(v || '').trim().toLowerCase();
      }).join('|');
      return itemIdentity === recordIdentity;
    });
    if (isDuplicate) {
      errorBox.textContent = 'A shipment with this LR No, date, and truck already exists.';
      errorBox.hidden = false;
      return;
    }

    const saveBtn = byId('save-shipment');
    const isEditing = Boolean(state.editingId);
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }
    setBusy(true);
    let response;
    try {
      if (state.editingId) response = await window.BrokerApi.update(state.editingId, record, state.editingUpdatedAt);
      else response = await window.BrokerApi.create(record);
    } catch (error) {
      errorBox.textContent = error.message;
      if (error.code === 'RECORD_CONFLICT') {
        try { await refreshRecords(); }
        catch (refreshError) {
          setCloudStatus(false, 'Offline — last data may be stale');
          byId('footer-sync').textContent = 'Conflict detected; refresh failed: ' + refreshError.message;
        }
      }
      errorBox.hidden = false;
      setBusy(false);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = isEditing ? 'Update Shipment' : 'Add & Submit Shipment';
      }
      return;
    }
    closeShipmentDialog();
    if (response && response.record) {
      const saved = withDerivedValues(response.record);
      if (isEditing) {
        const idx = state.records.findIndex(function (item) { return item.id === saved.id; });
        if (idx >= 0) state.records[idx] = saved;
      } else {
        state.records.push(saved);
      }
      render();
      updateAutocompleteSuggestions();
    }
    toast((isEditing ? 'Shipment updated.' : 'Shipment saved.') + (response.warning ? ' ' + response.warning : ''), response.warning ? 'error' : 'success');
    refreshRecords().catch(function (error) {
      setCloudStatus(false, 'Offline — last data may be stale');
      byId('footer-sync').textContent = 'Save completed, but refresh failed; displayed data may be outdated.';
      toast('Shipment saved, but background sync refresh encountered an issue: ' + error.message, 'error');
    });
    setBusy(false);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = isEditing ? 'Update Shipment' : 'Add & Submit Shipment';
    }
  }
  async function deleteShipment(id) {
    if (!state.user || state.user.role !== 'Admin') {
      toast('Only an administrator can delete a shipment.', 'error');
      return;
    }
    const record = state.records.find(function (item) { return item.id === id; });
    if (!record || !window.confirm('Delete shipment LR No ' + record.lrNo + '? This cannot be undone.')) return;
    const prevRecords = state.records.slice();
    state.records = state.records.filter(function (item) { return item.id !== id; });
    render();
    let response;
    try {
      response = await window.BrokerApi.remove(id);
      toast('Shipment deleted.' + (response.warning ? ' ' + response.warning : ''), response.warning ? 'error' : 'success');
      refreshRecords().catch(function (error) {
        setCloudStatus(false, 'Offline — last data may be stale');
        toast('Shipment deleted, but background sync refresh encountered an issue: ' + error.message, 'error');
      });
    } catch (error) {
      state.records = prevRecords;
      render();
      toast(error.message, 'error');
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
  async function exportWorkbook(btn) {
    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.textContent = '⏳ Generating Excel…';
      btn.disabled = true;
    }
    try {
      const data = state.records.slice().sort(sortBySlNo).map(withDerivedValues);
      const summary = CALC.summarize(data);
      const filename = 'Broker_Ledger_' + new Date().toISOString().slice(0, 10) + '.xlsx';

      if (window.ExcelJS) {
      try {
        const workbook = new window.ExcelJS.Workbook();
        workbook.creator = "SR Brokerage Ledger";
        workbook.created = new Date();

        const ws = workbook.addWorksheet('Broker Ledger', {
          views: [{ state: 'frozen', ySplit: 1, showGridLines: true }]
        });

        ws.columns = FIELD_ORDER.map(function (field) {
          const label = LABELS[field] || field;
          let width = Math.max(12, Math.min(32, label.length + 4));
          if (field === 'slNo') width = 8;
          else if (field === 'transportName') width = 24;
          else if (field === 'truckNo') width = 16;
          else if (field === 'remarks') width = 30;
          else if (MONEY_FIELDS.has(field) || field === 'codToPay') width = 16;
          else if (DATE_FIELDS.has(field)) width = 14;
          return { header: label, key: field, width: width };
        });

        const navyHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        const statusHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        const calcHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
        const codHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };

        const thinBorder = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };

        const headerRow = ws.getRow(1);
        headerRow.height = 28;
        headerRow.eachCell(function (cell, colNumber) {
          const field = FIELD_ORDER[colNumber - 1];
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = thinBorder;

          if (field === 'toPayStatus') cell.fill = statusHeaderFill;
          else if (field === 'pendingTobilled' || field === 'pendingAmount') cell.fill = calcHeaderFill;
          else if (field === 'codToPay' || field === 'podReceivedDate') cell.fill = codHeaderFill;
          else cell.fill = navyHeaderFill;
        });

        data.forEach(function (record, rowIndex) {
          const rowData = {};
          FIELD_ORDER.forEach(function (field) {
            if (DATE_FIELDS.has(field)) {
              rowData[field] = dateForExport(record[field]);
            } else if (field === 'codToPay') {
              const parsed = CALC.parseMoney(record[field], { allowEmpty: true });
              rowData[field] = parsed.ok && !parsed.empty ? CALC.fromPaise(parsed.paise) : (record[field] || '');
            } else if (MONEY_FIELDS.has(field)) {
              const parsed = CALC.parseMoney(record[field], { allowEmpty: true });
              rowData[field] = parsed.ok && !parsed.empty ? CALC.fromPaise(parsed.paise) : (record[field] === 0 ? 0 : '');
            } else {
              rowData[field] = record[field] === null || record[field] === undefined ? '' : record[field];
            }
          });

          const row = ws.addRow(rowData);
          row.height = 21;
          const isEven = rowIndex % 2 === 1;

          row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
            const field = FIELD_ORDER[colNumber - 1];
            cell.border = thinBorder;
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
            cell.alignment = { vertical: 'middle' };

            if (isEven) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }

            if (field === 'slNo' || DATE_FIELDS.has(field) || field === 'lrNo' || field === 'truckNo' || field === 'podAmountStatus') {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (MONEY_FIELDS.has(field) || (field === 'codToPay' && typeof cell.value === 'number')) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '#,##0.00';
            }

            if (field === 'pendingTobilled' || field === 'pendingAmount') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
              cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
            }

            if (field === 'toPayStatus' && cell.value) {
              const st = String(cell.value).toUpperCase();
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              if (st.includes('A/TO-PAY')) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
              } else if (st.includes('F/TO-PAY')) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
              } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
              }
            }
          });
        });

        const totalsData = {};
        FIELD_ORDER.forEach(function (f) { totalsData[f] = ''; });
        totalsData.slNo = 'TOTAL (' + data.length + ' shipments)';
        totalsData.freight = CALC.fromPaise(summary.freightPaise);
        totalsData.tM = CALC.fromPaise(summary.tMPaise);
        totalsData.advance = CALC.fromPaise(summary.advancePaise - summary.advance2Paise - summary.advance3Paise);
        totalsData.advance2 = CALC.fromPaise(summary.advance2Paise);
        totalsData.advance3 = CALC.fromPaise(summary.advance3Paise);
        totalsData.codToPay = CALC.fromPaise(summary.codToPayPaise);
        totalsData.pendingTobilled = CALC.fromPaise(summary.pendingTobilledPaise);
        totalsData.extraAmount = CALC.fromPaise(summary.extraAmountPaise);
        totalsData.pM = CALC.fromPaise(summary.pMPaise);
        totalsData.pendingAmount = CALC.fromPaise(summary.pendingAmountPaise);

        const totRow = ws.addRow(totalsData);
        totRow.height = 25;
        const totalYellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        const totalBorder = {
          top: { style: 'medium', color: { argb: 'FFCA8A04' } },
          bottom: { style: 'double', color: { argb: 'FFCA8A04' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };

        totRow.eachCell({ includeEmpty: true }, function (cell, colNumber) {
          const field = FIELD_ORDER[colNumber - 1];
          cell.fill = totalYellowFill;
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
          cell.border = totalBorder;
          if (MONEY_FIELDS.has(field) || field === 'codToPay') {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0.00';
          } else {
            cell.alignment = { vertical: 'middle' };
          }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        if (typeof window.saveAs === 'function') {
          window.saveAs(blob, filename);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
        }
        toast('Excel workbook downloaded with application styles.', 'success');
        return;
      } catch (excelErr) {
        console.warn('ExcelJS styled export error, falling back to SheetJS:', excelErr);
      }
    }

    if (!window.XLSX) {
      toast('The local Excel library did not load. Reload the page and try again.', 'error');
      return;
    }
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
    const totals = FIELD_ORDER.map(function (field, idx) {
      if (idx === 0) return 'TOTAL (' + data.length + ' shipments)';
      if (field === 'freight') return CALC.fromPaise(summary.freightPaise);
      if (field === 'tM') return CALC.fromPaise(summary.tMPaise);
      if (field === 'advance') return CALC.fromPaise(summary.advancePaise - summary.advance2Paise - summary.advance3Paise);
      if (field === 'advance2') return CALC.fromPaise(summary.advance2Paise);
      if (field === 'advance3') return CALC.fromPaise(summary.advance3Paise);
      if (field === 'codToPay') return CALC.fromPaise(summary.codToPayPaise);
      if (field === 'pendingTobilled') return CALC.fromPaise(summary.pendingTobilledPaise);
      if (field === 'extraAmount') return CALC.fromPaise(summary.extraAmountPaise);
      if (field === 'pM') return CALC.fromPaise(summary.pMPaise);
      if (field === 'pendingAmount') return CALC.fromPaise(summary.pendingAmountPaise);
      return '';
    });
    const worksheet = window.XLSX.utils.aoa_to_sheet([FIELD_ORDER.map(function (field) { return LABELS[field]; })].concat(rows, [totals]));
    worksheet['!cols'] = FIELD_ORDER.map(function (field) { return { wch: Math.max(12, Math.min(30, LABELS[field].length + 3)) }; });
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Broker Ledger');
    window.XLSX.writeFile(workbook, filename);
    } finally {
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
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
    date1: ['1stadvdate', '1stadvancegivendate', 'advancedate', 'date1'],
    advance2: ['advance2'], date2: ['2ndadvdate', '2ndadvancegivendate', 'advance2date', 'date2'],
    advance3: ['advance3'], date3: ['3rdadvdate', '3rdadvancegivendate', 'advance3date', 'date3'],
    unloadingDate: ['unloadingdate', 'unloaddate'],
    podReceivedDate: ['podrecddate', 'podreceiveddate'],
    balanceDate: ['balancedate', 'baldate'],
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
    record.toPayStatus = CALC.normalizeStatus(record.toPayStatus);
    const validation = VALIDATION.validateShipment(record);
    if (!validation.valid) throw new Error(errorList(validation.errors));
    record.codToPay = validation.calculated.codToPay;
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
    setAuthMessage('Backend setup required. Deploy Broker-Ledger/backend/Code.gs, then add its Web App URL to Broker-Ledger/js/config.js. See the repository README.', true);
    return;
    }
    const username = byId('login-username').value.trim();
    const password = byId('login-password').value;
    setBusy(true);
    byId('login-button').textContent = 'Signing in…';
    try {
      const user = await window.BrokerApi.login(username, password);
      sessionStorage.setItem('broker-ledger-session', JSON.stringify(user));
      byId('login-password').value = '';
      state.user = user;
      state.loadingRecords = true;
      state.loadError = '';
      showApp(user);
      setBusy(false);
      byId('login-button').textContent = '🚀 Secure Login';
      setCloudStatus(false, 'Loading ledger…');
      byId('footer-sync').textContent = 'Loading latest ledger…';
      refreshRecords().catch(function (loadError) {
        if (!state.user) return;
        state.loadingRecords = false;
        state.loadError = 'The latest ledger could not be loaded. Check your connection and retry.';
        setCloudStatus(false, 'Ledger unavailable');
        byId('footer-sync').textContent = 'Ledger load failed: ' + loadError.message;
        render();
        toast('You are signed in, but the latest ledger could not be loaded: ' + loadError.message, 'error');
      });
    } catch (error) {
      sessionStorage.removeItem('broker-ledger-session');
      state.user = null;
      state.loadingRecords = false;
      state.loadError = '';
      showAuth(error.message);
      setBusy(false);
      byId('login-button').textContent = '🚀 Secure Login';
    }
  }
  async function logout() {
    try { await window.BrokerApi.logout(); }
    catch (error) { toast('Cloud logout could not be confirmed. The local session was cleared.', 'error'); }
    sessionStorage.removeItem('broker-ledger-session');
    state.user = null;
    state.records = [];
    state.loadingRecords = false;
    state.loadError = '';
    showAuth();
  }
  function toggleSidebar(open) {
    byId('sidebar').classList.toggle('open', open);
    byId('sidebar-scrim').classList.toggle('visible', open);
    document.body.classList.toggle('sidebar-open', open);
  }
  function selectLoginUser(username) {
    const selected = String(username || 'Admin').trim();
    const isRudra = selected.toLowerCase() === 'rudra';
    const input = byId('login-username');
    if (input) input.value = isRudra ? 'Rudra' : 'Admin';
    const btnAdmin = byId('user-btn-admin');
    const btnRudra = byId('user-btn-rudra');
    if (btnAdmin) btnAdmin.classList.toggle('active', !isRudra);
    if (btnRudra) btnRudra.classList.toggle('active', isRudra);
    const pwdInput = byId('login-password');
    if (pwdInput) {
      pwdInput.placeholder = isRudra ? 'Enter password for Rudra' : 'Enter password for Admin';
    }
  }
  function togglePasswordVisibility(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const input = byId('login-password');
    const button = byId('toggle-password');
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (button) {
      button.textContent = isPassword ? '🙈' : '👁️';
      button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', String(isPassword));
    }
  }
  function clearPaymentDetails() {
    const form = byId('shipment-form');
    if (!form) return;
    const paymentFields = [
      'freight', 'tM', 'unloadingDate', 'codToPay', 'extraAmount',
      'pmPaDate', 'pM', 'advance', 'date1', 'advance2', 'date2', 'advance3', 'date3'
    ];
    paymentFields.forEach(function (name) {
      if (form.elements[name]) {
        form.elements[name].value = '';
      }
    });
    if (form.elements.toPayStatus) {
      form.elements.toPayStatus.value = 'TOBILLED';
    }
    updateFormCalculations();
    toast('Payment details have been reset.', 'info');
  }

  function bindEvents() {
    byId('login-form').addEventListener('submit', handleLogin);
    byId('toggle-password').addEventListener('click', togglePasswordVisibility);
    const userBtnAdmin = byId('user-btn-admin');
    if (userBtnAdmin) {
      userBtnAdmin.addEventListener('click', function () { selectLoginUser('Admin'); });
      userBtnAdmin.addEventListener('pointerdown', function () { selectLoginUser('Admin'); });
    }
    const userBtnRudra = byId('user-btn-rudra');
    if (userBtnRudra) {
      userBtnRudra.addEventListener('click', function () { selectLoginUser('Rudra'); });
      userBtnRudra.addEventListener('pointerdown', function () { selectLoginUser('Rudra'); });
    }
    byId('logout-button').addEventListener('click', logout);
    byId('manual-sync-button').addEventListener('click', function () {
      const btn = this;
      btn.textContent = '↻ Syncing…';
      refreshRecords().catch(function (error) {
        setCloudStatus(false, 'Offline — last data may be stale');
        byId('footer-sync').textContent = 'Sync failed: ' + error.message;
        toast(error.message, 'error');
      }).finally(function () {
        btn.textContent = '↻ Sync';
      });
    });
    byId('add-shipment-top').addEventListener('click', function () { openShipmentDialog('add'); });
    byId('close-dialog').addEventListener('click', closeShipmentDialog);
    byId('cancel-dialog').addEventListener('click', closeShipmentDialog);
    byId('shipment-dialog').addEventListener('click', function (event) {
    if (event.target === byId('shipment-dialog')) closeShipmentDialog();
    });
    byId('shipment-form').addEventListener('input', updateFormCalculations);
    byId('shipment-form').addEventListener('change', updateFormCalculations);
    byId('shipment-form').addEventListener('submit', saveShipment);
    const clearPaymentBtn = byId('clear-payment-details');
    if (clearPaymentBtn) {
      clearPaymentBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (state.formMode === 'view') return;
        const isEditing = state.formMode === 'edit';
        const msg = isEditing
          ? 'Reset payment details for this shipment? Any unsaved changes to payment fields will be cleared.'
          : 'Are you sure you want to clear payment details?';
        const confirmed = window.confirm(msg);
        if (!confirmed) return;
        clearPaymentDetails();
      });
    }

    const clearAllBtn = byId('clear-all-dialog');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (state.formMode === 'view') return;
        const confirmed = window.confirm('Are you sure you want to clear all currently entered form fields? This will reset the form inputs without deleting any saved records.');
        if (!confirmed) return;
        setFormValues(null);
        toast('Form fields have been reset.', 'info');
      });
    }

    const fillPendingBtn = byId('btn-fill-pending');
    if (fillPendingBtn) {
      fillPendingBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (state.formMode === 'view') return;
        const form = byId('shipment-form');
        if (!form) return;
        const record = formRecord();
        const computed = CALC.calculateShipment(record);
        if (computed.pendingAmount === null || computed.pendingAmount === undefined || isNaN(computed.pendingAmount)) {
          toast('Pending Amount is not available. Please verify Freight and status.', 'error');
          return;
        }
        const pendingPaise = Math.round(computed.pendingAmount * 100);
        const formattedRupees = CALC.fromPaise(pendingPaise).toLocaleString('en-IN');
        const target = form.elements.podAmountStatus;
        if (target) {
          const currentVal = target.value ? target.value.trim() : '';
          if (currentVal && currentVal !== '0' && currentVal !== String(computed.pendingAmount) && currentVal !== formattedRupees) {
            const ok = window.confirm('POD Balance Amount currently contains "' + currentVal + '". Do you want to overwrite it with calculated Pending Amount ₹' + formattedRupees + '?');
            if (!ok) return;
          }
          target.value = String(computed.pendingAmount);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateFormCalculations();
        toast('Calculated Pending Amount (₹' + formattedRupees + ') copied to POD Balance Amount.', 'success');
      });
    }

    const sForm = byId('shipment-form');
    if (sForm) {
      if (sForm.elements.transportName) {
        sForm.elements.transportName.addEventListener('input', function () {
          handleTransporterAutofill(this.value);
        });
        sForm.elements.transportName.addEventListener('change', function () {
          handleTransporterAutofill(this.value);
        });
      }
      if (sForm.elements.truckNo) {
        sForm.elements.truckNo.addEventListener('input', function () {
          this.value = this.value.toUpperCase();
          handleTruckAutofill(this.value);
        });
        sForm.elements.truckNo.addEventListener('change', function () {
          handleTruckAutofill(this.value);
        });
      }
      if (sForm.elements.ifscCode) {
        sForm.elements.ifscCode.addEventListener('input', function () {
          this.value = this.value.toUpperCase();
        });
      }
      if (sForm.elements.from) {
        sForm.elements.from.addEventListener('input', function () {
          this.value = this.value.toUpperCase();
        });
      }
      if (sForm.elements.to) {
        sForm.elements.to.addEventListener('input', function () {
          this.value = this.value.toUpperCase();
        });
      }
    }
    byId('sidebar-open').addEventListener('click', function () { toggleSidebar(true); });
    byId('sidebar-close').addEventListener('click', function () { toggleSidebar(false); });
    byId('sidebar-scrim').addEventListener('click', function () { toggleSidebar(false); });
    document.querySelectorAll('.nav-tab').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('.nav-tab').forEach(function (btn) {
          btn.classList.toggle('active', btn === button);
        });
        if (button.dataset.view === 'sheet') {
          state.sheetFilter = null;
        }
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
    if (action === 'sheet-filter') {
      const filterType = button.dataset.filterType;
      const filterValue = button.dataset.filterValue;
      const filterLabel = button.dataset.filterLabel || filterValue;
      if (filterType && filterValue) {
        state.sheetFilter = {
          type: filterType,
          value: filterValue,
          label: filterLabel
        };
        state.view = 'sheet';
        render();
      }
      return;
    }
    if (action === 'clear-sheet-filter') {
      state.sheetFilter = null;
      render();
      return;
    }
    if (action === 'add-shipment') openShipmentDialog('add');
    if (action === 'go-sheet') { state.sheetFilter = null; state.view = 'sheet'; render(); }
    if (action === 'go-ledger') { state.view = 'ledger'; render(); }
    if (action === 'sort') {
      const field = button.dataset.field;
      if (FIELD_ORDER.includes(field)) {
        if (state.sortField === field) state.sortDirection *= -1;
        else { state.sortField = field; state.sortDirection = 1; }
        render();
      }
      return;
    }
    if (action === 'clear-filters') {
      state.search = '';
      state.status = 'ALL';
      if (byId('ledger-search')) byId('ledger-search').value = '';
      if (byId('ledger-status')) byId('ledger-status').value = 'ALL';
      render();
      return;
    }
    if (action === 'view') openShipmentDialog('view', button.dataset.id);
    if (action === 'edit') openShipmentDialog('edit', button.dataset.id);
    if (action === 'delete') deleteShipment(button.dataset.id);
    if (action === 'export') exportWorkbook(button);
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
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkForUpdates().catch(function () {
        setCloudStatus(false, 'Offline — last data may be stale');
      });
    });
    window.addEventListener('focus', function () {
      checkForUpdates().catch(function () {
        setCloudStatus(false, 'Offline — last data may be stale');
      });
    });
    window.addEventListener('broker:session-invalid', function () {
    state.user = null;
    state.records = [];
    state.loadingRecords = false;
    state.loadError = '';
    showAuth('Your session expired. Please sign in again.');
    });
  }

  window.BrokerAutocomplete = {
    updateSuggestions: updateAutocompleteSuggestions,
    handleTransporter: handleTransporterAutofill,
    handleTruck: handleTruckAutofill
  };

  bindEvents();
  selectLoginUser('Admin');
  if (!window.BrokerApi.configured() && new URLSearchParams(location.search).get('preview') === '1') {
    state.preview = true;
    showApp({ username: 'Preview', name: 'Read-only preview', role: 'Employee' });
    setCloudStatus(false, 'Preview only');
  } else if (!window.BrokerApi.configured()) {
    setAuthMessage('Backend is not configured. Deploy the independent Apps Script and enter its Web App URL in Broker-Ledger/js/config.js.', false);
  }
  if (!state.preview) {
    initializeSession();
    window.setInterval(function () {
      if (!state.user || state.busy || document.hidden) return;
      checkForUpdates().catch(function () {
        setCloudStatus(false, 'Offline — last data may be stale');
        byId('footer-sync').textContent = 'Cloud sync is unavailable; displayed data may be outdated.';
      });
    }, 8000);
  }
})();
