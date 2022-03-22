'use strict';

const http = require('http');
const { logMessage } = require('../../lib/helper');
const { SAVE_FILE } = require('../helper');
const { writeFileSync } = require('fs');

function listen({ port, address, logsQueue, callback, liveLogCallback, liveLogData }) {
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
  });

  server.listen(port, address);
  return { logsQueue, server };
}

module.exports = {
  listen,
};
