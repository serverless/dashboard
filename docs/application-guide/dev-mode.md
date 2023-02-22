<!--
title: Dev Mode
menuText: Dev Mode
description: A guide for using logs within Serverless Console
menuOrder: 4
-->

# Dev Mode

Dev Mode is a Serverless Console feature which provides real-time logging,
invocation traces, spans, errors and warnings, for developing AWS Lambda
functions.

To get started you need to [add an AWS Account integration](./integrations/aws.md)
and [enable the Dev Instrumentation Mode](./instrumentation.md).

Once instrumentation is enabled, go to the **Dev Mode** page to view the
real-time stream of traces, spans, errors, and warnings.

Currently Dev Mode is supported on the Node.js 14+ runtime on AWS Lambda only.
Support for Python and Go runtimes is coming soon.

## Real-time Logging

Using log statements is one of the more intuitive approach troubleshooting, and
Serverless Console offers you a best in class experience to using logs 
across your Lambda functions.

All process outputs (e.g. `console.log`, stdout, stderr) will appear in the log
stream in real-time on Dev Mode.

If the logs are formatted as JSON, they will be parsed and pretty formatted on
the output.

## Real-time Errors & Warnings

In addition to logs, Dev Mode can also capture Errors and Warnings.

By default, all strings and Errors are captured with `console.warn` and
`console.error`. Unlike `console.log`, these methods will capture structured
logs, including the stack trace and Error name, if applicable.

For further customization, you can use the [Node.js SDK](../nodejs.md) methods
to capture warnings and errors with custom tags.

## Real Time Traces & Spans

Traces and Spans are available in Dev Mode, just like they are in the Trace
Explorer when Prod Instrumentation Mode is enabled.

However, there are a few differences in instrumentation between Dev and Prod
Instrumentation Modes:

- Dev displays only HTTP and AWS API spans, while the Trace Explorer also
displays Express.js spans.
- Dev captures requests/responses on the Lambda invocation, while in Prod the
request/response are not captured to prevent potentially sensitive information
from being captured.
- Dev captures in the input/outputs on spans, while in Prod the inputs/outputs
on spans are not captured to prevent potentially sensitive information from
being captured.
- Prod traces also provide a more comprehensive Duration breakdown on the
timeline view that is not available in Dev Mode.

## Filtering

The default view for Dev Mode is across all Lambda functions, so you will
likely need to filter to meaningfully utilize Dev Mode. Dev Mode filtering is
limited to AWS Accounts and Resources (function names).

## Inspecting details

All traces, spans, logs, errors, and warnings on the stream in Dev Mode can be
clicked to load the Inspector pane on the right. Details of the trace and
selected item are available in the Inspector view.
