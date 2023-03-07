# serverless-aws-lambda-sdk

## AWS Lambda [Serverless Console](https://www.serverless.com/console) SDK for Python

Instruments AWS Lambda functions, propagates traces to the [Serverless Console](https://www.serverless.com/console/docs) and exposes Serverless SDK to the function logic

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. In [Serverless Console](https://console.serverless.com/) turn on integration for your AWS account and chosen Lambdas

### Instrumentation

AWS Lambda SDK automatically creates `aws.lambda`, `aws.lambda.initialization` and `aws.lambda.invocation` trace spans.

### SDK API

- [serverlessSdk](docs/sdk.md)
