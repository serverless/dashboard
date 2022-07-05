<!--
title: AWS Lambda
menuText: AWS Lambda
description: An overview of the AWS Lambda Integration
menuOrder: 6
-->

# AWS Lambda

Serverless Console is optimized to work with AWS Lambda, and has planned integration
for further AWS Service integration. This guide provides instructions
for instrumenting AWS Lambda functions about support and details for the
AWS Lambda Integration.

## Runtime Support
We're working to expand our runtime support. 
On AWS Lambda we currently only support Node.js.

## Serverless Console Extension
The Serverless Console Extension is a Lambda Extension that is
used for collecting traces based on the
[Open Telemetry Standards](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/http.md#common-attributes). Currently
it consists of the following components.

### Internal Instrumentation (for Node.js)
In order to collect [span details](traces.md#spans) and [real time logs](logs.md#real-time-logging-in-dev-mode)
a set of Node.js modules is used. This is referred to as the Internal Instrumentation. 
Additional language support will require language specific Open Telemetry Libraries.

### External Extension
In additional to runtime libraries installed by the Serverless Extension, an external
Lambda Extension is used to forward logs, metrics, and traces to
Serverless Console. This component is independent from the language runtime.

## Configuring the Serverless Console Extension
[Serverless Framework](../index.md) is the easiest way to instrument your app or
service with the Serverless Console Extension. If your not using 
Serverless Framework you'll need to build, and deploy the extension 
yourself for each of your Lambdas functions. 

### Pre-requisites
Before you get started make sure you have the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
and a recent version of [Node.js](https://nodejs.dev/learn/how-to-install-nodejs) and a 
[Serverless Console Organization](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F) and [jq](https://stedolan.github.io/jq/download/).

### 1.Clone the repo and install Node modules
Once you have everything you need you'll need to clone this repo
and install node modules.

```text
git clone https://github.com/serverless/console.git
cd console
npm install
```

### 2.Build the extension locally
Next you'll need to run a set of build commands to build
the internal and external extensions.

```
cd node/packages/aws-lambda-otel-extension/external/otel-extension-external
npm install
cd ../../internal/otel-extension-internal-node
npm install
cd ../../
npm run build
```
This will generate an artifact in `dist/extension.zip`

### 3.Publish the extension to your AWS Account
Once you have built the extension, you can publish it 
to your AWS account.

```text
aws lambda publish-layer-version \
   --layer-name sls-otel-extension \
   --zip-file fileb://./dist/extension.zip 
   --region us-east-1 
```

### 4.Request an ingest token
Next you'll need to request an ingest token based on your 
organization id, service name, and environment you wish to
deploy to. It's helpful to set these as environment variables.

* Go to your org settings page to get your org id and org token
* Set the following environment variables (used later)

```text
ORG_ID=<your-org-id> 
ORG_TOKEN=<your-org-token>
NAMESPACE=<your-namespace>
FUNCTION_NAME<name-of-lambda-function>
ENVIRONMENT=dev
REGION=us-east-1
```

*  Curl the following endpoint to get an ingest token.
```
INGEST_TOKEN=$(curl -X POST \
  'https://core.serverless-dev.com/ingestion/kinesis/token' \
  --header 'Accept: application/json' \
  --header 'sls-token-type: orgToken' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer $ORG_TOKEN' \
  --data-raw '{
        "orgId": "$ORG_ID",
        "serviceId": "test-service",
        "stage": "$ENVIRONMENT"
}' | jq -r .token.accessToken)
```
### 5.Configure necessary environment variables and tags

Configure the AWS environment variables using the AWS CLI

```text
aws lambda update-function-configuration --function-name $FUNCTION_NAME --region $REGION --environment Variables= {NAMESPACE=$NAMESPACE}

aws lambda update-function-configuration --function-name $FUNCTION_NAME --region $REGION --environment Variables= {ENVIRONMENT=$ENVIRONMENT}

aws lambda update-function-configuration --function-name $FUNCTION_NAME --region $REGION --environment Variables= {INGEST_TOKEN=$INGEST_TOKEN}

```