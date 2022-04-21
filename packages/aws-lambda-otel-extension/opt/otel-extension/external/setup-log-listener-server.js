'use strict';

const http = require('http');

const fetch = require('node-fetch');
const { logMessage } = require('../lib/helper');
const { SAVE_FILE } = require('./helper');
const { writeFileSync } = require('fs');

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-08-15/logs`;

module.exports = async ({
  extensionIdentifier,
  subscriptionBody,
  port,
  address,
  logsQueue,
  liveLogCallback,
  liveLogData,
  callback,
}) => {
  // Setup a logs listener server
  const server = http
    .createServer((request, response) => {
      if (request.method === 'POST') {
        let body = '';
        request.on('data', (data) => {
          body += data;
        });
        request.on('end', async () => {
          try {
            const batch = JSON.parse(body);
            logMessage('Current data before write: ', JSON.stringify(logsQueue));

            if (batch.length > 0) {
              const logBatch = batch.filter((log) => log.type === 'platform.report');
              logsQueue.push(logBatch);
              writeFileSync(SAVE_FILE, JSON.stringify(logsQueue));

              if (callback && logBatch.length > 0) {
                const reportIds = logBatch.map(
                  (log) => log.record.requestId || log.record.split('\t')[1]
                );
                callback(logsQueue, reportIds);
              }
            }

            const reportedLogs = batch.filter((log) => !log.type.startsWith('platform.'));

            liveLogData.logs.push(...(reportedLogs || []));

            await liveLogCallback();
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
    })
    .listen(port, address);

  // Subscribe to logs

  const res = await fetch(baseUrl, {
    method: 'put',
    body: JSON.stringify(subscriptionBody),
    headers: {
      'Content-Type': 'application/json',
      'Lambda-Extension-Identifier': extensionIdentifier,
    },
  });

  switch (res.status) {
    case 200:
      break;
    case 202:
      console.warn(
        'WARNING!!! Logs API is not supported! Is this extension running in a local sandbox?'
      );
      break;
    default:
      console.error('logs subscription failed: ', await res.text());
      break;
  }

  return server;
};
