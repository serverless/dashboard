'use strict';

const path = require('path');
const log = require('log').get('test');
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs');
const { Lambda } = require('@aws-sdk/client-lambda');
const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const wait = require('timers-ext/promise/sleep');
const basename = require('./basename');
const awsRequest = require('../utils/aws-request');
const normalizeProtoObject = require('../utils/normalize-proto-object');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

const reportPattern = new RegExp(
  'Duration:\\s*(?<duration>[\\d.]+)\\s*ms\\s+' +
    'Billed Duration:\\s*(?<billedDuration>[\\d]+)\\s*ms\\s+' +
    'Memory Size:\\s*(?<memorySize>[\\d]+)\\s*MB\\s+' +
    'Max Memory Used:\\s*(?<maxMemoryUsed>[\\d]+)\\s*MB\\s*' +
    '(?:Init Duration:\\s*(?<initDuration>[\\d.]+)\\s*ms)?'
);

const handledOutcomes = new Set(['success', 'error:handled']);

const create = async (testConfig, coreConfig) => {
  const { configuration, deferredConfiguration } = testConfig;
  const resultConfiguration = {
    Role: coreConfig.roleArn,
    Runtime: 'nodejs18.x',
    MemorySize: 1024,
    Code: {
      ZipFile: await resolveDirZipBuffer(fixturesDirname),
    },
    Layers: [coreConfig.layerInternalArn],
    Environment: {
      Variables: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
        SLS_ORG_ID: process.env.SLS_ORG_ID,
        SLS_SDK_DEBUG: '1',
      },
    },
    Timeout: 15,
    ...configuration,
    ...(deferredConfiguration && deferredConfiguration(testConfig, coreConfig)),
  };
  if (process.env.SERVERLESS_PLATFORM_STAGE === 'dev') {
    resultConfiguration.Environment.Variables.SERVERLESS_PLATFORM_STAGE = 'dev';
  }
  try {
    const result = await awsRequest(Lambda, 'createFunction', resultConfiguration);
    testConfig.functionArn = result.FunctionArn;
  } catch (error) {
    if (
      error.message.includes('The role defined for the function cannot be assumed by Lambda') ||
      error.message.includes('because the KMS key is invalid for CreateGrant')
    ) {
      // Occassional race condition issue on AWS side, retry
      await create(testConfig, coreConfig);
      return;
    }
    if (error.message.includes('Function already exist')) {
      log.notice('Function %s already exists, deleting and re-creating', testConfig.name);
      await awsRequest(Lambda, 'deleteFunction', {
        FunctionName: testConfig.configuration.FunctionName,
      });
      await create(testConfig, coreConfig);
      return;
    }
    throw error;
  }
};

const ensureIsActive = async (testConfig) => {
  await wait(100);
  let state;
  try {
    state = (
      await awsRequest(Lambda, 'getFunction', {
        FunctionName: testConfig.configuration.FunctionName,
      })
    ).Configuration.State;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      log.notice('Function %s not found, retrying after delay', testConfig.name);
      await ensureIsActive(testConfig);
      return;
    }
    throw error;
  }
  if (state !== 'Active') await ensureIsActive(testConfig);
};

const invoke = async (testConfig) => {
  const { expectedOutcome } = testConfig;
  let { invokePayload } = testConfig;
  if (typeof invokePayload === 'function') invokePayload = invokePayload(testConfig);
  log.debug('invoke request payload %O', invokePayload);
  let result;
  const startTime = process.hrtime.bigint();
  try {
    result = await awsRequest(Lambda, 'invoke', {
      FunctionName: testConfig.configuration.FunctionName,
      Payload: Buffer.from(JSON.stringify(invokePayload), 'utf8'),
    });
  } catch (error) {
    if (error.message.includes('The role defined for the function cannot be assumed by Lambda')) {
      // Occassional race condition issue on AWS side, retry
      log.error('Approached error, retying ivocation: %o', error);
      await wait(100);
      return invoke(testConfig);
    }
    error.message = `"${testConfig.configuration.FunctionName}" invocation failed: ${error.message}`;
    throw error;
  }
  const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
  const payload = { raw: String(Buffer.from(result.Payload)) };
  log.debug('invoke response payload %s', payload.raw);
  if (result.FunctionError) {
    if (expectedOutcome.startsWith('error')) return duration;
    throw new Error(`Invocation of ${testConfig.name} errored: ${result.FunctionError}`);
  }
  return { duration, payload };
};

const deleteFunction = async (testConfig) => {
  await awsRequest(Lambda, 'deleteFunction', {
    FunctionName: testConfig.configuration.FunctionName,
  });
};

const retrieveReports = async (testConfig) => {
  const retrieveEvents = async (nextToken = undefined) => {
    const result = await awsRequest(CloudWatchLogs, 'filterLogEvents', {
      startTime: testConfig.invokeStartTime,
      limit: 100, // To ensure debug log shows all
      logGroupName: `/aws/lambda/${testConfig.configuration.FunctionName}`,
      nextToken,
    });
    // AWS happens to respond with `nextToken` chains when there are no further events
    // Therefore we use it only if we received some events with the request
    if (result.nextToken && result.events.length) {
      return [...result.events, ...(await retrieveEvents(result.nextToken))];
    }
    return result.events;
  };
  const retrieveAllEvents = async () => {
    await wait(1000);
    try {
      return await retrieveEvents();
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        log.info('log group not ready, wait and retry %s', testConfig.name);
        return retrieveAllEvents();
      }
      throw error;
    }
  };

  let invocationsData;
  let processesData;
  do {
    let events = await retrieveAllEvents();
    const eventGroups = new Map();
    for (const event of events) {
      const { logStreamName } = event;
      if (!eventGroups.has(logStreamName)) eventGroups.set(logStreamName, []);
      eventGroups.get(logStreamName).push(event);
    }
    if (eventGroups.size > 1) {
      if (testConfig.ignoreMultipleInvocations) {
        events = Array.from(eventGroups.values()).sort(
          // Choose log stream with more events
          (eventsA, eventsB) => eventsB.length - eventsA.length
        )[0];
      } else {
        throw new Error(`Unexpected count of lambda instances: ${Array.from(eventGroups.keys())}`);
      }
    }

    let startEventsCount = 0;
    let reportEventsCount = 0;
    for (const { message } of events) {
      if (message.startsWith('START RequestId: ')) ++startEventsCount;
      else if (message.startsWith('REPORT RequestId: ')) ++reportEventsCount;
    }

    processesData = [];
    invocationsData = [];
    if (startEventsCount < testConfig.invokeCount || reportEventsCount < testConfig.invokeCount) {
      continue;
    }

    log.debug('Events for %s: %o', testConfig.name, events);
    let currentInvocationData;
    let currentProcessData;
    let startedMessage;
    let startedMessageType;
    let isExternalExtensionLoaded = false;
    const getCurrentInvocationData = () => {
      if (!currentInvocationData) {
        log.error(
          'Reject due to unexpected CW events (for start time %d): %o',
          testConfig.invokeStartTime,
          events
        );
        throw new Error(`Failed to resolve invocation data for ${testConfig.name}`);
      }
      return currentInvocationData;
    };
    for (const { message } of events) {
      if (message.startsWith('⚡ SDK: External initialization')) {
        isExternalExtensionLoaded = true;
        processesData.push(
          (currentProcessData = { extensionOverheadDurations: {}, internalDurations: {} })
        );
        continue;
      }
      if (!isExternalExtensionLoaded && message.startsWith('⚡ SDK: Wrapper initialization')) {
        processesData.push(
          (currentProcessData = { extensionOverheadDurations: {}, internalDurations: {} })
        );
        continue;
      }
      if (message.startsWith('⚡ SDK: Overhead duration: External initialization')) {
        currentProcessData.extensionOverheadDurations.externalInit = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('⚡ SDK: Overhead duration: Internal initialization')) {
        currentProcessData.extensionOverheadDurations.internalInit = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('START RequestId: ')) {
        currentInvocationData = { extensionOverheadDurations: {}, internalDurations: {} };
        continue;
      }
      if (message.startsWith('⚡ SDK: Overhead duration: Internal request')) {
        getCurrentInvocationData().extensionOverheadDurations.internalRequest = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('SERVERLESS_TELEMETRY.T.')) {
        const payloadString = message.slice(message.indexOf('.T.') + 3);
        if (payloadString.endsWith('\n')) {
          const trace = normalizeProtoObject(
            TracePayload.decode(Buffer.from(payloadString.trim(), 'base64'))
          );
          const [totalSpan] = trace.spans;
          const [initializationSpan, invocationSpan] = (() => {
            if (trace.spans[1].name === 'aws.lambda.initialization') return trace.spans.slice(1, 3);
            return [null, trace.spans[1]];
          })();

          Object.assign(getCurrentInvocationData(), {
            trace,
            internalDurations: {
              total: Math.round(
                (totalSpan.endTimeUnixNano - totalSpan.startTimeUnixNano) / 1000000
              ),
              initialization: initializationSpan
                ? Math.round(
                    (initializationSpan.endTimeUnixNano - initializationSpan.startTimeUnixNano) /
                      1000000
                  )
                : null,
              invocation: Math.round(
                (invocationSpan.endTimeUnixNano - invocationSpan.startTimeUnixNano) / 1000000
              ),
            },
          });
        } else {
          startedMessage = payloadString;
          startedMessageType = 'trace';
        }
        continue;
      }
      if (startedMessage) {
        startedMessage += message;
        if (startedMessage.endsWith('\n')) {
          getCurrentInvocationData()[startedMessageType] = normalizeProtoObject(
            TracePayload.decode(Buffer.from(startedMessage.trim(), 'base64'))
          );
          startedMessage = null;
          continue;
        }
      }
      if (message.startsWith('⚡ SDK: Overhead duration: Internal response')) {
        getCurrentInvocationData().extensionOverheadDurations.internalResponse = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('⚡ SDK: Overhead duration: External invocation')) {
        currentProcessData.extensionOverheadDurations.externalResponse = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('REPORT RequestId: ')) {
        if (!currentProcessData) {
          // With extensions not loaded we won't get "Extension overhead.." log
          processesData.push(
            (currentProcessData = { extensionOverheadDurations: {}, internalDurations: {} })
          );
        }
        const reportMatch = message.match(reportPattern);
        if (!reportMatch) throw new Error(`Unexpected report string: ${message}`);
        const reportData = reportMatch.groups;
        getCurrentInvocationData().billedDuration = Number(reportData.billedDuration);
        currentInvocationData.duration = Number(reportData.duration);
        currentInvocationData.maxMemoryUsed = Number(reportData.maxMemoryUsed);
        if (reportData.initDuration) {
          currentProcessData.initDuration = Number(reportData.initDuration);
        }
        invocationsData.push(currentInvocationData);
      }
    }
  } while (invocationsData.length < testConfig.invokeCount);

  if (processesData.length !== 1 && handledOutcomes.has(testConfig.expectedOutcome)) {
    throw new Error(
      `Unexpected count of processes (${processesData.length}) for: ${testConfig.name}`
    );
  }
  return { processesData, invocationsData };
};

module.exports = async (testConfig, coreConfig) => {
  testConfig.configuration.FunctionName = `${basename}-${testConfig.name}`;

  log.notice('Process function %s', testConfig.name);

  if (testConfig.hooks.beforeCreate) await testConfig.hooks.beforeCreate(testConfig, coreConfig);

  log.info('Create function %s', testConfig.name);
  await create(testConfig, coreConfig);

  log.info('Ensure function is active %s', testConfig.name);
  await ensureIsActive(testConfig);

  if (testConfig.hooks.afterCreate) await testConfig.hooks.afterCreate(testConfig, coreConfig);

  const invocationsMeta = [];

  // Provide extra time room, in case local clock is not perfectly in sync
  testConfig.invokeStartTime = Date.now() - 5000;
  let counter = 1;
  do {
    await wait(3000);
    log.info('Invoke function #%d %s', counter, testConfig.name);
    try {
      invocationsMeta.push(await (testConfig.invoke || invoke)(testConfig));
    } catch (error) {
      if (error.message.includes('Lambda was unable to decrypt the environment variables')) {
        // Rare error on AWS side, which we can recover from only by re-creating the lambda
        log.error('Approached not-recoverable error, re-creating lambda: %o', error);
        return module.exports(testConfig, coreConfig);
      }
      throw error;
    }
  } while (++counter <= testConfig.invokeCount);

  if (testConfig.hooks.beforeDelete) await testConfig.hooks.beforeDelete(testConfig, coreConfig);
  log.info('Delete function %s', testConfig.name);
  await deleteFunction(testConfig);
  if (testConfig.hooks.afterDelete) await testConfig.hooks.afterDelete(testConfig, coreConfig);

  log.info('Retrieve list of written reports %s', testConfig.name);
  const reports = await retrieveReports(testConfig);
  try {
    for (let i = 0; i < invocationsMeta.length; i++) {
      const invocationMeta = invocationsMeta[i];
      Object.assign(reports.invocationsData[i], {
        localDuration: invocationMeta.duration,
        responsePayload: invocationMeta.payload,
      });
    }
  } finally {
    log.info('Obtained reports %s %o', testConfig.name, reports);
  }
  return reports;
};
