'use strict';

const serverlessSdk = require('@serverless/sdk');
const pkgJson = require('./package');

module.exports = serverlessSdk;

// Public
serverlessSdk.name = pkgJson.name;
serverlessSdk.version = pkgJson.version;
serverlessSdk.traceSpans.awsLambda = require('./trace-spans/aws-lambda');
serverlessSdk.traceSpans.awsLambdaInitialization = require('./trace-spans/aws-lambda-initialization');

serverlessSdk.instrumentation.awsSdkV2 = require('./instrumentation/aws-sdk-v2');
serverlessSdk.instrumentation.awsSdkV3Client = require('./instrumentation/aws-sdk-v3-client');

serverlessSdk._initializeExtension = (options) => {
  try {
    const settings = serverlessSdk._settings;
    serverlessSdk._settings.disableAwsSdkMonitoring = Boolean(
      process.env.SLS_DISABLE_AWS_SDK_MONITORING || options.disableAwsSdkMonitoring
    );
    if (!settings.disableAwsSdkMonitoring) {
      require('./lib/instrumentation/aws-sdk').install();
    }
  } catch (error) {
    serverlessSdk._reportError(error);
  }
};
serverlessSdk._isDevMode = Boolean(process.env.SLS_DEV_MODE_ORG_ID);

require('@serverless/sdk/lib/instrumentation/http').requestFilters.push((httpOptions) => {
  if (typeof httpOptions.path !== 'string') return true;
  // Do not attempt to trace Lambda Runtime API calls
  // e.g. it's how AWS runtime handles internally response streaming
  return !httpOptions.path.startsWith('/2018-06-01/runtime/');
});
