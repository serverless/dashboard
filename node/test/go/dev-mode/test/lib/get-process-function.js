'use strict';

const path = require('path');
const log = require('log').get('test');
const wait = require('timers-ext/promise/sleep');
const resolveDirZipBuffer = require('../../../../utils/resolve-dir-zip-buffer');
const {
  create: baseCreate,
  ensureIsActive,
  invoke,
  deleteFunction,
  retrieveAllEvents,
  reportPattern,
} = require('../../../../lib/function-actions');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

const handledOutcomes = new Set(['success', 'error:handled']);

module.exports = async (basename, coreConfig) => {
  const create = baseCreate(async (testConfig) => {
    const { configuration, includeInternal } = testConfig;
    return {
      Role: coreConfig.roleArn,
      Runtime: 'nodejs18.x',
      MemorySize: 1024,
      Code: {
        ZipFile: await resolveDirZipBuffer(fixturesDirname),
      },
      Layers: includeInternal
        ? [coreConfig.layerExternalArn, coreConfig.layerInternalArn]
        : [coreConfig.layerExternalArn],
      Environment: {
        Variables: {
          ...(includeInternal
            ? {
                AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
                SLS_ORG_ID: process.env.SLS_ORG_ID,
              }
            : {}),
          SERVERLESS_PLATFORM_STAGE: 'dev',
          SLS_DEV_MODE_ORG_ID: process.env.SLS_ORG_ID,
          SLS_TEST_EXTENSION_LOG: '1',
        },
      },
      ...configuration,
    };
  }, coreConfig);

  const retrieveReports = async (testConfig) => {
    let invocationsData;
    let processesData;
    do {
      const events = await retrieveAllEvents(testConfig);

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
        if (message.startsWith('⚡ DEV-MODE: initialization')) {
          processesData.push(
            (currentProcessData = {
              extensionOverheadDurations: {},
              logs: [],
              reqRes: [],
              traces: [],
            })
          );
          continue;
        }
        if (message.startsWith('⚡ DEV-MODE: Overhead duration: External initialization')) {
          currentProcessData.extensionOverheadDurations.externalInit = parseInt(
            message.slice(message.lastIndexOf(':') + 1),
            10
          );
          continue;
        }
        if (message.startsWith('START RequestId: ')) {
          currentInvocationData = {
            extensionOverheadDurations: {},
            logs: [],
            reqRes: [],
            traces: [],
          };
          continue;
        }
        if (message.startsWith('⚡ DEV-MODE: Overhead duration: External request')) {
          getCurrentInvocationData().extensionOverheadDurations.externalRequest = parseInt(
            message.slice(message.lastIndexOf(':') + 1),
            10
          );
          continue;
        }
        if (message.startsWith('⚡ DEV-MODE: Log###')) {
          getCurrentInvocationData().logs.push(message.slice(message.lastIndexOf('###') + 3));
          continue;
        }
        if (message.startsWith('⚡ DEV-MODE: ReqRes###')) {
          getCurrentInvocationData().reqRes.push(message.slice(message.lastIndexOf('###') + 3));
          continue;
        }
        if (message.startsWith('⚡ DEV-MODE: Traces###')) {
          getCurrentInvocationData().traces.push(message.slice(message.lastIndexOf('###') + 3));
          continue;
        }
        if (message.startsWith('⚡ DEV-MODE: Extension overhead duration: External shutdown')) {
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

  return async (testConfig) => {
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
};
