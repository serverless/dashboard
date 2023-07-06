'use strict';

const cjsHook = require('@serverless/sdk/lib/instrumentation/utils/cjs-hook');
const instrumentV2Sdk = require('../../../instrumentation/aws-sdk-v2').install;
const instrumentSmithyClient = require('../../../instrumentation/smithy-client').install;

module.exports.install = () => {
  // AWS SDK v2
  cjsHook.register('/aws-sdk/lib/core.js', instrumentV2Sdk);

  // AWS SDK v3
  cjsHook.register('/@aws-sdk/smithy-client/dist-cjs/client.js', ({ Client }) => {
    return instrumentSmithyClient(Client);
  });

  cjsHook.register('/@smithy/smithy-client/dist-cjs/client.js', ({ Client }) => {
    return instrumentSmithyClient(Client);
  });
};

module.exports.uninstall = () => {
  cjsHook.unregister('/aws-sdk/lib/core.js');
  cjsHook.unregister('/@aws-sdk/smithy-client/dist-cjs/client.js');
};
