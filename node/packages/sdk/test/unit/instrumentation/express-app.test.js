'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('instrumentation/expres-app.js', () => {
  describe('Basic', () => {
    let instrumentExpressApp;
    let serverless;
    let express;
    let serverlessSdk;
    let uninstall;
    before(() => {
      requireUncached(() => {
        serverlessSdk = require('../../../');
        instrumentExpressApp = require('../../../instrumentation/express-app');
        serverless = require('serverless-http');
        express = require('express');
      });
    });
    after(() => {
      if (uninstall) uninstall();
      delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
    });

    it('should instrument express app', async () => {
      const spans = [];
      serverlessSdk._eventEmitter.on('trace-span-close', (traceSpan) => spans.push(traceSpan));
      const app = express();
      // Sanity check
      uninstall = instrumentExpressApp.install(app);

      app.use(express.json());

      app.get('/', (req, res) => {
        res.send('"root"');
      });

      app.get('/foo', (req, res) => {
        res.send('"foobra"');
      });

      app.post('/test', (req, res) => {
        res.send('"ok"');
      });

      app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

      const handler = serverless(app);
      await handler({
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
        body:
          'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNw' +
          'b3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t' +
          'LS00MTkwNzMwMDkzMTcyNDkzMTAxNzU5MTUNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0i' +
          'bXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0' +
          'OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQot' +
          'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tNDE5MDczMDA5MzE3MjQ5MzEwMTc1OTE1LS0NCg==',
        isBase64Encoded: true,
      });
      const expressSpan = spans.pop();
      const routeSpan = spans.pop();
      const routerSpan = spans[spans.length - 1];

      expect(expressSpan.name).to.equal('express');

      expect(spans.map(({ name }) => name)).to.deep.equal([
        'express.middleware.query',
        'express.middleware.expressinit',
        'express.middleware.jsonparser',
        'express.middleware.router',
      ]);
      for (const middlewareSpan of spans) {
        expect(String(middlewareSpan.parentSpan.id)).to.equal(String(expressSpan.id));
      }
      expect(routeSpan.name).to.equal('express.middleware.route.get.anonymous');
      expect(String(routeSpan.parentSpan.id)).to.equal(String(routerSpan.id));

      expect(serverlessSdk.traceSpans.root.tags.get('aws.lambda.http_router.path'), '/foo');
    });
  });

  describe('Nested routes', () => {
    let instrumentExpressApp;
    let serverless;
    let express;
    let serverlessSdk;
    let uninstall;
    before(() => {
      requireUncached(() => {
        serverlessSdk = require('../../../');
        instrumentExpressApp = require('../../../instrumentation/express-app');
        serverless = require('serverless-http');
        express = require('express');
      });
    });
    after(() => {
      if (uninstall) uninstall();
      delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
    });

    it('should instrument express app', async () => {
      const spans = [];
      serverlessSdk._eventEmitter.on('trace-span-close', (traceSpan) => spans.push(traceSpan));
      const app = express();
      // Sanity check
      uninstall = instrumentExpressApp.install(app);

      app.use(express.json());

      const router = new express.Router();
      router.get('/bar', (req, res) => {
        res.send('"foo/bar"');
      });

      app.use('/foo', router);

      app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

      const handler = serverless(app);
      await handler({
        version: '2.0',
        routeKey: 'GET /foo/bar',
        rawPath: '/foo/bar',
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
            path: '/foo/bar',
            protocol: 'HTTP/1.1',
            sourceIp: '80.55.87.22',
            userAgent: 'PostmanRuntime/7.29.0',
          },
          requestId: 'XyGnwhe0oAMEJJw=',
          routeKey: 'GET /foo/bar',
          stage: '$default',
          time: '01/Sep/2022:13:46:51 +0000',
          timeEpoch: 1662040011065,
        },
        body:
          'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNw' +
          'b3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0t' +
          'LS00MTkwNzMwMDkzMTcyNDkzMTAxNzU5MTUNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0i' +
          'bXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0' +
          'OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQot' +
          'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tNDE5MDczMDA5MzE3MjQ5MzEwMTc1OTE1LS0NCg==',
        isBase64Encoded: true,
      });
      const expressSpan = spans.pop();
      const routeSpan = spans.pop();
      const routerSpan = spans.pop();
      const topRouterSpan = spans[spans.length - 1];

      expect(expressSpan.name).to.equal('express');

      expect(spans.map(({ name }) => name)).to.deep.equal([
        'express.middleware.query',
        'express.middleware.expressinit',
        'express.middleware.jsonparser',
        'express.middleware.router.foo',
      ]);
      for (const middlewareSpan of spans) {
        expect(String(middlewareSpan.parentSpan.id)).to.equal(String(expressSpan.id));
      }
      expect(routerSpan.name).to.equal('express.middleware.router');
      expect(String(routerSpan.parentSpan.id)).to.equal(String(topRouterSpan.id));
      expect(routeSpan.name).to.equal('express.middleware.route.get.anonymous');
      expect(String(routeSpan.parentSpan.id)).to.equal(String(routerSpan.id));

      expect(serverlessSdk.traceSpans.root.tags.get('aws.lambda.http_router.path'), '/foo/bar');
    });
  });
});
