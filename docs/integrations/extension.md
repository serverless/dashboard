<!--
title: Serverless Console Lambda Extension
menuText: Lambda Extension
description: An overview of the Serverless Runtime
menuOrder: 6
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

<!--
### Pre-requisites
Before you get started make sure you have the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
and a recent version of [Node.js](https://nodejs.dev/learn/how-to-install-nodejs) and a 
[Serverless Console Organization](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F).

### Clone Repo and Install Node Modules

### Build the extension locally

### Publish the extension to your AWS Account

### Request an ingest token

### Configure necessary environment variables and tags

### Re-Deploy your Lambda Function?
-->

