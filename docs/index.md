<!--
title: Getting Started
menuText: Getting Started
description: Getting Started with Serverless Console
menuOrder: 1
-->

# Getting Started

Welcome to Serverless Console, a developer-first observability service for apps
built on serverless architectures.

Here's what you need to start using console.

## Onboard using the browser

Sign up and create your org on [Serverless Console](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F)
and follow the prompts to [add an AWS account integration](./integrations/aws.md).

## Onboard using the Serverless Framework

If you are a Serverless Framework user, you can onboard to Serverless Console
from the CLI.

Upgrade to version 3.24.0+

```text
npm install -g serverless
```

Run this command to add the AWS Account integration.

```text
serverless --console 
```

You'll need to deploy the function if you haven't already.

```text
serverless deploy
```

Next, you'll need to instrument the newly deployed function from the browser.

## Instrument a function

If you haven't already enabled instrumentation on a function while onboarding,
you'll need to instrument an AWS Lambda function to enable logs, traces, spans,
and events, in Serverless Console.

Follow these [Instrumentation steps](./instrumentation.md) to enable
instrumentation on your function.

## Add custom instrumentation (Optional)

In addition to the automatic instrumentation of your AWS Lambda functions, you
can also add custom instrumentation for setting tags, and events in your code. 

Use the [Node.js](./nodejs-sdk.md) Serverless SDK to add custom instrumentation
to Node.js 12+. Support for Python and Go runtimes is coming soon.

## Invoke & Observe

Now you are ready to see your data in Serverless Console.

If you haven't already, invoke your function.

If you set the Instrumentation Mode to Dev, then you'll see the traces, spans,
logs, and events in DevMode in real-time.

You'll also be able to use the Metrics and Explorer to view all the metrics,
traces, spans, logs, and events. This works with both Dev and Prod
Instrumentation Modes. After an invocation, it may take 3 minutes to be made
available on the Metrics and Explorer pages.
