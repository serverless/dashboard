<!--
title: AWS Lambda
menuText: AWS Lambda
description: An overview of the AWS Lambda Integration
menuOrder: 7
-->


# Serverless Console Extension
The Serverless Console Extension is a Lambda Extension that is
used for collecting traces based on the
[Open Telemetry Standards](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/http.md#common-attributes). Currently
it consists of the following components.

## Internal Instrumentation (for Node.js)
In order to collect [span details](traces.md#spans) and [real time logs](logs.md#real-time-logging-in-dev-mode)
a set of Node.js modules is used. This is referred to as the Internal Instrumentation. 
Additional language support will require language specific Open Telemetry Libraries.

## External Extension
In additional to runtime libraries installed by the Serverless Extension, an external
Lambda Extension is used to forward logs, metrics, and traces to
Serverless Console. This component is independent from the language runtime.

## Configuring the Serverless Console Extension
[Serverless Framework](../index.md) is the easiest way to instrument your app or
service with the Serverless Console Extension. If your not using 
Serverless Framework you'll need to build, and deploy the extension 
yourself for each of your Lambdas functions. 

### Pre-requisites
Before you get started make sure you have the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) a 
[Serverless Console Organization](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F) and [jq](https://stedolan.github.io/jq/download/).


### 1. Request an ingest token.
Ingesting data into console requires a secret, known as an
ingest token. A unique token is issued every 30 days
for the combination of your function name, environment
and namespace. 

In order to streaming this process it's helpful to set these 
as environment variables locally so you can copy/paste the
commands below. 

To find your org details -
* Go to your org settings page to get your org id and org token
* Set the following environment variables (used later)

```text
ORG_ID=<your-org-id> && \
ORG_TOKEN=<your-org-token> && \
NAMESPACE=<your-namespace> && \
FUNCTION_NAME=<name-of-lambda-function> && \
ENVIRONMENT=<your-environment e.g. dev> && \
REGION=us-east-1 
```

*  Next, you can setup an ingest token with the following command.
```
INGEST_TOKEN=$(curl -X POST \
  'https://core.serverless-dev.com/ingestion/kinesis/token' \
  --header 'Accept: application/json' \
  --header 'sls-token-type: orgToken' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer $ORG_TOKEN' \
  --data-raw '{
        "orgId": "$ORG_ID",
        "serviceId": "$NAMESPACE",
        "stage": "$ENVIRONMENT"
}' | jq -r .token.accessToken)
```
### 2.Create a config file 

You'll need to setup the config for the extension in a json file.
The following command will create one called sample.json

```text
echo '{ "orgId":"'$ORG_ID'","ingestToken":"'$INGEST_TOKEN'","namespace":"'$NAMESPACE'", "environment" : "'$ENVIRONMENT'"}'  > sample.json
```

### 3. Setup your environment variables

```text
aws lambda update-function-configuration --function-name $FUNCTION_NAME --region $REGION --environment Variables=SLS_EXTENSION --cli-input-json file://sample.json  && \
aws lambda update-function-configuration --function-name $FUNCTION_NAME --region $REGION --environment Variables={AWS_LAMBDA_EXEC_WRAPPER='/opt/otel-extension-internal-node/exec-wrapper.sh'}
```