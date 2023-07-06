'use strict';

const instrumentV3Client = require('./aws-sdk-v3-client').install;

const instrumentedv3SmithyClients = new WeakMap();

module.exports.install = (Client) => {
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
};

const serverlessSdk = require('../');
