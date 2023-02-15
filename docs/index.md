<!--
title: Getting Started
menuText: Getting Started
description: Getting Started with Serverless Console
menuOrder: 1
-->

# Getting Started
Welcome to Serverless Console. 

A Developer focused observability platform for
teams building using Serverless Architectures.

Here's what you need to start using console.

## Onboard using the browser

Sign up and create your organization on [Serverless Console](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F). Follow the prompts to add an AWS Account integration.

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
errors, and warnings, in Serverless Console.

Follow these [Instrumentation steps](./instrumentation.md) to enable
instrumentation on your function.

## Add custom instrumentation (Optional)

In addition to the automatic instrumentation of your AWS Lambda functions, you
can also add custom instrumentation for setting tags, errors, and warnings in
your code. 

Use the [Node.js Serverless SDK](./nodejs.md) to add custom instrumentation.

Python and Go support is coming soon.

## Invoke & Observe

Now you are ready to see your data in Serverless Console.

If you haven't already, invoke your function.

If you set the Instrumentation Mode to Dev, then you'll see the traces, spans,
logs, errors, and warnings in DevMode in real-time.

You'll also be able to use the Metrics and Explorer to view all the metrics,
traces, spans, logs, errors, and warnings. This works with both Dev and Prod
Instrumentation Modes. After an invocation, it may take 3 minutes to be made
available on the Metrics and Explorer pages.
