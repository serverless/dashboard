'use strict';

const serverlessSdk = global.serverlessSdk || require('../');

if (!serverlessSdk._isDevMode) {
  // No dev mode, export noop function
  module.exports = async () => {};
  return;
}

const http = require('http');

const keepAliveAgent = new http.Agent({ keepAlive: true });

const telemetryServerUrl = 'http://localhost:2773/';

module.exports = async (name, body) => {
  let requestSocket;
  const requestStartTime = process.hrtime.bigint();
  serverlessSdk._debugLog('Telemetry send', name);
  try {
    await new Promise((resolve, reject) => {
      const request = http.request(
        telemetryServerUrl + name,
        {
          agent: keepAliveAgent,
          headers: {
            'Content-Type': 'application/x-protobuf',
            'Content-Length': body.length,
          },
          _slsIgnore: true,
        },
        (response) => {
          if (response.statusCode !== 200) {
            process.stderr.write(
              'Serverless SDK Warning: Cannot propagate telemetry, ' +
                `server responded with "${response.statusCode}" status code\n`
            );
          }
          resolve();
        }
      );
      request.on('error', reject);
      request.on('socket', (socket) => (requestSocket = socket));
      request.write(body);
      request.end();
    });
  } catch (error) {
    process.stderr.write(`Serverless SDK Warning: Cannot propagate telemetry: ${error.message}\n`);
  } finally {
    if (requestSocket) requestSocket.unref();
  }
  serverlessSdk._debugLog(
    `Telemetry sent in: ${Math.round(
      Number(process.hrtime.bigint() - requestStartTime) / 1000000
    )}ms`
  );
};
