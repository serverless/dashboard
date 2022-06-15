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

const create = async (functionConfig, coreConfig, testConfig) => {
  const { functionOptions = {} } = testConfig;
  try {
    await awsRequest(Lambda, 'createFunction', {
      Handler: `${functionConfig.handlerModuleName}.handler`,
      Role: coreConfig.roleArn,
      Runtime: 'nodejs14.x',
      ...functionOptions.configuration,
      Code: {
        ZipFile: functionConfig.codeZipBuffer,
      },
      FunctionName: functionConfig.name,
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
    });
  } catch (error) {
    if (
      error.message.includes('The role defined for the function cannot be assumed by Lambda') ||
      error.message.includes('because the KMS key is invalid for CreateGrant')
    ) {
      // Occassional race condition issue on AWS side, retry
      await create(functionConfig, coreConfig, testConfig);
      return;
    }
    if (error.message.includes('Function already exist')) {
      log.notice('Function %s already exists, deleting and re-creating', functionConfig.basename);
      await awsRequest(Lambda, 'deleteFunction', { FunctionName: functionConfig.name });
      await create(functionConfig, coreConfig, testConfig);
      return;
    }
    throw error;
  }
};

const ensureIsActive = async (functionConfig) => {
  const {
    Configuration: { State: state },
  } = await awsRequest(Lambda, 'getFunction', { FunctionName: functionConfig.name });
  if (state !== 'Active') await ensureIsActive(functionConfig);
};

const invoke = async (functionConfig, testConfig) => {
  const { invokeOptions = {} } = testConfig;

  const payload = invokeOptions.payload || {};
  log.debug('invoke request payload %O', payload);
  let result;
  try {
    result = await awsRequest(Lambda, 'invoke', {
      FunctionName: functionConfig.name,
      Payload: Buffer.from(JSON.stringify(payload), 'utf8'),
    });
  } catch (error) {
    if (error.message.includes('The role defined for the function cannot be assumed by Lambda')) {
      // Occassional race condition issue on AWS side, retry
      await invoke(functionConfig, testConfig);
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
    if (invokeOptions.expectedOutcome && invokeOptions.expectedOutcome.startsWith('error')) {
      return;
    }
    throw new Error(`Invocation errored: ${result.FunctionError}`);
  }
};

const deleteFunction = async (functionConfig) => {
  await awsRequest(Lambda, 'deleteFunction', { FunctionName: functionConfig.name });
};

const retrieveReports = async (functionConfig) => {
  const retrieveReportEvents = async () => {
    try {
      return (
        await awsRequest(CloudWatchLogs, 'filterLogEvents', {
          startTime: functionConfig.invokeStartTime,
          logGroupName: `/aws/lambda/${functionConfig.name}`,
        })
      ).events;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        log.info('log group not ready, wait and retry %s', functionConfig.basename);
        await wait(1000);
        return retrieveReportEvents();
      }
      throw error;
    }
  };

  let reports;
  do {
    const events = await retrieveReportEvents();
    reports = [];
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
        reports.push(currentInvocationReports);
        currentInvocationReports = [];
      }
    }
  } while (reports.length < 2);

  log.info('Obtained reports %s %o', functionConfig.basename, reports);
  return reports;
};

module.exports = async (functionConfig, testConfig, coreConfig) => {
  ensureNpmDependencies('test/fixtures/lambdas');
  functionConfig.codeZipBuffer = await resolveDirZipBuffer(fixturesDirname);
  functionConfig.name = `${basename}-${functionConfig.basename}`;

  log.info('Create function %s', functionConfig.basename);
  await create(functionConfig, coreConfig, testConfig);

  log.info('Ensure function is active %s', functionConfig.basename);
  await ensureIsActive(functionConfig);

  functionConfig.invokeStartTime = Date.now();
  log.info('Invoke function #1 %s', functionConfig.basename);
  await invoke(functionConfig, testConfig);

  log.info('Invoke function #2 %s', functionConfig.basename);
  await invoke(functionConfig, testConfig);

  log.info('Delete function %s', functionConfig.basename);
  await deleteFunction(functionConfig);

  log.info('Retrieve list of written reports %s', functionConfig.basename);
  return { reports: await retrieveReports(functionConfig) };
};
