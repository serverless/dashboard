'use strict';

const cjsHook = require('@serverless/sdk/lib/instrumentation/utils/cjs-hook');
const instrumentV2Sdk = require('../../../instrumentation/aws-sdk-v2').install;
const instrumentV3Client = require('../../../instrumentation/aws-sdk-v3-client').install;

const instrumentedv3SmithyClients = new WeakMap();

module.exports.install = () => {
  // AWS SDK v2
  cjsHook.register('/aws-sdk/lib/core.js', instrumentV2Sdk);

  // AWS SDK v3
  cjsHook.register('/@aws-sdk/smithy-client/dist-cjs/client.js', ({ Client }) => {
    if (instrumentedv3SmithyClients.has(Client)) return instrumentedv3SmithyClients.get(Client);
    const originalSend = Client.prototype.send;
    const uninstallers = new Set();
    Client.prototype.send = function send(command, optionsOrCb, cb) {
      try {
        uninstallers.add(instrumentV3Client(this));
      } catch (error) {
        serverlessSdk._reportError(error);
      }
      return originalSend.call(this, command, optionsOrCb, cb);
    };
    const uninstall = () => {
      if (!instrumentedv3SmithyClients.has(Client)) return;
      for (const uninstallClient of uninstallers) uninstallClient();
      Client.prototype.send = originalSend;
      instrumentedv3SmithyClients.delete(Client);
    };
    instrumentedv3SmithyClients.set(Client, uninstall);
    return uninstall;
  });
};

module.exports.uninstall = () => {
  cjsHook.unregister('/aws-sdk/lib/core.js');
  cjsHook.unregister('/@aws-sdk/smithy-client/dist-cjs/client.js');
};

const serverlessSdk = require('../../../');
