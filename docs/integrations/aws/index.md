<!--
title: AWS Lambda
menuText: AWS Lambda
description: An overview of the AWS Lamba Integration
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

### Configuring the Serverless Console Extension
[Serverless Framework](../index.md) is the easiest way to instrument your app or
service with the Serverless Console Extension. If your not using 
Serverless Framework you'll need to build, and deploy the extension 
yourself for each of your Lambdas functions. 
