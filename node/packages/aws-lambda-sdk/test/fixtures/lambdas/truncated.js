'use strict';

const sdk = require('@serverless/sdk');

const random = require('ext/string/random');

module.exports.handler = async (event) => {
  switch (event.truncationMethod) {
    case '2':
      {
        sdk._createTraceSpan('user.trunc').close();
        let count = 10;
        while (count--) sdk.setTag(`user.x${random({ length: 200 })}`, random({ length: 30000 }));
      }
      break;
    case '3':
      {
        // 1st method
        let count = 30;
        while (count--) {
          const userSpan = sdk._createTraceSpan(`user.x${random({ length: 200 })}`);
          sdk.captureWarning(`Test:${random({ length: 10000 })}`);
          userSpan.close();
        }
      }
      break;
    case '4':
      {
        // 1st method
        let count = 30;
        while (count--) {
          const userSpan = sdk._createTraceSpan(`user.x${random({ length: 200 })}`);
          if (count === 1) sdk.captureWarning(`Test:${random({ length: 10000 })}`);
          sdk.captureError(`Test:${random({ length: 10000 })}`);
          userSpan.close();
        }
      }
      break;
    default: {
      // 1st method
      let count = 7000;
      while (count--) sdk._createTraceSpan(`user.x${random({ length: 200 })}`).close();
    }
  }
  return 'ok';
};
