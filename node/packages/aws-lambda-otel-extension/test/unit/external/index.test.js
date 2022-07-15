'use strict';

const { expect } = require('chai');

const path = require('path');
const { EventEmitter } = require('events');
const spawn = require('child-process-ext/spawn');
const wait = require('timers-ext/promise/sleep');
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

const extensionProcessHandler = (options, callback) => {
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
      SLS_DEBUG_EXTENSION: '1',
    },
    split: true,
  });

  const promise = (async () => {
    await Promise.all([
      new Promise((resolve) => listenerEmitter.once('next', resolve)),
      new Promise((resolve) => listenerEmitter.once('logsSubscription', resolve)),
    ]);

    try {
      await callback({ emitter, listenerEmitter, extensionProcess });
      await extensionProcess;
    } finally {
      extensionProcess.child.kill();
      server.close();
    }
  })();

  return { extensionProcess, promise };
};

describe('external', () => {
  let stdoutLines;
  let emitter;
  let requestId;
  let reports;
  before(async () => {
    ensureNpmDependencies('external/otel-extension-external');
    stdoutLines = [];
  });

  const resolveReports = () => {
    const result = [];
    for (const reportString of stdoutLines
      .filter(Boolean)
      .filter((line) => line.startsWith('⚡'))) {
      const reportType = reportString.slice(2, reportString.indexOf(':'));
      if (!result[reportType]) result[reportType] = [];
      const jsonString = reportString.slice(reportString.indexOf(':') + 2);
      log.debug(
        'report %s [%d] JSON string %s',
        reportType,
        result[reportType].length + 1,
        jsonString
      );
      result.push([reportType, JSON.parse(jsonString)]);
    }
    stdoutLines.length = 0;
    return result;
  };

  const waitForReports = async () => {
    do {
      await wait(100);
      reports = resolveReports();
    } while (!reports.length);
    return reports;
  };

  const emitExtensionReady = () =>
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

  const emitPlatformStart = () =>
    emitter.emit('logs', [
      {
        type: 'platform.start',
        record: {
          requestId,
          version: '$LATEST',
        },
      },
    ]);

  const emitPlatformRuntimeDone = (status) =>
    emitter.emit('logs', [
      {
        type: 'platform.runtimeDone',
        record: {
          requestId,
          status: status || 'success',
        },
      },
    ]);

  const emitPlaftormEndAndReport = (otherRequestId) =>
    emitter.emit('logs', [
      {
        type: 'platform.end',
        record: {
          requestId: otherRequestId || requestId,
        },
      },
      {
        type: 'platform.report',
        record: {
          requestId: otherRequestId || requestId,
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

  const emitInvoke = () => emitter.emit('event', { eventType: 'INVOKE', requestId });
  const emitShutdown = () => emitter.emit('event', { eventType: 'SHUTDOWN', requestId });

  const sendEventData = async (options = {}) => {
    const response = await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
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
              'computeCustomLogStreamName': '2022/07/08/[$LATEST]b0eac4dc95e74a81b374c629a3a379d2',
              'computeCustomEnvArch': 'x86',
              'eventType': null,
              'eventCustomRequestId': requestId,
              'computeIsColdStart': true,
              'eventCustomDomain': null,
              'eventCustomRequestTimeEpoch': null,
            },
          },
          span: {
            traceId: `${requestId}-trace`,
            spanId: `${requestId}-span`,
          },
          requestEventPayload: options.requestEventPayload
            ? {
                ...options.requestEventPayload,
                traceId: `${requestId}-trace`,
                spanId: `${requestId}-span`,
              }
            : undefined,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await response.text();
  };

  const sendTelemetryData = async (options = {}) => {
    const response = await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
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
            'computeCustomLogStreamName': '2022/07/08/[$LATEST]b0eac4dc95e74a81b374c629a3a379d2',
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
                        traceId: `${requestId}-trace`,
                        spanId: `${requestId}-span`,
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
          responseEventPayload: options.responseEventPayload
            ? {
                ...options.responseEventPayload,
                traceId: `${requestId}-trace`,
                spanId: `${requestId}-span`,
              }
            : undefined,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    await response.text();
  };

  it('should handle plain success invocation', async () => {
    const { extensionProcess, promise } = extensionProcessHandler(
      { region, functionName },
      async (testUtils) => {
        emitter = testUtils.emitter;

        emitExtensionReady();

        // Invocation
        requestId = uuidv4();
        emitInvoke();
        emitPlatformStart();

        await sendEventData();

        await sendTelemetryData();

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);
        const metricsReport = reports[0][1];
        const tracesReport = reports[1][1];
        const resourceMetrics = normalizeOtelAttributes(
          metricsReport.resourceMetrics[0].resource.attributes
        );
        const resourceSpans = normalizeOtelAttributes(
          tracesReport.resourceSpans[0].resource.attributes
        );
        expect(resourceSpans['faas.name']).to.equal(functionName);
        expect(resourceMetrics['faas.name']).to.equal(functionName);

        // Shutdown
        emitShutdown();

        emitPlaftormEndAndReport();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);
      }
    );
    extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await promise;
  });

  it('should handle request and response reports', async () => {
    const { extensionProcess, promise } = extensionProcessHandler(
      { region, functionName },
      async (testUtils) => {
        emitter = testUtils.emitter;

        emitExtensionReady();

        // Invocation
        requestId = uuidv4();

        emitInvoke();
        emitPlatformStart();

        const requestData = { foo: 'bar' };
        await sendEventData({
          requestEventPayload: {
            requestData,
            timestamp: 1657823430963,
            executionId: requestId,
          },
        });
        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['request']);
        expect(reports[0][1].requestData).to.deep.equal(requestData);

        const responseData = {
          statusCode: 200,
          body: '{"result":"ok","filename":"/var/task/callback.js"}',
        };
        await sendTelemetryData({
          responseEventPayload: {
            responseData,
            errorData: null,
            executionId: requestId,
          },
        });

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['response', 'metrics', 'traces']);
        const responseReport = reports[0][1];
        expect(responseReport.responseData).to.deep.equal(responseData);

        // Shutdown
        emitShutdown();

        emitPlaftormEndAndReport();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);
      }
    );
    extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await promise;
  });

  it('should handle logs', async () => {
    const { extensionProcess, promise } = extensionProcessHandler(
      { region, functionName },
      async (testUtils) => {
        emitter = testUtils.emitter;

        let logs = [
          {
            type: 'function',
            record: '1 initialization\n',
          },
          {
            type: 'function',
            record: '2 initialization\n',
          },
        ];
        emitter.emit('logs', logs);

        emitExtensionReady();
        await wait(100);
        expect(resolveReports()).to.deep.equal([]);

        // First invocation
        requestId = uuidv4();

        emitInvoke();
        emitPlatformStart();

        await sendEventData();
        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['logs']);
        expect(reports[0][1].map(({ Body: body }) => body)).to.deep.equal(
          logs.map(({ record }) => record)
        );

        logs = [
          {
            type: 'function',
            record: '1 invocation\n',
          },
          {
            type: 'function',
            record: '2 invocation\n',
          },
        ];
        emitter.emit('logs', logs);
        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['logs']);
        expect(reports[0][1].map(({ Body: body }) => body)).to.deep.equal(
          logs.map(({ record }) => record)
        );

        logs = [
          {
            type: 'function',
            record: '3 invocation\n',
          },
          {
            type: 'function',
            record: '4 invocation\n',
          },
        ];
        emitter.emit('logs', logs);
        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['logs']);
        expect(reports[0][1].map(({ Body: body }) => body)).to.deep.equal(
          logs.map(({ record }) => record)
        );

        await sendTelemetryData();

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);

        // Second invocation
        const oldRequestId = requestId;
        requestId = uuidv4();
        emitInvoke();

        emitPlaftormEndAndReport(oldRequestId);

        emitPlatformStart();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);

        await sendEventData();

        await wait(100);
        expect(resolveReports()).to.deep.equal([]);

        logs = [
          {
            type: 'function',
            record: '5 invocation\n',
          },
          {
            type: 'function',
            record: '6 invocation\n',
          },
        ];
        emitter.emit('logs', logs);
        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['logs']);
        expect(reports[0][1].map(({ Body: body }) => body)).to.deep.equal(
          logs.map(({ record }) => record)
        );

        await sendTelemetryData();

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);

        // Shutdown
        emitShutdown();

        emitPlaftormEndAndReport();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);
      }
    );
    extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await promise;
  });

  it('should handle race condition where telemetry data arrives before event data', async () => {
    const { extensionProcess, promise } = extensionProcessHandler(
      { region, functionName },
      async (testUtils) => {
        emitter = testUtils.emitter;

        emitExtensionReady();

        // Invocation
        requestId = uuidv4();

        emitInvoke();
        emitPlatformStart();

        const responseData = {
          statusCode: 200,
          body: '{"result":"ok","filename":"/var/task/callback.js"}',
        };
        await sendTelemetryData({
          responseEventPayload: {
            responseData,
            errorData: null,
            executionId: requestId,
          },
        });
        await wait(20);

        const requestData = { foo: 'bar' };
        await sendEventData({
          requestEventPayload: {
            requestData,
            timestamp: 1657823430963,
            executionId: requestId,
          },
        });

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal([
          'metrics',
          'traces',
          'request',
          'response',
        ]);
        expect(reports[2][1].requestData).to.deep.equal(requestData);
        const responseReport = reports[3][1];
        expect(responseReport.responseData).to.deep.equal(responseData);

        // Shutdown
        emitShutdown();

        emitPlaftormEndAndReport();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);
      }
    );
    extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await promise;
  });

  it('should handle case where platform.start arrives before invoke', async () => {
    const { extensionProcess, promise } = extensionProcessHandler(
      { region, functionName },
      async (testUtils) => {
        emitter = testUtils.emitter;

        emitExtensionReady();

        // First invocation
        requestId = uuidv4();
        emitPlatformStart();
        emitInvoke();

        await sendEventData();

        await sendTelemetryData();

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);

        // Second invocation

        emitPlaftormEndAndReport();
        requestId = uuidv4();
        emitPlatformStart();
        emitInvoke();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);

        await sendEventData();

        await sendTelemetryData();

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);

        emitPlaftormEndAndReport();

        // Shutdown
        emitShutdown();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);
      }
    );
    extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await promise;
  });

  it('should restore previous telemetry data in case of crash', async () => {
    requestId = uuidv4();
    const firstInvocation = extensionProcessHandler({ region, functionName }, async (testUtils) => {
      emitter = testUtils.emitter;

      emitExtensionReady();

      // First invocation

      emitInvoke();
      emitPlatformStart();

      await sendEventData();

      await sendTelemetryData();

      emitPlatformRuntimeDone('timeout');

      await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

      reports = resolveReports();
      expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);

      // Shutdown
      emitShutdown();
    });
    firstInvocation.extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await firstInvocation.promise;
    expect(resolveReports()).to.deep.equal([]);

    const secondInvocation = extensionProcessHandler(
      { region, functionName },
      async (testUtils) => {
        emitter = testUtils.emitter;

        emitExtensionReady();

        // First invocation
        const oldRequestId = requestId;
        requestId = uuidv4();
        emitInvoke();
        emitPlaftormEndAndReport(oldRequestId);
        emitPlatformStart();

        await sendEventData();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);

        await sendTelemetryData();

        emitPlatformRuntimeDone();

        await new Promise((resolve) => testUtils.listenerEmitter.once('next', resolve));

        reports = resolveReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics', 'traces']);

        // Shutdown
        emitShutdown();

        emitPlaftormEndAndReport();

        reports = await waitForReports();
        expect(reports.map(([name]) => name)).to.deep.equal(['metrics']);
      }
    );
    secondInvocation.extensionProcess.stdout.on('data', (line) => stdoutLines.push(line));
    await secondInvocation.promise;
  });
});
