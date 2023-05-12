'use strict';

const serverlessSdk = require('./sdk');

const devModeSpecificEventFingerprints = new Set([
  'INPUT_BODY_BINARY',
  'INPUT_BODY_TOO_LARGE',
  'OUTPUT_BODY_BINARY',
  'OUTPUT_BODY_TOO_LARGE',
]);

module.exports = (capturedEvent) => {
  if (
    !serverlessSdk._isDevMode &&
    devModeSpecificEventFingerprints.has(capturedEvent.customFingerprint)
  ) {
    return false;
  }
  switch (capturedEvent.name) {
    case 'telemetry.error.generated.v1':
      // Skip on errors logged via `console.error` in AWS Lambda runtime
      return !capturedEvent.tags.get('error.stacktrace').split('\n')[0].includes('/var/runtime/');
    default:
      return true;
  }
};
