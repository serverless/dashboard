'use strict';

const { expect } = require('chai');

const path = require('path');
const { EventEmitter } = require('events');
const spawn = require('child-process-ext/spawn');
const argsParse = require('yargs-parser');
const log = require('log').get('test');
const getExtensionServerMock = require('../../utils/get-extension-server-mock');
const normalizeOtelAttributes = require('../../utils/normalize-otel-attributes');
const { default: fetch } = require('node-fetch');
const ensureNpmDependencies = require('../../../scripts/lib/ensure-npm-dependencies');

const OTEL_SERVER_PORT = 2772;
const port = 9001;
const extensionFilename = path.resolve(
  __dirname,
  '../../../external/otel-extension-external/index.js'
);

const extensionProcessHandler = async (callback) => {
  const emitter = new EventEmitter();
  const { server, listenerEmitter } = getExtensionServerMock(emitter);

  server.listen(port);
  const [extensionCommand, ...extensionArgs] = (() => {
    const customCommand = process.env.SLS_TEST_EXTENSION_COMMAND;
    if (!customCommand) return ['node', extensionFilename];
    return argsParse(customCommand)._;
  })();
  const extensionProcess = spawn(extensionCommand, extensionArgs, {
    env: {
      ...process.env,
      AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
      SLS_TEST_EXTENSION_REPORT_TYPE: 'json',
      SLS_TEST_EXTENSION_REPORT_DESTINATION: 'log',
      SLS_TEST_EXTENSION_HOSTNAME: 'localhost',
    },
  });
  await Promise.all([
    new Promise((resolve) => listenerEmitter.once('next', resolve)),
    new Promise((resolve) => listenerEmitter.once('logsSubscription', resolve)),
  ]);
  try {
    await callback({ emitter, listenerEmitter, extensionProcess });
    return (await extensionProcess).stdoutBuffer.toString();
  } finally {
    extensionProcess.child.kill();
    server.close();
  }
};

describe('external', () => {
  before(async () => {
    ensureNpmDependencies('external/otel-extension-external');
  });

  it('should handle plain success invocation', async () => {
    const requestId = 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0';
    const stdoutData = await extensionProcessHandler(async ({ emitter, listenerEmitter }) => {
      emitter.emit('event', { eventType: 'INVOKE', requestId });

      emitter.emit('logs', [
        {
          time: '2022-02-14T15:31:24.674Z',
          type: 'platform.start',
          record: {
            requestId,
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
      await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
        method: 'post',
        body: JSON.stringify({
          recordType: 'eventData',
          record: {
            eventData: {
              [requestId]: {
                functionName: 'testFunction',
                computeCustomEnvArch: 'x86',
                computeRegion: 'us-east-1',
                eventCustomApiId: requestId,
              },
            },
            span: {
              traceId: 'trace-123',
              spanId: 'span-123',
            },
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
        method: 'post',
        body: JSON.stringify({
          recordType: 'telemetryData',
          requestId,
          record: {
            function: {
              'service.name': 'test-otel-extension-success',
              'telemetry.sdk.language': 'nodejs',
              'telemetry.sdk.name': 'opentelemetry',
              'telemetry.sdk.version': '1.0.1',
              'cloud.provider': 'aws',
              'cloud.platform': 'aws_lambda',
              'cloud.region': 'us-east-1',
              'faas.name': 'test-otel-extension-success',
              'faas.version': '$LATEST',
              'process.pid': 18,
              'process.executable.name': '/var/lang/bin/node',
              'process.command': '/var/runtime/index.js',
              'process.command_line': '/var/lang/bin/node /var/runtime/index.js',
              'computeCustomArn':
                'arn:aws:lambda:us-east-1:992311060759:function:test-otel-extension-success',
              'functionName': 'test-otel-extension-success',
              'computeRegion': 'us-east-1',
              'computeRuntime': 'aws.lambda.nodejs.14.18.1',
              'computeCustomFunctionVersion': '$LATEST',
              'computeMemorySize': '128',
              'eventCustomXTraceId':
                'Root=1-620a52a7-17a756211c086b284224da3d;Parent=2b73def916cea6f4;Sampled=0',
              'computeCustomLogStreamName': '2022/02/14/[$LATEST]a98c4430fe4f4f59a0eb0d360d96213d',
              'computeCustomEnvArch': 'x64',
              'eventType': null,
              'eventCustomRequestId': 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0',
              'computeIsColdStart': true,
              'eventCustomDomain': null,
              'eventCustomRequestTimeEpoch': null,
              'startTime': 1644843688147,
              'endTime': 1644843690251,
              'error': false,
              'httpStatusCode': 200,
            },
            traces: {
              resourceSpans: [
                {
                  resource: {
                    'service.name': 'test-otel-extension-success',
                    'telemetry.sdk.language': 'nodejs',
                    'telemetry.sdk.name': 'opentelemetry',
                    'telemetry.sdk.version': '1.0.1',
                    'cloud.provider': 'aws',
                    'cloud.platform': 'aws_lambda',
                    'cloud.region': 'us-east-1',
                    'faas.name': 'test-otel-extension-success',
                    'faas.version': '$LATEST',
                    'process.pid': 18,
                    'process.executable.name': '/var/lang/bin/node',
                    'process.command': '/var/runtime/index.js',
                    'process.command_line': '/var/lang/bin/node /var/runtime/index.js',
                  },
                  instrumentationLibrarySpans: [
                    {
                      instrumentationLibrary: {
                        name: '@opentelemetry/instrumentation-aws-lambda',
                        version: '0.28.1',
                      },
                      spans: [
                        {
                          traceId: '571ce462a1147e9e5c586d547259451e',
                          spanId: 'df3acdfbb928da48',
                          name: 'test-otel-extension-success',
                          kind: 'SPAN_KIND_SERVER',
                          startTimeUnixNano: '1644843688147651600',
                          endTimeUnixNano: '1644843690251790300',
                          attributes: {
                            'faas.execution': 'bf8bcf52-ff05-4f30-85cc-8a8bb1a27ae0',
                            'faas.id':
                              'arn:aws:lambda:us-east-1:992311060759:function:test-otel-extension-success',
                            'cloud.account.id': '992311060759',
                            'http.status_code': 200,
                          },
                          status: {},
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      emitter.emit('logs', [
        {
          time: '2022-02-14T15:31:26.713Z',
          type: 'function',
          record: `2022-02-14T13:01:30.307Z\t${requestId}\tINFO\tHi mom`,
        },
        {
          time: '2022-02-14T15:31:26.713Z',
          type: 'platform.runtimeDone',
          record: {
            requestId,
            status: 'success',
          },
        },
        {
          time: '2022-02-14T15:31:26.742Z',
          type: 'platform.end',
          record: {
            requestId,
          },
        },
      ]);
      await new Promise((resolve) => listenerEmitter.once('next', resolve));
      emitter.emit('event', { eventType: 'SHUTDOWN', requestId });
      emitter.emit('logs', [
        {
          time: '2022-02-14T15:31:26.742Z',
          type: 'platform.report',
          record: {
            requestId,
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
    });

    log.debug('report string %s', stdoutData);
    const reports = {};
    for (const reportString of stdoutData.split('\n').filter(Boolean)) {
      const reportType = reportString.slice(2, reportString.indexOf(':'));
      if (!reports[reportType]) reports[reportType] = [];
      const jsonString = reportString.slice(reportString.indexOf(':') + 2);
      log.debug('report %s JSON string %s', reportType, jsonString);
      reports[reportType].push(JSON.parse(jsonString));
    }
    log.debug('reports %o', reports);
    const metricsReport = reports.metrics[0];
    const tracesReport = reports.traces[0];
    const logReport = reports.logs[0][0];

    const resourceMetrics = normalizeOtelAttributes(
      metricsReport.resourceMetrics[0].resource.attributes
    );
    expect(resourceMetrics['faas.name']).to.equal('test-otel-extension-success');
    const resourceSpans = normalizeOtelAttributes(
      tracesReport.resourceSpans[0].resource.attributes
    );
    expect(resourceSpans['faas.name']).to.equal('test-otel-extension-success');

    expect(logReport.Body).to.equal(`2022-02-14T13:01:30.307Z\t${requestId}\tINFO\tHi mom`);
    expect(logReport.Attributes['faas.name']).to.equal('testFunction');
    expect(logReport.Resource['faas.arch']).to.equal('x86');
  });
});
