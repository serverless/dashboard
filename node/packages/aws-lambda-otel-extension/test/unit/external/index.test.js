'use strict';

const { expect } = require('chai');

const path = require('path');
const { EventEmitter } = require('events');
const spawn = require('child-process-ext/spawn');
const argsParse = require('yargs-parser');
const { v4: uuidv4 } = require('uuid');
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

const region = 'us-east-1';
const functionName = 'test';

const extensionProcessHandler = async (options, callback) => {
  const emitter = new EventEmitter();
  const { server, listenerEmitter } = getExtensionServerMock({ ...options, emitter });

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
      AWS_LAMBDA_FUNCTION_VERSION: '$LATEST',
      AWS_REGION: region,
      AWS_LAMBDA_FUNCTION_NAME: functionName,
    },
  });
  await Promise.all([
    new Promise((resolve) => listenerEmitter.once('next', resolve)),
    new Promise((resolve) =>
      listenerEmitter.once('logsSubscription', (body) => {
        resolve();
        emitter.emit('logs', [
          {
            type: 'platform.logsSubscription',
            record: {
              name: 'extension-external.js',
              state: 'Subscribed',
              types: body.types,
            },
          },
        ]);
      })
    ),
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
    const requestId = uuidv4();
    const stdoutData = await extensionProcessHandler(
      { region, functionName },
      async ({ emitter, listenerEmitter }) => {
        emitter.emit('event', { eventType: 'INVOKE', requestId });

        emitter.emit('logs', [
          {
            type: 'platform.extension',
            record: {
              name: 'otel-extension',
              state: 'Ready',
              events: ['INVOKE', 'SHUTDOWN'],
            },
          },
        ]);
        emitter.emit('logs', [
          {
            type: 'platform.start',
            record: {
              requestId,
              version: '$LATEST',
            },
          },
        ]);

        // Emit eventData
        await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
          method: 'post',
          body: JSON.stringify({
            recordType: 'eventData',
            record: {
              eventData: {
                [requestId]: {
                  'service.name': 'unknown_service:/var/lang/bin/node',
                  'telemetry.sdk.language': 'nodejs',
                  'telemetry.sdk.name': 'opentelemetry',
                  'telemetry.sdk.version': '1.3.1',
                  'cloud.provider': 'aws',
                  'cloud.platform': 'aws_lambda',
                  'cloud.region': region,
                  'faas.name': functionName,
                  'faas.version': '$LATEST',
                  'process.pid': 9,
                  'process.executable.name': '/var/lang/bin/node',
                  'process.command': '/var/runtime/index.mjs',
                  'process.command_line': '/var/lang/bin/node /var/runtime/index.mjs',
                  'process.runtime.version': '16.15.0',
                  'process.runtime.name': 'nodejs',
                  'process.runtime.description': 'Node.js',
                  'computeCustomArn': `arn:aws:lambda:us-east-1:205994128558:function:${functionName}`,
                  'functionName': functionName,
                  'computeRuntime': 'aws.lambda.nodejs.16.15.0',
                  'computeCustomFunctionVersion': '$LATEST',
                  'computeMemorySize': '1024',
                  'eventCustomXTraceId':
                    'Root=1-62c86a37-0e8dec11533d5a206de73145;Parent=238558417f028ef4;Sampled=0',
                  'computeCustomLogGroupName': `/aws/lambda/${functionName}`,
                  'computeCustomLogStreamName':
                    '2022/07/08/[$LATEST]b0eac4dc95e74a81b374c629a3a379d2',
                  'computeCustomEnvArch': 'x86',
                  'eventType': null,
                  'eventCustomRequestId': requestId,
                  'computeIsColdStart': true,
                  'eventCustomDomain': null,
                  'eventCustomRequestTimeEpoch': null,
                },
              },
              span: {
                traceId: '016dc9641e4b5d3d25ed6875a0b85536',
                spanId: '32deafa681c39390',
              },
            },
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // Emit telemetry data
        await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
          method: 'post',
          body: JSON.stringify({
            recordType: 'telemetryData',
            requestId,
            record: {
              function: {
                'service.name': 'unknown_service:/var/lang/bin/node',
                'telemetry.sdk.language': 'nodejs',
                'telemetry.sdk.name': 'opentelemetry',
                'telemetry.sdk.version': '1.3.1',
                'cloud.provider': 'aws',
                'cloud.platform': 'aws_lambda',
                'cloud.region': region,
                'faas.name': functionName,
                'faas.version': '$LATEST',
                'process.pid': 9,
                'process.executable.name': '/var/lang/bin/node',
                'process.command': '/var/runtime/index.mjs',
                'process.command_line': '/var/lang/bin/node /var/runtime/index.mjs',
                'process.runtime.version': '16.15.0',
                'process.runtime.name': 'nodejs',
                'process.runtime.description': 'Node.js',
                'computeCustomArn': `arn:aws:lambda:us-east-1:205994128558:function:${functionName}`,
                'functionName': functionName,
                'computeRegion': region,
                'computeRuntime': 'aws.lambda.nodejs.16.15.0',
                'computeCustomFunctionVersion': '$LATEST',
                'computeMemorySize': '1024',
                'eventCustomXTraceId':
                  'Root=1-62c86a37-0e8dec11533d5a206de73145;Parent=238558417f028ef4;Sampled=0',
                'computeCustomLogGroupName': `/aws/lambda/${functionName}`,
                'computeCustomLogStreamName':
                  '2022/07/08/[$LATEST]b0eac4dc95e74a81b374c629a3a379d2',
                'computeCustomEnvArch': 'x64',
                'eventType': null,
                'eventCustomRequestId': requestId,
                'computeIsColdStart': true,
                'eventCustomDomain': null,
                'eventCustomRequestTimeEpoch': null,
                'startTime': Date.now() - 100,
                'endTime': Date.now(),
                'error': false,
                'httpStatusCode': 200,
              },
              traces: {
                resourceSpans: [
                  {
                    resource: {
                      'service.name': 'unknown_service:/var/lang/bin/node',
                      'telemetry.sdk.language': 'nodejs',
                      'telemetry.sdk.name': 'opentelemetry',
                      'telemetry.sdk.version': '1.3.1',
                      'cloud.provider': 'aws',
                      'cloud.platform': 'aws_lambda',
                      'cloud.region': region,
                      'faas.name': functionName,
                      'faas.version': '$LATEST',
                      'process.pid': 9,
                      'process.executable.name': '/var/lang/bin/node',
                      'process.command': '/var/runtime/index.mjs',
                      'process.command_line': '/var/lang/bin/node /var/runtime/index.mjs',
                      'process.runtime.version': '16.15.0',
                      'process.runtime.name': 'nodejs',
                      'process.runtime.description': 'Node.js',
                    },
                    instrumentationLibrarySpans: [
                      {
                        instrumentationLibrary: {
                          name: '@opentelemetry/instrumentation-aws-lambda',
                          version: '0.28.1',
                        },
                        spans: [
                          {
                            traceId: '016dc9641e4b5d3d25ed6875a0b85536',
                            spanId: '32deafa681c39390',
                            name: functionName,
                            kind: 'SPAN_KIND_SERVER',
                            startTimeUnixNano: '1657301560142121000',
                            endTimeUnixNano: '1657301560147432400',
                            attributes: {
                              'faas.execution': requestId,
                              'faas.id': `arn:aws:lambda:us-east-1:205994128558:${functionName}`,
                              'cloud.account.id': '205994128558',
                              'sls.original_properties': 'faas.execution,faas.id,cloud.account.id',
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
            type: 'platform.runtimeDone',
            record: {
              requestId,
              status: 'success',
            },
          },
        ]);
        await new Promise((resolve) => listenerEmitter.once('next', resolve));
        emitter.emit('event', { eventType: 'SHUTDOWN', requestId });
        emitter.emit('logs', [
          {
            type: 'platform.end',
            record: {
              requestId,
            },
          },
          {
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
      }
    );

    log.debug('report string %s', stdoutData);
    const reports = {};
    for (const reportString of stdoutData.split('\n').filter(Boolean)) {
      const reportType = reportString.slice(2, reportString.indexOf(':'));
      if (!reports[reportType]) reports[reportType] = [];
      const jsonString = reportString.slice(reportString.indexOf(':') + 2);
      log.debug(
        'report %s [%d] JSON string %s',
        reportType,
        reports[reportType].length + 1,
        jsonString
      );
      reports[reportType].push(JSON.parse(jsonString));
    }
    log.debug('reports %o', reports);
    const metricsReport = reports.metrics[0];
    const tracesReport = reports.traces[0];

    const resourceMetrics = normalizeOtelAttributes(
      metricsReport.resourceMetrics[0].resource.attributes
    );
    expect(resourceMetrics['faas.name']).to.equal(functionName);
    const resourceSpans = normalizeOtelAttributes(
      tracesReport.resourceSpans[0].resource.attributes
    );
    expect(resourceSpans['faas.name']).to.equal(functionName);
  });
});
