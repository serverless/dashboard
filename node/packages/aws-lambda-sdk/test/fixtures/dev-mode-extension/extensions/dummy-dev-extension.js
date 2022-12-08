#!/usr/bin/env node

'use strict';

const processStartTime = process.hrtime.bigint();

(async () => {
  const debugLog = (...args) => {
    if (process.env.SLS_SDK_DEBUG) {
      process._rawDebug('⚡ SDK:', ...args);
    }
  };
  debugLog('External initialization');

  let isInitializing = true;
  let invocationStartTime;
  let shutdownStartTime;

  const http = require('http');

  const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`;
  const sandboxHostname = process.env.SLS_TEST_EXTENSION_HOSTNAME || 'sandbox';

  const servers = new Set();

  const keepAliveAgent = new http.Agent({ keepAlive: true });

  // Rotate current request data
  // Each new "platform.start" or invoke event resets the object
  const getCurrentRequestContext = (() => {
    let current;
    return (uniqueEventName) => {
      if (!current) current = { logsQueue: [] };
      if (!uniqueEventName) return current;
      if (current[uniqueEventName]) current = { logsQueue: [] };
      current[uniqueEventName] = true;
      return current;
    };
  })();

  let invocationEndDeferred;
  let runtimeDoneDeferred;
  let resolveRuntimeDoneDeferred;

  const monitorLogs = async (extensionIndentifier) => {
    let resolveInvocationEndDeferred;
    const endInvocation = () => {
      if (resolveInvocationEndDeferred) resolveInvocationEndDeferred();
      invocationEndDeferred = resolveInvocationEndDeferred = null;
    };

    const runtimeDone = () => {
      if (resolveRuntimeDoneDeferred) resolveRuntimeDoneDeferred();
      runtimeDoneDeferred = resolveRuntimeDoneDeferred = null;
    };

    // Setup a logs listener server
    servers.add(
      http
        .createServer((request, response) => {
          if (request.method !== 'POST') throw new Error('Unexpected request method');

          let body = '';
          request.on('data', (data) => {
            body += data;
          });
          request.on('end', () => {
            response.writeHead(200, {});
            response.end('OK');
            const data = JSON.parse(body);

            for (const event of data) {
              switch (event.type) {
                case 'platform.start':
                  debugLog('platform log: start');
                  getCurrentRequestContext('start');
                  // eslint-disable-next-line no-loop-func
                  invocationEndDeferred = new Promise((resolve) => {
                    resolveInvocationEndDeferred = resolve;
                  });
                  if (!runtimeDoneDeferred) {
                    // eslint-disable-next-line no-loop-func
                    runtimeDoneDeferred = new Promise((resolve) => {
                      resolveRuntimeDoneDeferred = resolve;
                    });
                  }
                  break;
                case 'platform.runtimeDone':
                  debugLog('platform log: runtimeDone');
                  invocationStartTime = process.hrtime.bigint();
                  runtimeDone();
                  if (event.record.status === 'success') continue;
                  endInvocation();
                  break;
                case 'platform.report':
                  debugLog('platform log: report');
                  endInvocation();
                  break;
                default:
              }
            }
          });
        })
        .listen(4243, sandboxHostname)
    );

    await new Promise((resolve, reject) => {
      const eventTypes = ['platform'];
      const putData = JSON.stringify({
        destination: { protocol: 'HTTP', URI: `http://${sandboxHostname}:4243` },
        types: eventTypes,
        buffering: { timeoutMs: 25, maxBytes: 262144, maxItems: 1000 },
        schemaVersion: '2021-03-18',
      });
      const request = http.request(
        `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-08-15/logs`,
        {
          agent: keepAliveAgent,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Lambda-Extension-Identifier': extensionIndentifier,
            'Content-Length': Buffer.byteLength(putData),
          },
        },
        (response) => {
          if (response.statusCode === 200) {
            resolve();
          } else {
            reject(
              new Error(`Unexpected logs subscribe response status code: ${response.statusCode}`)
            );
          }
        }
      );
      request.on('error', reject);
      request.write(putData);
      request.end();
    });
  };

  const monitorEvents = async (extensionIndentifier) => {
    // Events lifecycle handler
    const waitForEvent = async () => {
      debugLog('External ready for an event');
      const event = await new Promise((resolve, reject) => {
        if (isInitializing) {
          isInitializing = false;
          debugLog(
            'Overhead duration: External initialization:',
            `${Math.round(Number(process.hrtime.bigint() - processStartTime) / 1000000)}ms`
          );
        } else {
          debugLog(
            'Overhead duration: External invocation:',
            `${Math.round(Number(process.hrtime.bigint() - invocationStartTime) / 1000000)}ms`
          );
        }
        const request = http.request(
          `${baseUrl}/event/next`,
          {
            agent: keepAliveAgent,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Lambda-Extension-Identifier': extensionIndentifier,
            },
          },
          (response) => {
            debugLog('External received event/next response');
            if (response.statusCode !== 200) {
              reject(new Error(`Unexpected register response status code: ${response.statusCode}`));
              return;
            }
            response.setEncoding('utf8');
            let result = '';
            response.on('data', (chunk) => {
              result += String(chunk);
            });
            response.on('end', () => {
              resolve(JSON.parse(result));
            });
          }
        );
        request.on('error', reject);
        request.end();
      });
      debugLog('External event ', event.eventType);
      switch (event.eventType) {
        case 'SHUTDOWN':
          shutdownStartTime = process.hrtime.bigint();
          await Promise.resolve(invocationEndDeferred);
          break;
        case 'INVOKE':
          if (!runtimeDoneDeferred) {
            runtimeDoneDeferred = new Promise((resolve) => {
              resolveRuntimeDoneDeferred = resolve;
            });
          }
          getCurrentRequestContext('invoke');
          await Promise.resolve(runtimeDoneDeferred).then(waitForEvent);
          break;
        default:
          throw new Error(`unknown event: ${event.eventType}`);
      }
    };
    await waitForEvent();
  };

  const monitorInternalTelemetry = () => {
    servers.add(
      http
        .createServer((request, response) => {
          debugLog('External: telemetry request');
          request.on('data', () => {});
          request.on('end', () => {
            response.writeHead(200, '');
            debugLog('External: telemetry response');
            response.end('OK');
          });
        })
        .listen(2773)
    );
  };

  // Register extension
  await new Promise((resolve, reject) => {
    const postData = JSON.stringify({ events: ['INVOKE', 'SHUTDOWN'] });
    const request = http.request(
      `${baseUrl}/register`,
      {
        agent: keepAliveAgent,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Lambda-Extension-Name': 'dummy-dev-extension.js',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Unexpected register response status code: ${response.statusCode}`));
          return;
        }

        const extensionIdentifier = response.headers['lambda-extension-identifier'];
        monitorInternalTelemetry();
        resolve(
          Promise.all([monitorEvents(extensionIdentifier), monitorLogs(extensionIdentifier)])
        );
      }
    );
    request.on('error', reject);
    request.write(postData);
    request.end();
  });

  for (const server of servers) server.close();
  debugLog(
    'Overhead duration: External shutdown:',
    `${Math.round(Number(process.hrtime.bigint() - shutdownStartTime) / 1000000)}ms`
  );
  process.exit();
})().catch((error) => {
  // Ensure to crash extension process on unhandled rejection
  process.nextTick(() => {
    throw error;
  });
});
