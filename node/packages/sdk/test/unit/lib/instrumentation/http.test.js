'use strict';

const http = require('http');
const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

const TEST_SERVER_PORT = 3177;

describe('lib/instrumentation/http.js', () => {
  let serverlessSdk;
  let server;
  let instrumentHttp;
  before(() => {
    requireUncached(() => {
      serverlessSdk = require('../../../../');
      instrumentHttp = require('../../../../lib/instrumentation/http');
      instrumentHttp.install();
      server = http
        .createServer((request, response) => {
          request.on('data', () => {});
          request.on('end', () => {
            response.writeHead(200, {});
            response.end('"ok"');
          });
        })
        .listen(TEST_SERVER_PORT);
      serverlessSdk._createTraceSpan('root');
    });
  });
  after(() => {
    instrumentHttp.uninstall();
    server.close();
    serverlessSdk.traceSpans.root.close();
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });

  it('should instrument HTTP', async () => {
    let httpRequestSpan;
    serverlessSdk._eventEmitter.once(
      'trace-span-close',
      (traceSpan) => (httpRequestSpan = traceSpan)
    );
    await new Promise((resolve, reject) => {
      http
        .request(
          `http://localhost:${TEST_SERVER_PORT}/other?foo=bar`,
          { headers: { someHeader: 'bar' } },
          (response) => {
            let body = '';
            response.on('data', (data) => {
              body += data;
            });
            response.on('end', () => {
              resolve(JSON.parse(body));
            });
          }
        )
        .end()
        .on('error', reject);
    });
    expect(httpRequestSpan.name).to.equal('node.http.request');
    const { tags } = httpRequestSpan;
    expect(tags.get('http.method')).to.equal('GET');
    expect(tags.get('http.protocol')).to.equal('HTTP/1.1');
    expect(tags.get('http.host')).to.equal('localhost:3177');
    expect(tags.get('http.path')).to.equal('/other');
    expect(tags.get('http.query_parameter_names')).to.deep.equal(['foo']);
    expect(tags.get('http.request_header_names')).to.deep.equal(['someHeader']);
    expect(tags.get('http.status_code')).to.equal(200);
  });

  it('should read url details from options', async () => {
    let httpRequestSpan;
    serverlessSdk._eventEmitter.once(
      'trace-span-close',
      (traceSpan) => (httpRequestSpan = traceSpan)
    );
    await new Promise((resolve, reject) => {
      http
        .request(
          {
            hostname: 'localhost',
            pathname: '/other',
            port: TEST_SERVER_PORT,
            search: '?foo=bar',
            headers: { someHeader: 'bar' },
          },
          (response) => {
            let body = '';
            response.on('data', (data) => {
              body += data;
            });
            response.on('end', () => {
              resolve(JSON.parse(body));
            });
          }
        )
        .end()
        .on('error', reject);
    });
    expect(httpRequestSpan.name).to.equal('node.http.request');
    const { tags } = httpRequestSpan;
    expect(tags.get('http.method')).to.equal('GET');
    expect(tags.get('http.protocol')).to.equal('HTTP/1.1');
    expect(tags.get('http.host')).to.equal('localhost:3177');
    expect(tags.get('http.path')).to.equal('/other');
    expect(tags.get('http.query_parameter_names')).to.deep.equal(['foo']);
    expect(tags.get('http.request_header_names')).to.deep.equal(['someHeader']);
    expect(tags.get('http.status_code')).to.equal(200);
  });
});
