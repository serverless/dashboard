'use strict';

module.exports = (capturedEvent) => {
  switch (capturedEvent.name) {
    case 'telemetry.error.generated.v1':
      // Skip on errors logged via `console.error` in AWS Lambda runtime
      return !capturedEvent.tags.get('error.stacktrace').split('\n')[0].includes('/var/runtime/');
    default:
      return true;
  }
};
