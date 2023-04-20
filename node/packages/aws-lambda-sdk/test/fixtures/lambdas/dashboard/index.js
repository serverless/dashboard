'use strict';

const http = require('http');

let server;

const TEST_SERVER_PORT = 3177;
const initializeServer = () => {
  server = http
    .createServer((request, response) => {
      request.on('data', () => {});
      request.on('end', () => {
        response.writeHead(200, {});
        response.end('"ok"');
      });
    })
    .listen(TEST_SERVER_PORT);
};

const sendRequest = (path) => {
  return new Promise((resolve) =>
    http
      .request(`http://localhost:${TEST_SERVER_PORT}/${path}`, { method: 'POST' }, (response) => {
        response.on('data', () => {});
        response.on('end', resolve);
      })
      .end('test')
  );
};

const serverless = require('serverless-http');
const express = require('express');
const sdk = require('@serverless/sdk');

const app = express();
app.use(express.json());

app.get('/foo', (req, res) => {
  sdk.captureError(new Error('Captured error'), {
    tags: { 'user.tag': 'example' },
  });
  sdk.setTag('user.tag', 'example:tag');

  setTimeout(() => {
    Promise.all([sendRequest('in-1'), sendRequest('in-2')]).then(() => res.send('"ok"'));
  }, 200);
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

const expressHandler = serverless(app);

module.exports.handler = async (event, context, callback) => {
  initializeServer();
  setTimeout(() => {
    sendRequest('out-1');
    sendRequest('out-2');
  }, 100);
  try {
    await expressHandler(
      {
        version: '2.0',
        routeKey: 'GET /foo',
        rawPath: '/foo',
        rawQueryString: 'lone=value&multi=one,stillone&multi=two',
        headers: {
          'content-length': '385',
          'content-type':
            'multipart/form-data; boundary=--------------------------419073009317249310175915',
          'multi': 'one,stillone,two',
        },
        queryStringParameters: {
          lone: 'value',
          multi: 'one,stillone,two',
        },
        requestContext: {
          accountId: '205994128558',
          apiId: 'xxx',
          domainName: 'xxx.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'xx',
          http: {
            method: 'GET',
            path: '/foo',
            protocol: 'HTTP/1.1',
            sourceIp: '80.55.87.22',
            userAgent: 'PostmanRuntime/7.29.0',
          },
          requestId: 'XyGnwhe0oAMEJJw=',
          routeKey: 'GET /foo',
          stage: '$default',
          time: '01/Sep/2022:13:46:51 +0000',
          timeEpoch: 1662040011065,
        },
        body: 'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00MTkwNzMwMDkzMTcyNDkzMTAxNzU5MTUNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0ibXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tNDE5MDczMDA5MzE3MjQ5MzEwMTc1OTE1LS0NCg==',
        isBase64Encoded: true,
      },
      context,
      callback
    );
    return {
      consoleSdk: {
        name: sdk.name,
        version: sdk.version,
        rootSpanName: sdk.traceSpans.root.name,
      },
      isDashboardSdkAvailable: typeof context.serverlessSdk.getDashboardUrl === 'function',
    };
  } finally {
    server.close();
  }
};
