# serverless-aws-lambda-sdk

## AWS Lambda [Serverless Console](https://www.serverless.com/console) SDK for Python

Instruments AWS Lambda functions, propagates traces to the [Serverless Console](https://www.serverless.com/console/docs) and exposes Serverless SDK to the function logic.

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. In [Serverless Console](https://console.serverless.com/) turn on integration for your AWS account and chosen Lambdas

#### 3. (optionally) Fine tune default instrumentation behavior with following options

##### `SLS_DISABLE_HTTP_MONITORING` (or `disable_http_monitoring`)

Disable tracing of HTTP and HTTPS requests

##### `SLS_DISABLE_REQUEST_RESPONSE_MONITORING` (or `disable_request_response_monitoring`)

(Dev mode only) Disable monitoring requests and reponses (function, AWS SDK requests and HTTP(S) requests)

##### `SLS_DISABLE_AWS_SDK_MONITORING` (or `options.disableAwsSdkMonitoring`)

Disable automated AWS SDK monitoring

### Instrumentation

AWS Lambda SDK automatically creates `aws.lambda`, `aws.lambda.initialization` and `aws.lambda.invocation` trace spans.
For more details see [SDK Trace spans documentation](docs/sdk-trace.md)

Additionally automatic instrumentation (with caveats) is provided for:

- [HTTP(s) requests](/python/packages/sdk/docs/instrumentation/http.md)
- [Flask app](/python/packages/sdk/docs/instrumentation/flask-app.md)
- [AWS SDK requests](docs/instrumentation/aws-sdk.md)

### SDK API

- [serverlessSdk](docs/sdk.md)
