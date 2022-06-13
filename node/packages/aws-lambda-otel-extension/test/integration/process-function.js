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

const create = async (fnConfig, coreConfig, testConfig) => {
  const { createOptions = {} } = testConfig;
  try {
    await awsRequest(Lambda, 'createFunction', {
      Handler: `${fnConfig.handlerModuleName}.handler`,
      Role: coreConfig.roleArn,
      Runtime: 'nodejs14.x',
      ...createOptions.configuration,
      Code: {
        ZipFile: fnConfig.codeZipBuffer,
      },
      FunctionName: fnConfig.name,
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
      await create(fnConfig, coreConfig, testConfig);
      return;
    }
    if (error.message.includes('Function already exist')) {
      log.notice('Function %s already exists, deleting and re-creating', fnConfig.basename);
      await awsRequest(Lambda, 'deleteFunction', { FunctionName: fnConfig.name });
      await create(fnConfig, coreConfig, testConfig);
      return;
    }
    throw error;
  }
};

const ensureIsActive = async (fnConfig) => {
  const {
    Configuration: { State: state },
  } = await awsRequest(Lambda, 'getFunction', { FunctionName: fnConfig.name });
  if (state !== 'Active') await ensureIsActive(fnConfig);
};

const invoke = async (fnConfig, testConfig) => {
  const { invokeOptions = {} } = testConfig;

  const payload = invokeOptions.payload || {};
  log.debug('invoke request payload %O', payload);
  const result = await awsRequest(Lambda, 'invoke', {
    FunctionName: fnConfig.name,
    Payload: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
  try {
    const responsePayload = JSON.parse(Buffer.from(result.Payload));
    log.debug('invoke response payload %O', responsePayload);
    log.debug('invoke response parsed payload %O', JSON.parse(responsePayload.body));
  } catch {
    /* ignore */
  }
  if (result.FunctionError) {
    if (invokeOptions.isFailure) return;
    throw new Error(`Invocation errored: ${result.FunctionError}`);
  }
};

const deleteFunction = async (fnConfig) => {
  await awsRequest(Lambda, 'deleteFunction', { FunctionName: fnConfig.name });
};

const retrieveReports = async (fnConfig) => {
  const retrieveReportEvents = async () => {
    try {
      return (
        await awsRequest(CloudWatchLogs, 'filterLogEvents', {
          startTime: fnConfig.invokeStartTime,
          logGroupName: `/aws/lambda/${fnConfig.name}`,
        })
      ).events;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        log.info('log group not ready, wait and retry %s', fnConfig.basename);
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

  log.info('Obtained reports %s %o', fnConfig.basename, reports);
  return reports;
};

module.exports = async (handlerModuleName, testConfig, coreConfig) => {
  ensureNpmDependencies('test/fixtures/lambdas');
  const fnConfig = {
    handlerModuleName,
    basename: handlerModuleName.includes('/') ? path.dirname(handlerModuleName) : handlerModuleName,
    codeZipBuffer: await resolveDirZipBuffer(fixturesDirname),
  };
  fnConfig.name = `${basename}-${fnConfig.basename}`;

  log.info('Create function %s', fnConfig.basename);
  await create(fnConfig, coreConfig, testConfig);

  log.info('Ensure function is active %s', fnConfig.basename);
  await ensureIsActive(fnConfig);

  fnConfig.invokeStartTime = Date.now();
  log.info('Invoke function #1 %s', fnConfig.basename);
  await invoke(fnConfig, testConfig);

  log.info('Invoke function #2 %s', fnConfig.basename);
  await invoke(fnConfig, testConfig);

  log.info('Delete function %s', fnConfig.basename);
  await deleteFunction(fnConfig);

  log.info('Retrieve list of written reports %s', fnConfig.basename);
  return { reports: await retrieveReports(fnConfig) };
};
