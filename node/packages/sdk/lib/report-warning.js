'use strict';

const createWarningCapturedEvent = require('./create-warning-captured-event');

module.exports = (message, code, options = {}) => {
  const type = options.type || 'INTERNAL';
  console.warn(
    JSON.stringify({
      source: 'serverlessSdk',
      type: `WARNING_TYPE_SDK_${type}`,
      message,
      code,
    })
  );
  createWarningCapturedEvent(message, {
    _origin: 'nodeConsole',
    _type: type === 'USER' ? 'sdkUser' : 'sdkInternal',
    fingerprint: code,
  });
};
