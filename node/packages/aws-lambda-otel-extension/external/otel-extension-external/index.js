#!/usr/bin/env node

'use strict';

const processStartTime = process.hrtime.bigint();
let isInitializing = true;
let invocationStartTime;
let shutdownStartTime;

module.exports = (async () => {
  const fs = require('fs');
  const http = require('http');
  const path = require('path');
  const os = require('os');
  const { EventEmitter } = require('events');

  const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`;

  const runtimeEventEmitter = new EventEmitter();
  const servers = new Set();

  const userSettings = require('./user-settings');
  const {
    debugLog,
    keepAliveAgents: { http: keepAliveAgent },
  } = require('./helper');
  const reportOtelData = require('./report-otel-data');
  const {
    createMetricsPayload,
    createTracePayload,
    createLogPayload,
    createRequestPayload,
    createResponsePayload,
  } = require('./otel-payloads');

  const pendingReports = new Set();
  const sendReport = (method, payload) => {
    const promise = reportOtelData(method, payload);
    pendingReports.add(promise);
    promise.finally(() => pendingReports.delete(promise));
  };

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

  let lastTelemetryData;

  let ongoingInvocationDeferred;
  const tmpStorageFile = path.resolve(os.tmpdir(), 'sls-otel-extension-storage');

  const monitorLogs = async (extensionIndentifier) => {
    let resolveOngoingInvocationDeferred;
    const closeOngoingInvocation = () => {
      if (resolveOngoingInvocationDeferred) resolveOngoingInvocationDeferred();
      ongoingInvocationDeferred = resolveOngoingInvocationDeferred = null;
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
            let functionLogEvents = data.filter(
              (event) =>
                event.type === 'function' &&
                // TODO: Remove after Dashboard is turned off
                !event.record.includes('SERVERLESS_ENTERPRISE')
            );
            if (process.env.SLS_DEBUG_EXTENSION) {
              functionLogEvents = functionLogEvents.filter(
                (event) => !event.record.startsWith('Extension overhead duration: ')
              );
            }
            if (functionLogEvents.length) {
              const currentRequestContext = getCurrentRequestContext();
              if (!currentRequestContext.requestData) {
                currentRequestContext.logsQueue.push(...functionLogEvents);
              } else {
                sendReport(
                  'logs',
                  createLogPayload(currentRequestContext.requestData, functionLogEvents)
                );
              }
            }

            for (const event of data) {
              switch (event.type) {
                case 'platform.start':
                  debugLog('Extension platform log: start');
                  getCurrentRequestContext('start');
                  // eslint-disable-next-line no-loop-func
                  ongoingInvocationDeferred = new Promise((resolve) => {
                    resolveOngoingInvocationDeferred = resolve;
                  });
                  break;
                case 'platform.runtimeDone':
                  debugLog('Extension platform log: runtimeDone');
                  invocationStartTime = process.hrtime.bigint();
                  runtimeEventEmitter.emit('runtimeDone');
                  if (event.record.status === 'success') continue;
                  // In case of invocation failure extension will be shutdown before generating report
                  if (lastTelemetryData) {
                    fs.writeFileSync(tmpStorageFile, JSON.stringify(lastTelemetryData));
                    debugLog('Extension: Store telemetry data for the next process');
                  }
                  closeOngoingInvocation();
                  break;
                case 'platform.report':
                  debugLog('Extension platform log: report');
                  if (!lastTelemetryData) {
                    try {
                      lastTelemetryData = JSON.parse(fs.readFileSync(tmpStorageFile), 'utf-8');
                      debugLog('Extension: Restore telemetry data from the previous process');
                    } catch {
                      /* ignore */
                    }
                  }
                  if (lastTelemetryData) {
                    sendReport(
                      'metrics',
                      createMetricsPayload(
                        event.record.requestId,
                        lastTelemetryData.record.function,
                        event
                      )
                    );
                  }
                  closeOngoingInvocation();
                  break;
                default:
              }
            }
          });
        })
        .listen(4243, 'sandbox')
    );

    // Subscribe to logs.
    // If extension is being reinitialized in the same container, then in most cases we're already
    // subscribed. There's just a case of reinitialization after crash during lambda initialization,
    // where we can observe that subscription is not active. For that reason we subscribe
    // unconditionaly in all cases (it's not harmful if subscription is active)
    await new Promise((resolve, reject) => {
      const eventTypes = ['platform'];
      if (!userSettings.logs.disabled) eventTypes.push('function');
      const putData = JSON.stringify({
        destination: { protocol: 'HTTP', URI: 'http://sandbox:4243' },
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
    const waitUntilAllReportsAreSent = () => Promise.all(Array.from(pendingReports));
    // Events lifecycle handler
    const waitForEvent = async () => {
      debugLog('Extension: Ready for an event');
      const event = await new Promise((resolve, reject) => {
        if (isInitializing) {
          isInitializing = false;
          debugLog(
            'Extension overhead duration: external initialization:',
            `${Math.round(Number(process.hrtime.bigint() - processStartTime) / 1000000)}ms`
          );
        } else {
          debugLog(
            'Extension overhead duration: external invocation:',
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
            debugLog('Extension: Received event/next response');
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
      debugLog('Extension: Received event ', event.eventType);
      switch (event.eventType) {
        case 'SHUTDOWN':
          shutdownStartTime = process.hrtime.bigint();
          await Promise.resolve(ongoingInvocationDeferred).then(waitUntilAllReportsAreSent);
          break;
        case 'INVOKE':
          getCurrentRequestContext('invoke');
          await new Promise((resolve) => {
            runtimeEventEmitter.once('runtimeDone', resolve);
          })
            .then(waitUntilAllReportsAreSent)
            .then(waitForEvent);
          break;
        default:
          throw new Error(`unknown event: ${event.eventType}`);
      }
    };
    await waitForEvent();
  };

  const monitorInternalTelemetry = () => {
    const OTEL_SERVER_PORT = 2772;
    servers.add(
      http
        .createServer((request, response) => {
          if (request.method !== 'POST') throw new Error('Unexpected request method');
          let body = '';
          request.on('data', (data) => {
            body += data;
          });
          request.on('end', () => {
            response.writeHead(200, '');
            response.end('OK');
            const data = JSON.parse(body);
            debugLog('Internal telemetry payload', JSON.stringify(data));
            switch (data.recordType) {
              case 'eventData':
                {
                  if (data.record.requestEventPayload) {
                    sendReport('request', createRequestPayload(data.record));
                  }
                  const currentRequestContext = getCurrentRequestContext('request');
                  currentRequestContext.requestData = data.record;
                  if (currentRequestContext.logsQueue.length) {
                    sendReport(
                      'logs',
                      createLogPayload(data.record, currentRequestContext.logsQueue)
                    );
                  }
                  if (currentRequestContext.responseEventPayload) {
                    sendReport(
                      'response',
                      createResponsePayload(currentRequestContext.responseEventPayload, data.record)
                    );
                  }
                }
                break;
              case 'telemetryData':
                lastTelemetryData = data;
                if (data.record.responseEventPayload) {
                  const currentRequestContext = getCurrentRequestContext();
                  if (!currentRequestContext.requestData) {
                    currentRequestContext.responseEventPayload = data.record.responseEventPayload;
                  } else {
                    sendReport(
                      'response',
                      createResponsePayload(
                        data.record.responseEventPayload,
                        currentRequestContext.requestData
                      )
                    );
                  }
                }
                sendReport('metrics', createMetricsPayload(data.requestId, data.record.function));
                for (const tracePayload of createTracePayload(
                  data.requestId,
                  data.record.function,
                  data.record.traces
                )) {
                  sendReport('traces', tracePayload);
                }
                break;
              default:
                throw new Error('Unrecognized event data');
            }
          });
        })
        .listen(OTEL_SERVER_PORT)
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
          'Lambda-Extension-Name': 'otel-extension',
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
    'Extension overhead duration: external shutdown:',
    `${Math.round(Number(process.hrtime.bigint() - shutdownStartTime) / 1000000)}ms`
  );
  if (!process.env.SLS_TEST_RUN) process.exit();
})().catch((error) => {
  // Ensure to crash extension process on unhandled rejection
  process.nextTick(() => {
    throw error;
  });
});
