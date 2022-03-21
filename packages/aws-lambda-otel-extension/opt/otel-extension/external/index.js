#!/usr/bin/env node

'use strict';

const { unzip: unzipWtithCallback } = require('zlib');
const { promisify } = require('util');
const { writeFileSync, existsSync, readFileSync } = require('fs');
const get = require('lodash.get');
const { register, next } = require('./lambda-apis/extensions-api');
const { subscribe } = require('./lambda-apis/logs-api');
const { listen } = require('./lambda-apis/http-listener');
const { customListen } = require('./custom-http-listener');
const reportOtelData = require('./report-otel-data');
const { logMessage, OTEL_SERVER_PORT } = require('../lib/helper');
const {
  EventType,
  SAVE_FILE,
  SENT_FILE,
  receiverAddress,
  RECEIVER_PORT,
  SUBSCRIPTION_BODY,
} = require('./helper');
const { createMetricsPayload, createTracePayload } = require('./otel-payloads');

const unzip = promisify(unzipWtithCallback);

function handleShutdown() {
  process.exit(0);
}

let sentRequests = [];
let logsQueue = [];
// We need to be able to reassign this variable when a new
// event comes through
// eslint-disable-next-line prefer-const
let mainEventData = {};

if (existsSync(SAVE_FILE)) {
  try {
    logsQueue = JSON.parse(readFileSync(SAVE_FILE, { encoding: 'utf-8' }));
  } catch (error) {
    logMessage('Failed to parse logs queue file');
  }
}
if (existsSync(SENT_FILE)) {
  try {
    sentRequests = JSON.parse(readFileSync(SENT_FILE, { encoding: 'utf-8' }));
  } catch (error) {
    logMessage('Failed to sent request file');
  }
}

// Exported for testing convienence
module.exports = (async function main() {
  const extensionId = await register();
  let receivedData = false;

  const groupLogs = async (logList) => {
    logMessage('LOGS: ', JSON.stringify(logList));
    const combinedLogs = logList.reduce((arr, logs) => [...arr, ...logs], []);

    const items = await Promise.all(
      combinedLogs.map(async (log) => {
        if (log.recordType === 'telemetryData') {
          try {
            const reportCompressed = log.record.slice(log.record.indexOf('⚡.') + 2).trim();
            const raw = (await unzip(Buffer.from(reportCompressed, 'base64'))).toString();
            const parsed = JSON.parse(raw);
            const requestId = log.record.split('\t')[1];
            return {
              ...log,
              record: parsed,
              origin: 'sls-layer',
              requestId,
            };
          } catch (error) {
            logMessage('failed to parse line', error);
            return log;
          }
        }
        return {
          ...log,
          requestId: log.record.requestId,
        };
      })
    );

    return items.reduce((obj, item) => {
      if (!obj[item.requestId]) {
        obj[item.requestId] = {};
      }
      return {
        ...obj,
        [item.requestId]: {
          ...obj[item.requestId],
          [item.origin === 'sls-layer' ? 'layer' : item.type]: item,
        },
      };
    }, {});
  };

  // function for processing collected logs
  async function uploadLogs(logList, focusIds = []) {
    const currentIndex = logList.length;
    const groupedByRequestId = await groupLogs(logList);

    const { ready, notReady } = Object.keys(groupedByRequestId).reduce(
      (obj, id) => {
        const data = groupedByRequestId[id];
        const report = data['platform.report'];
        const { function: fun, traces } = get(data, 'layer.record') || {};

        // report is not required so we can send duration async
        if (fun && traces) {
          return {
            ...obj,
            ready: {
              ...obj.ready,
              [id]: {
                'platform.report': report,
                'function': { record: fun },
                'traces': { record: traces },
              },
            },
          };
        }
        return {
          ...obj,
          notReady: {
            ...obj.notReady,
            [id]: data,
          },
        };
      },
      {
        ready: {},
        notReady: {},
      }
    );

    if (focusIds.length > 0) {
      const readyIds = Object.keys(ready);
      readyIds.forEach((id) => {
        if (!focusIds.includes(id)) {
          delete ready[id];
        }
      });
    }

    logMessage('READY: ', JSON.stringify(ready));
    logMessage('NOT READY: ', JSON.stringify(notReady));

    logMessage('Grouped: ', JSON.stringify(ready));
    logMessage('Sent Requests: ', JSON.stringify(sentRequests));
    for (const { requestId, trace, report } of sentRequests) {
      if (ready[requestId] && trace && report) delete ready[requestId];
    }
    const orgId = get(ready[Object.keys(ready)[0]], 'function.record.sls_org_id', 'xxxx');
    logMessage('OrgId: ', orgId);
    const metricData = createMetricsPayload(ready, sentRequests);
    logMessage('Metric Data: ', JSON.stringify(metricData));

    const traces = createTracePayload(ready, sentRequests);
    logMessage('Traces Data: ', JSON.stringify(traces));

    if (metricData.length) {
      try {
        await reportOtelData.metrics(metricData);
      } catch (error) {
        logMessage('Metric send Error:', error);
      }
    }
    if (traces.length) {
      try {
        await reportOtelData.traces(traces);
      } catch (error) {
        logMessage('Trace send Error:', error);
      }
    }
    // Save request ids so we don't send them twice
    const readyKeys = Object.keys(ready);
    sentRequests.forEach((obj) => {
      const { requestId } = obj;
      const found = readyKeys.find((id) => id === requestId);
      if (found) {
        obj.trace = !!ready[requestId].function && !!ready[requestId].traces;
        obj.report = !!ready[requestId]['platform.report'];
      }
    });
    readyKeys
      .filter((id) => !sentRequests.find(({ requestId }) => id === requestId))
      .forEach((id) =>
        sentRequests.push({
          requestId: id,
          trace: !!ready[id].function && !!ready[id].traces,
          report: !!ready[id]['platform.report'],
        })
      );

    // Only remove logs that were marked as ready or have not sent a report yet
    const incompleteRequestIds = [
      ...Object.keys(notReady),
      ...sentRequests.filter(({ report }) => !report).map(({ requestId }) => requestId),
    ];
    logMessage('Incomplete Request Ids: ', JSON.stringify(incompleteRequestIds));
    logList.forEach((subList, index) => {
      if (index < currentIndex) {
        const saveList = subList.filter((log) => {
          if (log.recordType === 'telemetryData') {
            return (
              incompleteRequestIds.includes(log.record.split('\t')[1]) ||
              (focusIds.length > 0 && !focusIds.includes(log.record.split('\t')[1]))
            );
          }
          return (
            incompleteRequestIds.includes(log.record.requestId) ||
            (focusIds.length > 0 && !focusIds.includes(log.record.requestId))
          );
        });
        subList.splice(0);
        subList.push(...saveList);
      }
    });
    logMessage('Remaining logs queue: ', JSON.stringify(logList));
  }

  const { server: otelServer } = customListen({
    logsQueue,
    port: OTEL_SERVER_PORT,
    mainEventData,
    callback: async (...args) => {
      await uploadLogs(...args);
      receivedData = true;
    },
  });

  const { server } = listen({
    port: RECEIVER_PORT,
    address: receiverAddress(),
    mainEventData,
    logsQueue,
    callback: uploadLogs,
  });

  // subscribing listener to the Logs API
  await subscribe(extensionId, SUBSCRIPTION_BODY);

  process.on('SIGINT', async () => {
    await uploadLogs(logsQueue);
    handleShutdown('SIGINT');
  });
  process.on('SIGTERM', async () => {
    await uploadLogs(logsQueue);
    handleShutdown('SIGINT');
  });

  // execute extensions logic
  // eslint-disable-next-line no-constant-condition
  while (true) {
    logMessage('Waiting for next event');
    const event = await next(extensionId);
    logMessage('Processing event: ', event.eventType);
    if (event.eventType === EventType.SHUTDOWN) {
      const initialQueueLength = logsQueue.length;

      // Wait until last logs are send to our server
      const waitRecursive = () =>
        new Promise((resolve) => {
          setTimeout(async () => {
            logMessage('Checking log length...', initialQueueLength, logsQueue.length);
            if (initialQueueLength < logsQueue.length) {
              resolve();
              return;
            }
            await waitRecursive();
            resolve();
          }, 1000);
        });
      await waitRecursive();

      logMessage('AFTER SOME TIME WE WILL UPLOAD...', JSON.stringify(logsQueue));

      await uploadLogs(logsQueue, []);

      logMessage('DONE...', JSON.stringify(logsQueue));
      writeFileSync(SAVE_FILE, JSON.stringify(logsQueue));
      writeFileSync(SENT_FILE, JSON.stringify(sentRequests));
      server.close();
      otelServer.close();
      break;
    } else if (event.eventType === EventType.INVOKE) {
      /* eslint-disable no-loop-func */
      const waitRecursive = () =>
        new Promise((resolve) => {
          setTimeout(async () => {
            logMessage('Checking data received...', receivedData);
            if (receivedData) {
              resolve();
              return;
            }
            await waitRecursive();
            resolve();
          }, 50);
        });
      /* eslint-enable no-loop-func */
      if (!process.env.DO_NOT_WAIT) {
        await waitRecursive();
      }
      writeFileSync(SENT_FILE, JSON.stringify(sentRequests));
      writeFileSync(SAVE_FILE, JSON.stringify(logsQueue));
      receivedData = false; // Reset received event
    } else {
      throw new Error(`unknown event: ${event.eventType}`);
    }
  }
})();
