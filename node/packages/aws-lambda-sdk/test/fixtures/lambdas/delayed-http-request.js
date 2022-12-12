'use strict';

const http = require('http');

const TEST_SERVER_PORT = 3177;

http
  .createServer((request, response) => {
    request.on('data', () => {});
    request.on('end', () => {
      response.writeHead(200, {});
      response.end('"ok"');
    });
  })
  .listen(TEST_SERVER_PORT);

const url = `http://localhost:${TEST_SERVER_PORT}/?foo=bar`;

module.exports.handler = async () => {
  setTimeout(() => {
    http
      .request(url, { headers: { someHeader: 'bar' } }, (response) => {
        let body = '';
        response.on('data', (data) => {
          body += data;
        });
        response.on('end', () => {
          console.log('Body', body);
        });
      })
      .end();
  }, 50).unref();
  return 'ok';
};
