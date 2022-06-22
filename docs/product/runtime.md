<!--
title: Serverless Runtime
menuText: Serverless Runtime
description:An overview of the Serverles Runtime
menuOrder: 4
-->

# Serverless Runtime
Serverless Runtime is a collection of Libararires, Extensions,
and Executables used for collecting traces based on the
[Open Telemetry Standards](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/http.md#common-attributes) in popular FAAS offerings. Currently
it consists of the following components.

## Internal Instrumentation (for Node.js)
In order to collect [span details](traces.md#spans) and [real time logs](logs.md#real-time-logging-in-dev-mode)
a set of Node.js modules is used. This is referred to as the Internal Instrumentation. 
Additional language support will require language specific Open Telemetry Libraries.

## External Extension
In additional to runtime Libraries Serverless Runtime includes an 
Lambda Extension that is used to forward logs, metrics, and traces to
Serverless Console. This component is independent from the language runtime.

## Configuring Serverless Runtime Extension
It is possible to configure the Serverless Runtime Extension without 
Serverless Framework. Details about configuring the environemnt variables can
be found in [AWS OTEL Lambda Extension](../../node/packages/aws-lambda-otel-extension/README.md)
