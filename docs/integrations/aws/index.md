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
