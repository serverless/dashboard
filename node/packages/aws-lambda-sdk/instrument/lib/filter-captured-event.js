'use strict';

module.exports = (capturedEvent) => {
  // Skip on errors logged via `console.error` in AWS Lambda runtime
  if (capturedEvent.name !== 'telemetry.error.generated.v1') return true;
  return !capturedEvent.tags.get('error.stacktrace').split('\n')[0].includes('/var/runtime/');
};
