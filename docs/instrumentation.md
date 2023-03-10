<!--
title: Instrumentation
menuText: Instrumentation
description: Instrumenting your services with Serverless Console
menuOrder: 2
-->

# Instrumentation

Once you have added the AWS Account Integration, you will need to enable
instrumentation on each AWS Lambda function to enable metric, log, trace, span,
and events collection in Serverless Console.

Currently Instrumentation is supported for the Node.js 14+ runtime only;
however, Python and Go support are coming soon.

## Enabling instrumentation for a function

To enable instrumentation go to **Settings** > **Integrations** and select the
AWS Integration, and click **Edit**.

On the integration settings page you'll have the option to set the
**Instrumentation Mode** to **None**, **Dev**, or **Prod**.

### Instrumentation Mode: Prod

When the **Instrumentation Mode** is set to **Prod**, then metrics, logs,
traces, spans, and events are collected and made available on Metrics and
Explorer in Serverless Console. This mode is optimized for production use, as
it adds virtually no latency to the Lambda function.

### Instrumentation Mode: Dev

When the **Instrumentation Mode** is set to **Dev**, then all the same data is
collected on the function as **Prod**; however, additionally this provides
real-time logging, trace, span, and event collection in [DevMode](./application-guide/dev-mode.md)
on Serverless Console. This mode is intended for development workloads only as
it adds some latency to the AWS Lambda function.

### Instrumentation Mode: None

When the **Instrumentation Mode** is set to **None**, then no data is collected
on the function.

## Custom Instrumentation

In addition to the automatic instrumentation of your AWS Lambda functions, you
can also add custom instrumentation for setting tags, and events in your code. 

Use the [Node.js Serverless SDK](./nodejs.md) to add custom instrumentation.
