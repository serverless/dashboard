'use strict';

const { expect } = require('chai');

const { EventEmitter } = require('events');
const log = require('log').get('test:lambda-runtime-server');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

module.exports = (emitter) => {
  const lambdaExtensionIdentifier = uuidv4();

  let logsUrl;

  const listenerEmitter = new EventEmitter();

  const sendLogs = (headers, body) => {
    const method = 'POST';
    log.get('send-logs')('%s %o %o', method, headers, body);
    return fetch(logsUrl, {
      method: 'post',
      body: JSON.stringify(body),
      headers,
    });
  };
  emitter.on('logs', (data) => {
    for (const logEvent of data) {
      if (!logEvent.time) logEvent.time = new Date().toISOString();
    }
    sendLogs({ 'Content-Type': 'application/json' }, data);
  });

  return {
    listenerEmitter,
    server: http.createServer((request, response) => {
      log.get('request').debug('%s %s %o', request.method, request.url, request.headers);
      if (request.url.endsWith('/register') && request.method === 'POST') {
        let body = '';
        request.on('data', (data) => (body += data));
        request.on('end', () => {
          const data = JSON.parse(body);
          expect(data).to.deep.equal({ events: ['INVOKE', 'SHUTDOWN'] });
          const statusCode = 200;
          const responseBody = {
            functionName: 'test-extension',
            functionVersion: '$LATEST',
            handler: 'index.handler',
          };
          const responseBodyString = JSON.stringify(responseBody);
          const headers = {
            'content-type': 'application/json',
            'lambda-extension-identifier': lambdaExtensionIdentifier,
            'date': 'Fri, 11 Feb 2022 16:49:15 GMT',
            'content-length': Buffer.byteLength(responseBodyString),
            'connection': 'close',
          };

          log.get('response')('%d %o %o', statusCode, headers, responseBody);
          response.writeHead(statusCode, headers);
          response.end(responseBodyString);
        });
      } else if (request.url.endsWith('/next') && request.method === 'GET') {
        expect(request.headers['lambda-extension-identifier']).to.equal(lambdaExtensionIdentifier);
        request.on('data', () => {});
        request.on('end', () => {
          log.get('listener')('emit next ready');
          listenerEmitter.emit('next');
          emitter.once('event', (data) => {
            const statusCode = 200;
            const responseBody = data;
            const responseBodyString = JSON.stringify(responseBody);
            const headers = {
              'content-type': 'application/json',
              'lambda-extension-event-identifier': '5fe7df16-77d6-47db-8435-80bff2871200',
              'date': 'Mon, 14 Feb 2022 15:29:54 GMT',
              'connection': 'close',
              'content-length': Buffer.byteLength(responseBodyString),
            };

            log.get('response')('%d %o %o', statusCode, headers, responseBody);
            response.writeHead(statusCode, headers);
            response.end(responseBodyString);
          });
        });
      } else if (request.url.endsWith('/logs') && request.method === 'PUT') {
        let body = '';
        request.on('data', (data) => (body += data));
        request.on('end', () => {
          const data = JSON.parse(body);
          expect(data.types).to.deep.equal(['platform', 'function']);
          expect(data.destination).to.have.property('URI');
          logsUrl = data.destination.URI;
          log.debug('Logs server url %s', logsUrl);
          const statusCode = 200;
          const responseBody = 'OK';
          const headers = {
            'content-type': 'text/plain; charset=utf-8',
            'connection': 'close',
            'content-length': Buffer.byteLength(responseBody),
          };

          log.get('response')('%d %o %s', statusCode, headers, responseBody);
          response.writeHead(statusCode, headers);
          response.end(responseBody);
          sendLogs({ 'Content-Type': 'application/json' }, [
            {
              time: new Date().toISOString(),
              type: 'platform.logsSubscription',
              record: {
                name: 'otel-extension',
                state: 'Subscribed',
                types: data.types,
              },
            },
          ])
            .then((res) => res.text())
            .then(() => {
              log.get('listener')('emit logs subscription ready');
              listenerEmitter.emit('logsSubscription', data);
            });
        });
      } else {
        throw new Error('Unrecognized request');
      }
    }),
  };
};
