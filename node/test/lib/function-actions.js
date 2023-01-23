'use strict';

const log = require('log').get('test');
const wait = require('timers-ext/promise/sleep');
const { Lambda } = require('@aws-sdk/client-lambda');
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs');
const awsRequest = require('../utils/aws-request');

const reportPattern = new RegExp(
  'Duration:\\s*(?<duration>[\\d.]+)\\s*ms\\s+' +
    'Billed Duration:\\s*(?<billedDuration>[\\d]+)\\s*ms\\s+' +
    'Memory Size:\\s*(?<memorySize>[\\d]+)\\s*MB\\s+' +
    'Max Memory Used:\\s*(?<maxMemoryUsed>[\\d]+)\\s*MB\\s*' +
    '(?:Init Duration:\\s*(?<initDuration>[\\d.]+)\\s*ms)?'
);

const create =
  (getBaseConfig = () => ({}), coreConfig) =>
  async (testConfig) => {
    const { configuration, deferredConfiguration } = testConfig;

    const resultConfiguration = {
      ...(await getBaseConfig(testConfig)),
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

const retrieveEvents = async (testConfig, nextToken = undefined) => {
  const result = await awsRequest(CloudWatchLogs, 'filterLogEvents', {
    startTime: testConfig.invokeStartTime,
    limit: 100, // To ensure debug log shows all
    logGroupName: `/aws/lambda/${testConfig.configuration.FunctionName}`,
    nextToken,
  });
  // AWS happens to respond with `nextToken` chains when there are no further events
  // Therefore we use it only if we received some events with the request
  if (result.nextToken && result.events.length) {
    return [...result.events, ...(await retrieveEvents(testConfig, result.nextToken))];
  }
  return result.events;
};
const retrieveAllEvents = async (testConfig) => {
  await wait(1000);
  try {
    return await retrieveEvents(testConfig);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      log.info('log group not ready, wait and retry %s', testConfig.name);
      return retrieveAllEvents();
    }
    throw error;
  }
};

module.exports = {
  reportPattern,
  create,
  ensureIsActive,
  invoke,
  deleteFunction,
  retrieveAllEvents,
};
