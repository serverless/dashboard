'use strict';

const http = require('http');
const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

const TEST_SERVER_PORT = 3177;

describe('lib/instrumentation/http.js', () => {
  describe('basic', () => {
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

    it('should support `options.path`', async () => {
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
              path: '/other?foo=bar',
              port: TEST_SERVER_PORT,
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

  describe('response handling detection', () => {
    describe('when response body is read', () => {
      let serverlessSdk;
      let server;
      let instrumentHttp;
      let warningEvent;
      before(() =>
        requireUncached(async () => {
          serverlessSdk = require('../../../../');
          instrumentHttp = require('../../../../lib/instrumentation/http');
          instrumentHttp.install();
          const serverPromise = new Promise((resolve) => {
            server = http
              .createServer((request, response) => {
                request.on('data', () => {});
                request.on('end', () => {
                  response.writeHead(200, {});
                  response.write('test');
                  setTimeout(() => {
                    response.end('"ok"');
                    resolve();
                  }, 50);
                });
              })
              .listen(TEST_SERVER_PORT);
          });
          serverlessSdk._createTraceSpan('root');
          serverlessSdk._eventEmitter.once(
            'captured-event',
            (capturedEvent) => (warningEvent = capturedEvent)
          );
          await new Promise((resolve, reject) => {
            http
              .request(
                `http://localhost:${TEST_SERVER_PORT}/other?foo=bar`,
                { headers: { someHeader: 'bar' } },
                (response) => {
                  resolve();
                  response.on('data', () => {});
                  response.on('end', () => {});
                }
              )
              .end()
              .on('error', reject);
          });
          serverlessSdk.traceSpans.root.close();
          await serverPromise;
        })
      );
      after(() => {
        instrumentHttp.uninstall();
        server.close();
        delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
      });

      it('should detect not closed span', async () => {
        expect(warningEvent.customFingerprint).to.equal('SDK_SPAN_NOT_CLOSED');
      });
    });

    describe('when response body is not read', () => {
      let serverlessSdk;
      let server;
      let instrumentHttp;
      let warningEvent = null;
      before(() =>
        requireUncached(async () => {
          serverlessSdk = require('../../../../');
          instrumentHttp = require('../../../../lib/instrumentation/http');
          instrumentHttp.install();
          const serverPromise = new Promise((resolve) => {
            server = http
              .createServer((request, response) => {
                request.on('data', () => {});
                request.on('end', () => {
                  response.writeHead(200, {});
                  response.write('test');
                  setTimeout(() => {
                    response.end('"ok"');
                    resolve();
                  }, 50);
                });
              })
              .listen(TEST_SERVER_PORT);
          });
          serverlessSdk._createTraceSpan('root');
          serverlessSdk._eventEmitter.once(
            'captured-event',
            (capturedEvent) => (warningEvent = capturedEvent)
          );
          await new Promise((resolve, reject) => {
            http
              .request(
                `http://localhost:${TEST_SERVER_PORT}/other?foo=bar`,
                { headers: { someHeader: 'bar' } },
                () => {
                  resolve();
                }
              )
              .end()
              .on('error', reject);
          });

          serverlessSdk.traceSpans.root.close();
          await serverPromise;
        })
      );
      after(() => {
        instrumentHttp.uninstall();
        server.close();
        delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
      });

      it('should auto-close span', async () => {
        expect(warningEvent).to.equal(null);
      });
    });
  });
});
