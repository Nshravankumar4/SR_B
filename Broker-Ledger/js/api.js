(function (root) {
  'use strict';

  function apiUrl() {
    return String((root.BROKER_CONFIG && root.BROKER_CONFIG.apiUrl) || '').trim();
  }

  function sessionEnvelope(action, data) {
    const session = JSON.parse(sessionStorage.getItem('broker-ledger-session') || 'null');
    return Object.assign({
      action: action,
      token: session && session.token ? session.token : '',
      username: session && session.username ? session.username : '',
      requestId: root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + Math.random()
    }, data || {});
  }

  async function request(action, data, options) {
    const url = apiUrl();
    if (!url) throw new Error('Google Apps Script URL is not configured. Set it in js/config.js after deploying the backend.');
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(sessionEnvelope(action, data))
      });
    } catch (error) {
      throw new Error('Could not reach the Broker Ledger backend. Check the Apps Script deployment URL and network connection.');
    }
    if (!response.ok) throw new Error('Backend request failed with HTTP ' + response.status + '.');
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('The backend returned an unreadable response. Confirm its deployment and permissions.');
    }
    if (!result || result.success !== true) {
      if (result && result.error === 'SESSION_INVALID') {
        sessionStorage.removeItem('broker-ledger-session');
        root.dispatchEvent(new CustomEvent('broker:session-invalid'));
      }
      throw new Error((result && result.message) || 'The backend rejected the request.');
    }
    return result;
  }

  root.BrokerApi = Object.freeze({
    configured: function () { return Boolean(apiUrl()); },
    login: async function (username, password) {
      const result = await request('login', { username: username, password: password });
      return { username: username, name: result.name, role: result.role, token: result.token };
    },
    logout: function () { return request('logout'); },
    list: function () { return request('getAll'); },
    create: function (record) { return request('createShipment', { record: record }); },
    update: function (id, record) { return request('updateShipment', { id: id, record: record }); },
    remove: function (id) { return request('deleteShipment', { id: id }); },
    importMany: function (records) { return request('importShipments', { records: records }); },
    backup: function () { return request('createBackup'); }
  });
})(window);
