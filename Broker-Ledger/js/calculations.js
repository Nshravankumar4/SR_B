(function (root) {
  'use strict';

  const STATUS = Object.freeze(['TOBILLED', 'A/TO-PAY', 'F/TO-PAY']);
  const MONEY_FIELDS = Object.freeze([
    'freight', 'tM', 'advance', 'advance2', 'advance3',
    'extraAmount', 'pM'
  ]);
  const COD_FIELD = 'codToPay';

  function normalizeStatus(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function parseMoney(value, options) {
    const allowEmpty = Boolean(options && options.allowEmpty);
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      return allowEmpty ? { ok: true, empty: true, paise: 0 } : { ok: false, error: 'Enter an amount.' };
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return { ok: false, error: 'Enter a valid amount.' };
      const paise = Math.round((value + Number.EPSILON) * 100);
      return Number.isSafeInteger(paise) ? { ok: true, empty: false, paise } : { ok: false, error: 'Amount is too large.' };
    }
    let text = String(value).trim().replace(/^₹\s*/, '').replace(/\s*₹$/, '').replace(/\s/g, '');
    if (!text) return allowEmpty ? { ok: true, empty: true, paise: 0 } : { ok: false, error: 'Enter an amount.' };
    const sign = text[0] === '-' ? -1 : 1;
    if (text[0] === '-' || text[0] === '+') text = text.slice(1);
    const amount = text.match(/^((?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3}))(?:\.(\d{1,2}))?$/);
    if (!amount) return { ok: false, error: 'Enter a valid amount (up to 2 decimal places).' };
    const whole = amount[1].replace(/,/g, '');
    const fraction = amount[2] || '';
    const rupees = Number(whole);
    const paise = rupees * 100 + Number((fraction + '00').slice(0, 2));
    if (!Number.isSafeInteger(paise)) return { ok: false, error: 'Amount is too large.' };
    return { ok: true, empty: false, paise: sign * paise };
  }

  function numberToPaise(value, field, errors, optional) {
    const parsed = parseMoney(value, { allowEmpty: optional });
    if (!parsed.ok) {
      errors[field] = parsed.error;
      return 0;
    }
    return parsed.paise;
  }

  function fromPaise(paise) {
    return paise / 100;
  }

  function calculateShipment(record) {
    const shipment = record || {};
    const errors = {};
    const optional = new Set(['tM', 'advance', 'advance2', 'advance3', 'extraAmount', 'pM']);
    const parsed = {};
    MONEY_FIELDS.forEach(function (field) {
      parsed[field] = numberToPaise(shipment[field], field, errors, optional.has(field));
    });
    const status = normalizeStatus(shipment.toPayStatus);
    if (!STATUS.includes(status)) errors.toPayStatus = 'Choose one of the supported statuses.';

    if (Object.keys(errors).length) {
      return {
        codToPay: null,
        pendingTobilled: null,
        pendingAmount: null,
        errors: errors
      };
    }

    let pendingTobilled = null;
    let pendingAmount = null;
    let podAmountStatus = 0;
    let codToPay = shipment[COD_FIELD] === null || shipment[COD_FIELD] === undefined
      ? ''
      : shipment[COD_FIELD];
    if (status === 'TOBILLED') {
      pendingTobilled = fromPaise(
        parsed.freight - parsed.tM - parsed.advance - parsed.advance2 - parsed.advance3
      );
      pendingAmount = fromPaise(
        Math.round(pendingTobilled * 100) + parsed.extraAmount - parsed.pM
      );
      // Master Workbook Col AA Formula: =IF(M="TOBILLED", V + W - Y - Z) -> numeric 0
      podAmountStatus = fromPaise(
        Math.round(pendingTobilled * 100) + parsed.extraAmount - parsed.pM - Math.round(pendingAmount * 100)
      );
    } else if (status === 'A/TO-PAY' || status === 'F/TO-PAY') {
      const codToPayPaise = parsed.freight - parsed.tM - parsed.advance - parsed.advance2 - parsed.advance3;
      codToPay = fromPaise(codToPayPaise);
      pendingAmount = fromPaise(parsed.freight - parsed.tM - parsed.advance - codToPayPaise);
      podAmountStatus = 0;
    }

    return {
      codToPay: codToPay,
      pendingTobilled: pendingTobilled,
      pendingAmount: pendingAmount,
      podAmountStatus: podAmountStatus,
      errors: errors
    };
  }

  function summarize(records) {
    const summary = {
      shipmentCount: 0,
      freightPaise: 0,
      advancePaise: 0,
      advance2Paise: 0,
      advance3Paise: 0,
      tMPaise: 0,
      pMPaise: 0,
      extraAmountPaise: 0,
      pendingTobilledPaise: 0,
      pendingAmountPaise: 0,
      codToPayPaise: 0,
      statusCounts: { 'TOBILLED': 0, 'A/TO-PAY': 0, 'F/TO-PAY': 0 }
    };
    (records || []).forEach(function (record) {
      if (!record) return;
      const status = normalizeStatus(record.toPayStatus);
      if (!STATUS.includes(status)) return;
      const result = calculateShipment(record);
      if (Object.keys(result.errors).length) return;
      summary.shipmentCount += 1;
      summary.statusCounts[status] += 1;
      summary.freightPaise += parseMoney(record.freight).paise;
      summary.advancePaise += parseMoney(record.advance, { allowEmpty: true }).paise;
      summary.advance2Paise += parseMoney(record.advance2, { allowEmpty: true }).paise;
      summary.advance3Paise += parseMoney(record.advance3, { allowEmpty: true }).paise;
      summary.tMPaise += parseMoney(record.tM, { allowEmpty: true }).paise;
      summary.pMPaise += parseMoney(record.pM, { allowEmpty: true }).paise;
      summary.extraAmountPaise += parseMoney(record.extraAmount, { allowEmpty: true }).paise;
      if (result.pendingTobilled !== null) summary.pendingTobilledPaise += Math.round(result.pendingTobilled * 100);
      if (result.pendingAmount !== null) summary.pendingAmountPaise += Math.round(result.pendingAmount * 100);
      const cod = parseMoney(result.codToPay, { allowEmpty: true });
      if (cod.ok && !cod.empty) summary.codToPayPaise += cod.paise;
    });
    summary.advancePaise += summary.advance2Paise + summary.advance3Paise;
    return summary;
  }

  const api = Object.freeze({
    STATUS: STATUS,
    MONEY_FIELDS: MONEY_FIELDS,
    normalizeStatus: normalizeStatus,
    parseMoney: parseMoney,
    calculateShipment: calculateShipment,
    summarize: summarize,
    fromPaise: fromPaise
  });
  root.BrokerCalculations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
