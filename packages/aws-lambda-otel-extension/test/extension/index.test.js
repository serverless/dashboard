'use strict';

const { expect } = require('chai');
const { EventEmitter } = require('events');
const evilDns = require('evil-dns');
const log = require('log').get('test');
const requireUncached = require('ncjsm/require-uncached');
const overwriteStdoutWrite = require('process-utils/override-stdout-write');
const getExtensionServerMock = require('./utils/get-extension-server-mock');
const normalizeOtelAttributes = require('./utils/normalize-otel-attributes');

const port = 9001;

describe('extension', function () {
  this.timeout(10000);
  before(() => {
    evilDns.add('sandbox', '127.0.0.1');
    process.env.AWS_LAMBDA_RUNTIME_API = `127.0.0.1:${port}`;
    process.env.SLS_OTEL_REPORT_TYPE = 'json';
  });

  it('should handle plain success invocation', async () => {
    const emitter = new EventEmitter();
    const { server, listenerEmitter } = getExtensionServerMock(emitter);

    server.listen(port);
    let stdoutData = '';
    const extensionProcess = overwriteStdoutWrite(
      (data) => (stdoutData += data),
      async () => requireUncached(() => require('../../opt/otel-extension'))
    );

    await new Promise((resolve) => listenerEmitter.once('listener', resolve));
    emitter.emit('event', { eventType: 'INVOKE' });

    emitter.emit('logs', [
      {
        time: '2022-02-14T15:31:24.674Z',
        type: 'platform.start',
        record: {
          requestId: 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0',
          version: '$LATEST',
        },
      },
      {
        time: '2022-02-14T15:31:24.676Z',
        type: 'platform.extension',
        record: {
          name: 'otel-extension',
          state: 'Ready',
          events: ['INVOKE', 'SHUTDOWN'],
        },
      },
    ]);
    // Emit init logs
    await new Promise((resolve) => listenerEmitter.once('listener', resolve));
    emitter.emit('event', { eventType: 'SHUTDOWN' });
    emitter.emit('logs', [
      {
        time: '2022-02-14T15:31:26.712Z',
        type: 'function',
        record:
          '2022-02-14T13:01:30.307Z	bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0	INFO	SERVERLESS_ENTERPRISE {"c":true,"b":"H4sIAAAAAAAAA+1VXW/bNhT9K4Owx0omqW8VARa0HhAsCwrbKwoUhXFFXqVaJdIjKc9Zkf8+UnJsx3WxPOxpGPx27+HRued++GvQDJLbVsmg+hoY1NuWYyShx6AKLBobKotdiDuL0jhUaAbO0Zjglct22KPVD5ERX6IO5P0A9/6ZVAJ//xaxJ1UblIfEN6AtajOKCWhEIuryvFODiDZabVuB2iXgT3MMd2AbpfspvO6grwUcshrvJ67BhAiuFs/XAJiXFTgij4J+vL1ezZcrl3BiPCTatCKoaHEM4A75YKHuDhbOtqBn3ptZ3cqZd+bkPVd9D1I8wfQgbdvjrJUCd9Ho4Bly3bXyMusP32NwLzeDxTeDsaq/1r4Q0LJyblWTW9XBnKosWUwpyUieltXTXFT/YNIedvcSR/diFpf68pSbSpgaGk0So2miIppEtIjoeVU/7yW8v9CqPfBX7JV+WLZ/eWLKCpfBrZvDieDDSgPHG9+IhVL2ioYZI5AyyEOaQ55mjFJOiqxmRcJYIiAWr9+Bdu+vWJ3HApuSZhwha5LXS+g3HYorcq7yVt0vrUbo904xwtiMsBlNZh/3ej9BWfAkiUmDSZM0aQkEayLijIjSaYjFOedcbq81/+zYdlnyVNPqYeP45dB1z4pc4B+Da85YZd0UNW9SFjYNScOkiUlYpJyHBRR1TYHlgCf6b8wb1YmlBW2DyuoBn/G+VT208vsfXLluzjfKq5wgxhOtxh7TLEmKJM6Kgia5eyzF83hJWEpdXGvlNr+Bzrhvf7Z248TYwcly61QxQh7dGfEtNP6IaTRq0ByXG5Au8PEY+f/E/QdPnOt9K40by96ZDv4O3La1Brfth/5fzvtp2Jfw07OOzc7wofM9PPh+dItEzF8jJ8AcPmUPlyTNKcckY0DdbGOJKU+LTKRJztIySak3yT8bsaKJgYumrktWCEj8eXpR+760o7XLd9d3619u7t6ul/PF+/kiOFmy32S7uwOp/LidbluW0oz4Jd8v3QXcuH15SeIRB9bqtnbnYFyycXCmWZjMeOFJGd/5mfp3/4WmZQDOlRuPif+UJpiuRmTGs7HmJ3djCrmSHh8/jb/HvwF/juUcEwkAAA==","origin":"sls-layer"}',
      },
      {
        time: '2022-02-14T15:31:26.713Z',
        type: 'platform.runtimeDone',
        record: {
          requestId: 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0',
          status: 'success',
        },
      },
      {
        time: '2022-02-14T15:31:26.742Z',
        type: 'platform.end',
        record: {
          requestId: 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0',
        },
      },
      {
        time: '2022-02-14T15:31:26.742Z',
        type: 'platform.report',
        record: {
          requestId: 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0',
          metrics: {
            durationMs: 2064.05,
            billedDurationMs: 2065,
            memorySizeMB: 128,
            maxMemoryUsedMB: 67,
            initDurationMs: 238.12,
          },
        },
      },
    ]);

    await extensionProcess;
    server.close();
    log.debug('report string %s', stdoutData);
    const [[metricsReport], [tracesReport]] = stdoutData
      .split('\n')
      .filter(Boolean)
      .map((string) => JSON.parse(string));

    const resourceMetrics = normalizeOtelAttributes(
      metricsReport.resourceMetrics[0].resource.attributes
    );
    expect(resourceMetrics['faas.name']).to.equal('test-otel-extension-success');
    const resourceSpans = normalizeOtelAttributes(
      tracesReport.resourceSpans[0].resource.attributes
    );
    expect(resourceSpans['faas.name']).to.equal('test-otel-extension-success');
  });
});
