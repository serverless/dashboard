'use strict';

const CapturedEvent = require('./captured-event');

module.exports = (message, code, options = {}) => {
  const timestamp = process.hrtime.bigint();

  return new CapturedEvent('telemetry.notice.generated.v1', {
    timestamp,
    customFingerprint: code,
    tags: {
      'notice.message': message,
      'notice.type': 1,
    },
    _traceSpan: options._traceSpan,
  });
};
