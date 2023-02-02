'use strict';

const createWarningCapturedEvent = require('./create-warning-captured-event');

module.exports = (message, code) => {
  console.warn({
    source: 'serverlessSdk',
    message,
    code,
  });
  createWarningCapturedEvent(message, {
    _origin: 'nodeConsole',
    type: 'sdk',
    fingerprint: code,
  });
};
