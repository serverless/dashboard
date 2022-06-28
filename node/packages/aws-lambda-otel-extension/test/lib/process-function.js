'use strict';

const path = require('path');
const log = require('log').get('test');
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs');
const { Lambda } = require('@aws-sdk/client-lambda');
const wait = require('timers-ext/promise/sleep');
const basename = require('./basename');
const awsRequest = require('../utils/aws-request');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');
const ensureNpmDependencies = require('../../scripts/lib/ensure-npm-dependencies');

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
  const { configuration } = testConfig;
  try {
    await awsRequest(Lambda, 'createFunction', {
      Role: coreConfig.roleArn,
      Runtime: 'nodejs16.x',
      Code: {
        ZipFile: await resolveDirZipBuffer(fixturesDirname),
      },
      Layers: [coreConfig.layerArn],
      Environment: {
        Variables: {
          AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
          DEBUG_SLS_OTEL_LAYER: '1',
          SLS_OTEL_USER_SETTINGS: JSON.stringify({
            metrics: { outputType: 'json' },
            traces: { outputType: 'json' },
          }),
        },
      },
      ...configuration,
    });
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
  const {
    Configuration: { State: state },
  } = await awsRequest(Lambda, 'getFunction', {
    FunctionName: testConfig.configuration.FunctionName,
  });
  if (state !== 'Active') await ensureIsActive(testConfig);
};

const invoke = async (testConfig) => {
  const { expectedOutcome, invokePayload } = testConfig;

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
  try {
    const responsePayload = JSON.parse(Buffer.from(result.Payload));
    log.debug('invoke response payload %O', responsePayload);
    log.debug('invoke response parsed payload %O', JSON.parse(responsePayload.body));
  } catch {
    /* ignore */
  }
  if (result.FunctionError) {
    if (expectedOutcome.startsWith('error')) return duration;
    throw new Error(`Invocation of ${testConfig.name} errored: ${result.FunctionError}`);
  }
  return duration;
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
      logGroupName: `/aws/lambda/${testConfig.configuration.FunctionName}`,
      nextToken,
    });
    if (result.nextToken) return [...result.events, ...(await retrieveEvents(result.nextToken))];
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
    const events = await retrieveAllEvents();

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
      if (message.startsWith('Extension overhead duration: external initialization')) {
        isExternalExtensionLoaded = true;
        processesData.push(
          (currentProcessData = {
            extensionOverheadDurations: {
              externalInit: parseInt(message.slice(message.lastIndexOf(':') + 1), 10),
            },
          })
        );
        continue;
      }
      if (!isExternalExtensionLoaded && message.startsWith('Internal extension: Init')) {
        processesData.push((currentProcessData = { extensionOverheadDurations: {} }));
        continue;
      }
      if (message.startsWith('Extension overhead duration: internal initialization')) {
        currentProcessData.extensionOverheadDurations.internalInit = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('START RequestId: ')) {
        currentInvocationData = { reports: [], extensionOverheadDurations: {} };
        continue;
      }
      if (message.startsWith('Extension overhead duration: internal request')) {
        getCurrentInvocationData().extensionOverheadDurations.internalRequest = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('⚡')) {
        const reportType = message.slice(2, message.indexOf(':'));
        if (reportType === 'logs') continue;
        const reportJsonString = message.slice(message.indexOf(':') + 1);
        if (reportJsonString.endsWith('\n')) {
          getCurrentInvocationData().reports.push([
            reportType,
            JSON.parse(reportJsonString.trim()),
          ]);
        } else {
          startedMessage = { type: reportType, report: reportJsonString };
        }
        continue;
      }
      if (startedMessage) {
        startedMessage.report += message;
        if (startedMessage.report.endsWith('\n')) {
          getCurrentInvocationData().reports.push([
            startedMessage.type,
            JSON.parse(startedMessage.report.trim()),
          ]);
          startedMessage = null;
          continue;
        }
      }
      if (message.startsWith('Extension overhead duration: internal response')) {
        getCurrentInvocationData().extensionOverheadDurations.internalResponse = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('Extension overhead duration: external invocation')) {
        getCurrentInvocationData().extensionOverheadDurations.externalResponse = parseInt(
          message.slice(message.lastIndexOf(':') + 1),
          10
        );
        continue;
      }
      if (message.startsWith('REPORT RequestId: ')) {
        if (!currentProcessData) {
          // With extensions not loaded we won't get "Extension overhead.." log
          processesData.push((currentProcessData = { extensionOverheadDurations: {} }));
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
        currentInvocationData = null;
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
  ensureNpmDependencies('test/fixtures/lambdas');
  testConfig.configuration.FunctionName = `${basename}-${testConfig.name}`;

  log.notice('Process function %s', testConfig.name);
  log.info('Create function %s', testConfig.name);
  await create(testConfig, coreConfig);

  log.info('Ensure function is active %s', testConfig.name);
  await ensureIsActive(testConfig);

  const invokeDurations = [];
  // Provide extra time room, in case local clock is not perfectly in sync
  testConfig.invokeStartTime = Date.now() - 5000;
  let counter = 1;
  do {
    await wait(3000);
    log.info('Invoke function #%d %s', counter, testConfig.name);
    try {
      invokeDurations.push(await invoke(testConfig));
    } catch (error) {
      if (error.message.includes('Lambda was unable to decrypt the environment variables')) {
        // Rare error on AWS side, which we can recover from only by re-creating the lambda
        log.error('Approached not-recoverable error, re-creating lambda: %o', error);
        return module.exports(testConfig, coreConfig);
      }
      throw error;
    }
  } while (++counter <= testConfig.invokeCount);

  log.info('Delete function %s', testConfig.name);
  await deleteFunction(testConfig);

  log.info('Retrieve list of written reports %s', testConfig.name);
  const reports = await retrieveReports(testConfig);
  for (let i = 0; i < reports.invocationsData.length; i++) {
    reports.invocationsData[i].localDuration = invokeDurations[i];
  }
  log.info('Obtained reports %s %o', testConfig.name, reports);
  return reports;
};
