'use strict';

const http = require('http');
const { readFileSync, existsSync } = require('fs');
const { logMessage, SAVE_FILE } = require('./../helper');

function listen(address, port) {
  let logsQueue = [];

  if (existsSync(SAVE_FILE)) {
    try {
      logsQueue = JSON.parse(readFileSync(SAVE_FILE, { encoding: 'utf-8' }));
    } catch (error) {
      logMessage('Failed to parse logs queue file');
    }
  }

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
          logMessage('Current data before write: ', JSON.stringify(logsQueue));
          if (batch.length > 0) {
            logsQueue.push(
              batch.filter((log) => {
                if (log.type === 'platform.report') {
                  return true;
                } else if (log.type === 'function' && log.record.includes('⚡.')) {
                  return true;
                }
                return false;
              })
            );
          }
        } catch (e) {
          console.log('failed to parse logs');
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
