'use strict';

const http = require('http');
const { logMessage, SAVE_FILE } = require('./../helper');
const { writeFileSync } = require('fs');

function listen({ port, address, logsQueue, callback }) {
  // init HTTP server for the Logs API subscription
  const server = http.createServer((request, response) => {
    if (request.method === 'POST') {
      let body = '';
      request.on('data', (data) => {
        body += data;
      });
      request.on('end', () => {
        try {
          const batch = JSON.parse(body);
          if (address) {
            logMessage('Current data before write: ', JSON.stringify(logsQueue));
          } else {
            logMessage('BATCH FROM CUSTOM HTTP SERVER: ', body, JSON.stringify(batch));
          }
          if (batch.length > 0) {
            const logBatch = batch.filter((log) => {
              if (log.type === 'platform.report') {
                return true;
              } else if (log.type === 'function' && log.record.includes('⚡.')) {
                return true;
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
