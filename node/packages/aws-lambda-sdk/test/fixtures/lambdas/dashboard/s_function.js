var serverlessSDK = require('./serverless_sdk/index.js');
serverlessSDK = new serverlessSDK({
  orgId: 'integration',
  applicationName: 'integration',
  appUid: 'CzBcDrZ2RwD76YbRQS',
  orgUid: 'PDxHFZVJfCK8X8274S',
  deploymentUid: '54924c73-b5ba-451d-96b0-26cdaf8ea012',
  serviceName: 'test-issue-sc-816',
  shouldLogMeta: true,
  shouldCompressLogs: true,
  disableAwsSpans: false,
  disableHttpSpans: false,
  stageName: 'dev',
  serverlessPlatformStage: 'dev',
  devModeEnabled: false,
  accessKey: null,
  pluginVersion: '6.2.3',
  disableFrameworksInstrumentation: false,
});

const handlerWrapperArgs = { functionName: 'test-issue-sc-816-dev-function', timeout: 6 };

try {
  const userHandler = require('./index.js');
  module.exports.handler = serverlessSDK.handler(userHandler.handler, handlerWrapperArgs);
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => {
    throw error;
  }, handlerWrapperArgs);
}
