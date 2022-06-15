'use strict';

const path = require('path');
const log = require('log').get('test');
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs');
const { Lambda } = require('@aws-sdk/client-lambda');
const wait = require('timers-ext/promise/sleep');
const basename = require('./basename');
const awsRequest = require('./aws-request');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');
const ensureNpmDependencies = require('../../scripts/lib/ensure-npm-dependencies');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

const create = async (testConfig, coreConfig) => {
  const { configuration } = testConfig;
  try {
    await awsRequest(Lambda, 'createFunction', {
      Role: coreConfig.roleArn,
      Runtime: 'nodejs14.x',
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
  try {
    result = await awsRequest(Lambda, 'invoke', {
      FunctionName: testConfig.configuration.FunctionName,
      Payload: Buffer.from(JSON.stringify(invokePayload), 'utf8'),
    });
  } catch (error) {
    if (error.message.includes('The role defined for the function cannot be assumed by Lambda')) {
      // Occassional race condition issue on AWS side, retry
      await invoke(testConfig);
      return;
    }
    throw error;
  }
  try {
    const responsePayload = JSON.parse(Buffer.from(result.Payload));
    log.debug('invoke response payload %O', responsePayload);
    log.debug('invoke response parsed payload %O', JSON.parse(responsePayload.body));
  } catch {
    /* ignore */
  }
  if (result.FunctionError) {
    if (expectedOutcome.startsWith('error')) return;
    throw new Error(`Invocation errored: ${result.FunctionError}`);
  }
};

const deleteFunction = async (testConfig) => {
  await awsRequest(Lambda, 'deleteFunction', {
    FunctionName: testConfig.configuration.FunctionName,
  });
};

const retrieveReports = async (testConfig) => {
  const retrieveReportEvents = async () => {
    await wait(1000);
    try {
      return (
        await awsRequest(CloudWatchLogs, 'filterLogEvents', {
          startTime: testConfig.invokeStartTime,
          logGroupName: `/aws/lambda/${testConfig.configuration.FunctionName}`,
        })
      ).events;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        log.info('log group not ready, wait and retry %s', testConfig.name);
        return retrieveReportEvents();
      }
      throw error;
    }
  };

  let invocationsData;
  do {
    const events = await retrieveReportEvents();
    invocationsData = [];
    let currentInvocationReports = [];
    let startedMessage;
    for (const { message } of events) {
      if (message.startsWith('⚡')) {
        const reportType = message.slice(2, message.indexOf(':'));
        if (reportType === 'logs') continue;
        const reportJsonString = message.slice(message.indexOf(':') + 1);
        if (reportJsonString.endsWith('\n')) {
          currentInvocationReports.push([reportType, JSON.parse(reportJsonString.trim())]);
        } else {
          startedMessage = { type: reportType, report: reportJsonString };
        }
        continue;
      }
      if (startedMessage) {
        startedMessage.report += message;
        if (startedMessage.report.endsWith('\n')) {
          currentInvocationReports.push([
            startedMessage.type,
            JSON.parse(startedMessage.report.trim()),
          ]);
          startedMessage = null;
          continue;
        }
      }
      if (message.startsWith('REPORT RequestId: ')) {
        invocationsData.push({ reports: currentInvocationReports });
        currentInvocationReports = [];
      }
    }
  } while (invocationsData.length < 2);

  log.info('Obtained reports %s %o', testConfig.name, invocationsData);
  return { invocationsData };
};

module.exports = async (testConfig, coreConfig) => {
  ensureNpmDependencies('test/fixtures/lambdas');
  testConfig.configuration.FunctionName = `${basename}-${testConfig.name}`;

  log.info('Create function %s', testConfig.name);
  await create(testConfig, coreConfig);

  log.info('Ensure function is active %s', testConfig.name);
  await ensureIsActive(testConfig);

  // Provide extra time room, in case local clock is not perfectly in sync
  testConfig.invokeStartTime = Date.now() - 5000;
  log.info('Invoke function #1 %s', testConfig.name);
  await invoke(testConfig);

  log.info('Invoke function #2 %s', testConfig.name);
  await invoke(testConfig);

  log.info('Delete function %s', testConfig.name);
  await deleteFunction(testConfig);

  log.info('Retrieve list of written reports %s', testConfig.name);
  return retrieveReports(testConfig);
};
