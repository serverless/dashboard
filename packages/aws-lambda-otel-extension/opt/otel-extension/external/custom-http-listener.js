'use strict';

const http = require('http');
const { logMessage } = require('../lib/helper');
const { SAVE_FILE } = require('./helper');
const { writeFileSync } = require('fs');

// mainEventData is assigned in this file and then used in the parent file
// eslint-disable-next-line no-unused-vars
function customListen({ port, logsQueue, mainEventData, callback }) {
  // init HTTP server for the Logs API subscription
  const server = http.createServer((request, response) => {
    if (request.method === 'POST') {
      let body = '';
      request.on('data', (data) => {
        body += data;
      });
      request.on('end', async () => {
        try {
          const data = JSON.parse(body);
          logMessage('BATCH FROM CUSTOM HTTP SERVER: ', body, JSON.stringify(data));
          if (data && data.recordType === 'eventData') {
            mainEventData = data.record;
          } else if (data && data.recordType === 'telemetryData') {
            logsQueue.push([data]);
            writeFileSync(SAVE_FILE, JSON.stringify(logsQueue));
          }

          if (callback && data.recordType === 'telemetryData') {
            const reportIds = [data.record.split('\t')[1]];
            callback(logsQueue, reportIds);
          }
          logMessage('FROM CUSTOM HTTP SERVER: ', JSON.stringify(logsQueue));
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

  server.listen(port);
  return { logsQueue, server };
}

module.exports = {
  customListen,
};
