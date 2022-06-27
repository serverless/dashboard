<!--
title: Serverless Console Lambda Extension
menuText: Lambda Extension
description: An overview of the Serverles Runtime
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
In additional to runtime libraries installed by the Severless Extension, an extrnal
Lambda Extension is used to forward logs, metrics, and traces to
Serverless Console. This component is independent from the language runtime.

## Configuring the Serverless Console Extension
[Serverless Framework](../index.md) is the easiest way to instrument your app or
service with the Serverless Console Extension. Additionally, 
it is possible to configure the Serverless Console Extension without 
Serverless Framework. Details about configuring the environemnt variables can
be found in [AWS OTEL Lambda Extension](../../node/packages/aws-lambda-otel-extension/README.md)
