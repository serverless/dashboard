'use strict';

const http = require('http');
const { writeFileSync } = require('fs');
const { logMessage } = require('../lib/helper');
const { SAVE_FILE } = require('./helper');

const host = 'sandbox';
const port = 4243;

module.exports = async ({
  extensionIdentifier,
  logsQueue,
  liveLogCallback,
  liveLogData,
  callback,
}) => {
  // Setup a logs listener server
  const server = http
    .createServer((request, response) => {
      if (request.method !== 'POST') throw new Error('Unexpected request');
      let body = '';
      request.on('data', (data) => {
        body += data;
      });
      request.on('end', () => {
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

        response.writeHead(200, {});
        response.end('OK');

        liveLogCallback();
      });
    })
    .listen(port, host);

  // Subscribe to logs
  try {
    await new Promise((resolve, reject) => {
      const putData = JSON.stringify({
        destination: { protocol: 'HTTP', URI: `http://${host}:${port}` },
        types: ['platform', 'function'],
        buffering: { timeoutMs: 25, maxBytes: 262144, maxItems: 1000 },
        schemaVersion: '2021-03-18',
      });
      const request = http.request(
        `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-08-15/logs`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Lambda-Extension-Identifier': extensionIdentifier,
            'Content-Length': Buffer.byteLength(putData),
          },
        },
        (response) => {
          response.setEncoding('utf8');
          let result = '';
          response.on('data', (chunk) => {
            result += String(chunk);
          });
          response.on('end', () => {
            if (response.statusCode === 200) {
              resolve();
            } else {
              // TODO: Report propery extension crash
              reject(
                new Error(
                  `Unexpecxted logs subscribe response status code: ${response.statusCode}, text: ${result}`
                )
              );
            }
          });
        }
      );
      request.on('error', reject);
      request.write(putData);
      request.end();
    });
  } catch (error) {
    server.close();
    throw error;
  }

  return server;
};
