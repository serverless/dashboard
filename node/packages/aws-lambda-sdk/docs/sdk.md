# Serverless SDK

## Properties and methods of the `serverlessSdk`

Common properties for SDK are documented at [SDK API](https://github.com/serverless/console/tree/main/node/packages/sdk/docs/sdk.md)

This document describes properties specific to AWS Lambda SDK

### `.traceSpans`

_For detailed info on spans check [sdk-trace.md](./sdk-trace.md#trace-spans)_

- `root` (also aliased as `awsLambda`) - Root AWS lambda span
- `awsLambdaInitialization` - Initialization span
- `awsLambdaInvocation` - Invocation span (not available at _initialization_ phase)

### `serverlessSdk.instrumentation`

Most of the instrumentation is setup automatically, still there are scenarios when it's difficult to ensure that (e.g. when target modules are imported as ESM, or come from bundles). In such case instrumentation need to be set manually, and then following utilities should be used:

- `awsSdkV2.install(AWS)` - Instrument AWS SDK v2 (takes instance of SDK as the argument). See [instrumentation/aws-sdk](instrumentation/aws-sdk.md)
- `awsSdkV3Client.install(client)` - Instrument AWS SDK v3 client. See [instrumentation/aws-sdk](instrumentation/aws-sdk.md)
- `expressApp.install(express)` - Instrument Express. See [instrumentatiom/express-app](https://github.com/serverless/console/tree/main/node/packages/sdk/docs/instrumentation/express-app.md)
