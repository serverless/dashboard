#!/usr/bin/env node

'use strict';

const { unzip: unzipWtithCallback } = require('zlib');
const { promisify } = require('util');
const get = require('lodash.get');
const { register, next } = require('./lambda-apis/extensions-api');
const { subscribe } = require('./lambda-apis/logs-api');
const { listen } = require('./lambda-apis/http-listener');
const reportOtelData = require('./report-otel-data');
const {
  EventType,
  logMessage,
  receiverAddress,
  RECEIVER_PORT,
  SUBSCRIPTION_BODY,
  slsLayerRegex,
} = require('./helper');
const { createMetricsPayload, createTracePayload } = require('./otel-payloads');

const unzip = promisify(unzipWtithCallback);

function handleShutdown() {
  process.exit(0);
}

// Exported for testing convienence
module.exports = (async function main() {
  const extensionId = await register();

  const sentRequestIds = [];
  const { logsQueue } = listen(receiverAddress(), RECEIVER_PORT);

  // subscribing listener to the Logs API
  await subscribe(extensionId, SUBSCRIPTION_BODY);

  const groupLogs = async (logList) => {
    logMessage('LOGS: ', JSON.stringify(logList));
    const combinedLogs = logList.reduce((arr, logs) => [...arr, ...logs], []);
    const filteredItems = combinedLogs.filter((log) => {
      if (log.type === 'platform.report') {
        return true;
      } else if (log.type === 'function' && slsLayerRegex.test(log.record)) {
        return true;
      }
      return false;
    });

    const items = await Promise.all(
      filteredItems.map(async (log) => {
        if (log.type === 'function') {
          try {
            const jsonString = log.record
              .substring(log.record.indexOf('{'), log.record.length)
              .trim();
            const { b, origin } = JSON.parse(jsonString);
            const raw = (await unzip(Buffer.from(b, 'base64'))).toString();
            const parsed = JSON.parse(raw);
            const requestId = log.record.split('\t')[1];
            return {
              ...log,
              record: parsed,
              origin,
              requestId,
            };
          } catch (error) {
            console.log('failed to parse line', error);
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
  async function uploadLogs(logList) {
    const currentIndex = logList.length;
    const groupedByRequestId = await groupLogs(logList);

    const { ready, notReady } = Object.keys(groupedByRequestId).reduce(
      (obj, id) => {
        const data = groupedByRequestId[id];
        const report = data['platform.report'];
        const { function: fun, traces } = get(data, 'layer.record') || {};

        if (report && fun && traces) {
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

    logMessage('READY: ', JSON.stringify(ready));
    logMessage('NOT READY: ', JSON.stringify(notReady));

    logMessage('Grouped: ', JSON.stringify(ready));
    logMessage('Sent Request Ids: ', JSON.stringify(sentRequestIds));
    for (const requestId of sentRequestIds) {
      if (ready[requestId]) delete ready[requestId];
    }
    const orgId = get(ready[Object.keys(ready)[0]], 'function.record.sls_org_id', 'xxxx');
    logMessage('OrgId: ', orgId);
    const metricData = createMetricsPayload(ready);
    logMessage('Metric Data: ', JSON.stringify(metricData));

    const traces = createTracePayload(ready);
    logMessage('Traces Data: ', JSON.stringify(traces));

    if (metricData.length) {
      try {
        await reportOtelData.metrics(metricData);
      } catch (error) {
        console.log('Metric send Error:', error);
      }
    }
    if (traces.length) {
      try {
        await reportOtelData.traces(traces);
      } catch (error) {
        console.log('Trace send Error:', error);
      }
    }
    // Save request ids so we don't send them twice
    Object.keys(ready).forEach((id) => sentRequestIds.push(id));

    // Only remove logs that were marked as ready
    const incompleteRequestIds = Object.keys(notReady);
    logList.forEach((subList, index) => {
      if (index < currentIndex) {
        const saveList = subList.filter((log) => {
          if (log.type === 'function') {
            return incompleteRequestIds.includes(log.record.split('\t')[1]);
          }
          return incompleteRequestIds.includes(log.record.requestId);
        });
        subList.splice(0);
        subList.push(...saveList);
      }
    });

    logMessage('Remaining logs queue: ', JSON.stringify(logList));
  }

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
            }
            await waitRecursive();
          }, 1000);
        });
      await waitRecursive();

      logMessage('AFTER SOME TIME WE WILL UPLOAD...', JSON.stringify(logsQueue));

      await uploadLogs(logsQueue);

      logMessage('DONE...', JSON.stringify(logsQueue));
      break;
    } else if (event.eventType === EventType.INVOKE) {
      await uploadLogs(logsQueue); // upload queued logs, during invoke event
      const logLength = logsQueue.length;

      // Test runtime API
      // const eventData = await getEventData();
      // const responseData = await getResponse(eventData.requestId);
      // logMessage('Runtime event data: ', JSON.stringify(eventData, null, 2));
      // logMessage('Response data: ', JSON.stringify(responseData, null, 2));

      // Give lambda a little extra time to post some more logs
      const waitForMe = () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, 50);
        });
      await waitForMe();
      if (logLength < logsQueue.length) {
        await uploadLogs(logsQueue);
      }
    } else {
      throw new Error(`unknown event: ${event.eventType}`);
    }
  }
})();
