'use strict';

const http = require('http');
const { logMessage } = require('../../lib/helper');
const { SAVE_FILE } = require('../helper');
const { writeFileSync } = require('fs');
const reportOtelData = require('./../report-otel-data');
const { parseEventData } = require('../otel-payloads');

// eslint-disable-next-line prefer-const
let liveLogData = [];
// eslint-disable-next-line prefer-const
let mainEventData = {};

function listen({ port, address, logsQueue, callback }) {
  // init HTTP server for the Logs API subscription
  const server = http.createServer((request, response) => {
    if (request.method === 'POST') {
      let body = '';
      request.on('data', (data) => {
        body += data;
      });
      request.on('end', async () => {
        try {
          const batch = JSON.parse(body);
          if (address) {
            logMessage('Current data before write: ', JSON.stringify(logsQueue));
          } else {
            logMessage('BATCH FROM CUSTOM HTTP SERVER: ', body, JSON.stringify(batch));
          }
          if (batch.length > 0) {
            const logBatch = batch.filter((log) => {
              logMessage('Filters: ', JSON.stringify(log));
              if (log.type === 'platform.report') {
                return true;
              } else if (
                log.type === 'function' &&
                typeof log.record === 'string' &&
                log.record.includes('⚡.')
              ) {
                return true;
              } else if (log.type === 'function' && (log.record || {}).recordType === 'eventData') {
                mainEventData = log.record.eventData;
              }
              return false;
            });
            logsQueue.push(logBatch);
            writeFileSync(SAVE_FILE, JSON.stringify(logsQueue));

            if (callback && logBatch.length > 0) {
              const reportIds = logBatch.map(
                (log) => log.record.requestId || log.record.split('\t')[1]
              );
              callback(logsQueue, reportIds);
            }
          }
          if (!address) {
            logMessage('FROM CUSTOM HTTP SERVER: ', JSON.stringify(logsQueue));
          }

          const reportedLogs = batch.filter((log) => {
            if (/platform/i.test(log.type)) {
              return false;
            } else if (
              log.type === 'function' &&
              typeof log.record === 'string' &&
              log.record.includes('⚡.')
            ) {
              return false;
            } else if (
              log.type === 'function' &&
              typeof log.record === 'object' &&
              log.record.recordType === 'eventData' &&
              log.record.eventData
            ) {
              return false;
            }
            return true;
          });

          liveLogData.push(...(reportedLogs || []));

          if (liveLogData.length > 0 && Object.keys(mainEventData).length > 0) {
            const sendData = [...liveLogData];
            liveLogData = [];
            await reportOtelData
              .logs({
                mainEventData: parseEventData(mainEventData),
                liveLogData: sendData,
              })
              .catch((error) => {
                logMessage('Failed to send logs', error);
              });
          }
        } catch (e) {
          logMessage('failed to parse logs', e);
        }
        response.writeHead(200, {});
        response.end('OK');
      });
    } else {
      response.writeHead(200, {});
      response.end('OK');
    }
  });

  server.listen(port, address);
  return { logsQueue, server };
}

module.exports = {
  listen,
};
