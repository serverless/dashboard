import http from 'http';
import https from 'https';

const TEST_SERVER_PORT = 3177;

const getServer = () =>
  http
    .createServer((request, response) => {
      request.on('data', () => {});
      request.on('end', () => {
        response.writeHead(200, {});
        response.end('"ok"');
      });
    })
    .listen(TEST_SERVER_PORT);

export const handler = (event, context, callback) => {
  let url = event.url;
  let server;
  if (!url) {
    server = getServer();
    url = `http://localhost:${TEST_SERVER_PORT}/?foo=bar`;
  }
  const request = url.startsWith('https') ? https.request : http.request;
  request(url, { headers: { someHeader: 'bar' } }, (response) => {
    let body = '';
    response.on('data', (data) => {
      body += data;
    });
    response.on('end', () => {
      if (server) server.close();
      callback(null, JSON.parse(body));
    });
  })
    .end()
    .on('error', (error) => {
      if (server) server.close();
      callback(error);
    });
};
