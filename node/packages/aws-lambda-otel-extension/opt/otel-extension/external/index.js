#!/usr/bin/env node

'use strict';

const { writeFileSync, existsSync, readFileSync } = require('fs');
const get = require('lodash.get');
const { register, next } = require('./lambda-apis/extensions-api');
const setupLogListenerServer = require('./setup-log-listener-server');
const initializeTelemetryListener = require('./initialize-telemetry-listener');
const reportOtelData = require('./report-otel-data');
const { logMessage, OTEL_SERVER_PORT } = require('../lib/helper');
const { EventType, SAVE_FILE, SENT_FILE, stripResponseBlobData } = require('./helper');
const { createMetricsPayload, createTracePayload, createLogPayload } = require('./otel-payloads');

function handleShutdown() {
  process.exit(0);
}

let sentRequests = [];
const sentResponseEvents = [];
let logsQueue = [];
const mainEventData = {
  data: {},
};
const liveLogData = {
  logs: [],
};

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
  let currentRequestId;

  const groupReports = async (reportLists) => {
    logMessage('LOGS: ', JSON.stringify(reportLists));

    const result = {};
    for (const reportList of reportLists) {
      for (const reportData of reportList) {
        // Two kind of events land here
        // 1. telemetryData as send form lambda by internal instrumentation on lambda response
        // 2. "platform.report" event as coming directly from AWS Lambda API
        if (reportData.recordType !== 'telemetryData') {
          // "platform.report" event
          reportData.requestId = reportData.record.requestId;
        }

        const { requestId } = reportData;
        if (!result[requestId]) result[requestId] = {};

        if (reportData.recordType === 'telemetryData') {
          reportData.origin = 'sls-layer';
          result[requestId].layer = reportData;
        } else {
          // "platform.report" event
          result[requestId][reportData.type] = reportData;
        }
      }
    }
    return result;
  };

  // function for processing collected logs
  async function sendReports(reportLists, focusIds = []) {
    const currentIndex = reportLists.length;
    const focusIdsSet = new Set(focusIds);
    const groupedByRequestId = await groupReports(reportLists);

    const ready = {};
    const notReady = {};
    const responseEvents = {};
    for (const [requestId, data] of Object.entries(groupedByRequestId)) {
      const report = data['platform.report'];
      const { function: fun, traces, responseEventPayload } = get(data.layer, 'record') || {};
      if (responseEventPayload) responseEvents[requestId] = responseEventPayload;
      if (fun && traces) {
        if (focusIdsSet.size && !focusIdsSet.has(requestId)) continue;
        // report is not required so we can send duration async
        ready[requestId] = {
          'platform.report': report,
          'function': { record: fun },
          'traces': { record: traces },
        };
        continue;
      }
      notReady[requestId] = data;
    }

    logMessage('READY: ', JSON.stringify(ready));
    logMessage('NOT READY: ', JSON.stringify(notReady));

    logMessage('Sent Requests: ', JSON.stringify(sentRequests));
    for (const { requestId, isTraceSent, isReportSent } of sentRequests) {
      if (ready[requestId] && isTraceSent && isReportSent) delete ready[requestId];
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

    for (const responseEvent of Object.values(responseEvents)) {
      if (!sentResponseEvents.includes(responseEvent.executionId)) {
        try {
          // Strip response blob data before sending it to the req/res endpoint
          await reportOtelData.requestResponse(stripResponseBlobData(responseEvent));
          sentResponseEvents.push(responseEvent.executionId);
        } catch (error) {
          logMessage('Response data send Error:', error);
        }
      }
    }

    // Save request ids so we don't send them twice
    const justSentRequestIds = new Set(Object.keys(ready));
    for (const sentRequest of sentRequests) {
      const { requestId } = sentRequest;
      if (!justSentRequestIds.has(requestId)) continue;
      sentRequest.isTraceSent = Boolean(ready[requestId].function && ready[requestId].traces);
      sentRequest.isReportSent = Boolean(ready[requestId]['platform.report']);
    }
    const sentRequestIds = new Set(sentRequests.map(({ requestId }) => requestId));
    for (const requestId of justSentRequestIds) {
      if (sentRequestIds.has(requestId)) continue;
      sentRequests.push({
        requestId,
        isTraceSent: Boolean(ready[requestId].function && ready[requestId].traces),
        isReportSent: Boolean(ready[requestId]['platform.report']),
      });
    }

    // Only remove logs that were marked as ready or have not sent a report yet
    const incompleteRequestIds = new Set([
      ...Object.keys(notReady),
      ...sentRequests.filter(({ report }) => !report).map(({ requestId }) => requestId),
    ]);
    logMessage('Incomplete Request Ids: ', JSON.stringify(Array.from(incompleteRequestIds)));
    reportLists.forEach((subList, index) => {
      if (index < currentIndex) {
        const saveList = subList.filter((log) => {
          if (log.recordType === 'telemetryData') {
            return (
              incompleteRequestIds.has(log.requestId) ||
              (focusIdsSet.size && !focusIdsSet.has(log.requestId))
            );
          }
          return (
            incompleteRequestIds.has(log.record.requestId) ||
            (focusIdsSet.size && !focusIdsSet.has(log.record.requestId))
          );
        });
        subList.splice(0);
        subList.push(...saveList);
      }
    });
    logMessage('Remaining logs queue: ', JSON.stringify(reportLists));
  }

  const sendFunctionLogs = async () => {
    // Check that we have logs in the queue
    // Check that we have a currentRequestId identified
    // Check that we have event data associated with the currentRequestId
    logMessage(
      'Post Live Log Check',
      liveLogData.logs.length,
      currentRequestId,
      JSON.stringify(mainEventData.data)
    );
    if (
      liveLogData.logs.length > 0 &&
      currentRequestId &&
      Object.keys(mainEventData.data).length > 0 &&
      Object.keys(mainEventData.data[currentRequestId] || {}).length > 0
    ) {
      const sendData = [...liveLogData.logs];
      liveLogData.logs = [];
      try {
        await reportOtelData.logs(createLogPayload(mainEventData.data[currentRequestId], sendData));
      } catch (error) {
        logMessage('Failed to send logs', error);
      }
    }
  };

  process.on('SIGINT', async () => {
    await sendReports(logsQueue);
    handleShutdown('SIGINT');
  });
  process.on('SIGTERM', async () => {
    await sendReports(logsQueue);
    handleShutdown('SIGINT');
  });

  const { server: otelServer } = initializeTelemetryListener({
    logsQueue,
    port: OTEL_SERVER_PORT,
    mainEventData,
    liveLogCallback: sendFunctionLogs,
    callback: async (...args) => {
      await sendReports(...args);
      receivedData = true;
    },
    requestResponseCallback: async (data) => {
      await reportOtelData.requestResponse(data);
    },
  });

  const server = await setupLogListenerServer({
    extensionIdentifier: extensionId,
    logsQueue,
    liveLogData,
    liveLogCallback: sendFunctionLogs,
    callback: sendReports,
  });

  // execute extensions logic
  // eslint-disable-next-line no-constant-condition
  while (true) {
    logMessage('Waiting for next event');
    const event = await next(extensionId);
    if (event && event.requestId) {
      currentRequestId = event.requestId;
    }
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

      await sendReports(logsQueue, []);

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
