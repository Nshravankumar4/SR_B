(function (root) {
  'use strict';

  const REQUIRED = ['transportName', 'date', 'lrNo', 'truckNo', 'from', 'to', 'freight', 'toPayStatus'];
  const TEXT_LIMITS = Object.freeze({
    transportName: 120, lrNo: 60, truckNo: 40, from: 100, to: 100,
    accountNo: 40, ifscCode: 20, bank: 100, codToPay: 80,
    podAmountStatus: 100, remarks: 500
  });

  function validateShipment(record) {
    const errors = {};
    const item = record || {};
    REQUIRED.forEach(function (field) {
      if (item[field] === null || item[field] === undefined || String(item[field]).trim() === '') {
        errors[field] = 'This field is required.';
      }
    });
    Object.keys(TEXT_LIMITS).forEach(function (field) {
      const value = item[field];
      if (value !== null && value !== undefined && String(value).length > TEXT_LIMITS[field]) {
        errors[field] = 'This value is too long.';
      }
    });
    const rawDate = String(item.date || '').trim();
    const date = rawDate.replace(/\//g, '-');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{2}-\d{2}-\d{4}$/.test(date)) {
      errors.date = 'Enter a valid shipment date.';
    } else if (date) {
      const parts = date.indexOf('-') === 4 ? date.split('-').map(Number) : date.split('-').reverse().map(Number);
      const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (parsed.getUTCFullYear() !== parts[0] || parsed.getUTCMonth() !== parts[1] - 1 || parsed.getUTCDate() !== parts[2]) {
        errors.date = 'Enter a real calendar date.';
      }
    }
    const status = root.BrokerCalculations.normalizeStatus(item.toPayStatus);
    if (!root.BrokerCalculations.STATUS.includes(status)) {
      errors.toPayStatus = 'Choose a supported status.';
    }
    const calculated = root.BrokerCalculations.calculateShipment(item);
    Object.assign(errors, calculated.errors);
    return { valid: Object.keys(errors).length === 0, errors: errors, calculated: calculated };
  }

  root.BrokerValidation = Object.freeze({
    REQUIRED: REQUIRED,
    TEXT_LIMITS: TEXT_LIMITS,
    validateShipment: validateShipment
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BrokerValidation;
})(typeof window !== 'undefined' ? window : globalThis);
