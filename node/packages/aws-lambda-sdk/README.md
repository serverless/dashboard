# @serverless/aws-lambda-sdk

## AWS Lambda [Serverless Console](https://www.serverless.com/console) SDK

Instruments AWS Lambda functions, propagates traces to the [Serverless Console](https://www.serverless.com/console/docs) and exposes Serverless SDK to function logic

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. In [Serverless Console](https://console.serverless.com/) turn on integration for your AWS account and chosen Lambdas

#### 3. (optionally) Fine tune default instrumentation behavior with following options

##### `SLS_DISABLE_HTTP_MONITORING` (or `options.disableHttpMonitoring`)

Disable tracing of HTTP and HTTPS requests

##### `SLS_DISABLE_REQUEST_RESPONSE_MONITORING` (or `options.disableRequestResponseMonitoring`)

(Dev mode only) Disable monitoring requests and reponses (function, AWS SDK requests and HTTP(S) requests)

##### `SLS_DISABLE_AWS_SDK_MONITORING` (or `options.disableAwsSdkMonitoring`)

Disable automated AWS SDK monitoring

##### `SLS_DISABLE_EXPRESS_MONITORING` (or `options.disableExpressMonitoring`)

Disable automated express monitoring

### Instrumentation

AWS Lambda SDK automatically creates `aws.lambda`, `aws.lambda.initialization` and `aws.lambda.invocation` trace spans.
For more details see [SDK Trace spans documentation](docs/sdk-trace.md)

Additionally automatic instrumentation (with caveats) is provided for:

- [HTTP(s) requests](https://github.com/serverless/console/tree/main/node/packages/sdk/docs/instrumentation/http.md)
- [express app](https://github.com/serverless/console/tree/main/node/packages/sdk/docs/instrumentation/express-app.md)
- [AWS SDK requests](docs/instrumentation/aws-sdk.md)

### SDK API

- [serverlessSdk](docs/sdk.md)
