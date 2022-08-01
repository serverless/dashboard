<!--
title: Instrumenting Manually
menuText: Instrumenting Manually
description: A guide to instrumenting manually using the Serverless Console Extension
menuOrder: 8
-->

# Configuring the Serverless Console Extension (Experimental)
This experimental guide provides an overview of how to setup
the Serverless Console extension without using the Serverless
Framework. If you are having trouble following this guide, 
please [contact support](https://serverless.com/support).

<!--

## Pre-requisites
Before you get started make sure you have the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) a 
[Serverless Console Organization](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F) and [jq](https://stedolan.github.io/jq/download/).


## 1. Request an ingest token.
Ingesting data into console requires a secret, known as an
ingest token. A unique token is issued every 30 days
for the combination of your function name, environment
and namespace. 

To find your org details -
* Go to your org settings page to get your org id  
* Copy your org token as well.

To request an ingest token, run the following command. 
```
curl -X POST \
  'https://core.serverless.com/ingestion/kinesis/token' \
  --header 'Accept: application/json' \
  --header 'sls-token-type: orgToken' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer $ORG_TOKEN' \
  --data-raw '{
        "orgId": "<ORG-ID>",
        "serviceId": "<NAMESPACE>",
        "stage": "<ENVIRONMENT"
}' | jq -r .token.accessToken
```
## 2.Create a config file 

You'll need to setup the config for the extension in a json file.
The following command will create one called sample.json

```text
echo '{ "orgId":"<ORG-ID>","ingestToken":"'<INGEST-TOKEN>","namespace":"<NAMESPACE>", "environment" : "<ENVIRONMENT>"}'  > sample.json
```

```
curl -sL https://github.com/serverless/console/releases/latest/download/sls-otel-extension-node.json -H \"Accept: application/json\" | jq -r '.<REGION>'
```


## 3. Setup your environment variables

```text
aws lambda update-function-configuration --function-name <FUNCTION-NAME> --region <REGION> --environment Variables=SLS_EXTENSION --cli-input-json file://sample.json  && \
aws lambda update-function-configuration --function-name <FUNCTION-NAME> --region <REGION> --environment Variables={AWS_LAMBDA_EXEC_WRAPPER='/opt/otel-extension-internal-node/exec-wrapper.sh'}
```

## 4. Add the layer to your function.

```text
aws lambda update-function-configuration --function-name <FUNCTION-NAME> --region <REGION> \
layers <LAYER_ARN>
```
-->