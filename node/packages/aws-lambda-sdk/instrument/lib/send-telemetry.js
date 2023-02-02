'use strict';

const serverlessSdk = require('./sdk');

if (!serverlessSdk._isDevMode) {
  // No dev mode, export noop function
  module.exports = async () => {};
  return;
}

const http = require('http');
const limit = require('ext/promise/limit').bind(Promise);

const keepAliveAgent = new http.Agent({ keepAlive: true });

const telemetryServerUrl = 'http://localhost:2773/';

module.exports = limit(10, async (name, body) => {
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
            serverlessSdk._reportWarning(
              'Cannot propagate telemetry, ' +
                `server responded with "${response.statusCode}" status code\n`,
              'DEV_MODE_SERVER_REJECTION'
            );
          }
          response.on('data', () => {});
          response.on('end', resolve);
        }
      );
      request.on('error', reject);
      request.on('socket', (socket) => (requestSocket = socket));
      request.write(body);
      request.end();
    });
  } catch (error) {
    serverlessSdk._reportWarning(
      `Cannot propagate telemetry: ${error.message}`,
      'DEV_MODE_SERVER_ERROR'
    );
  } finally {
    if (requestSocket) requestSocket.unref();
  }
  serverlessSdk._debugLog(
    `Telemetry sent in: ${Math.round(
      Number(process.hrtime.bigint() - requestStartTime) / 1000000
    )}ms`
  );
});
