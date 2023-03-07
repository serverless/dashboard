# Serverless SDK

## Properties and methods of the `serverlessSdk`

Common properties for SDK are documented at [SDK API](https://github.com/serverless/console/tree/main/python/packages/sdk/docs/sdk.md)

This document describes properties specific to AWS Lambda SDK

### `.trace_spans`

_For detailed info on spans check [sdk-trace.md](./sdk-trace.md#trace-spans)_

- `root` (also aliased as `aws_lambda`) - Root AWS lambda span
- `aws_lambda_initialization` - Initialization span
- `aws_lambda_invocation` - Invocation span (not available at _initialization_ phase)

### `.instrumentation`

N/A
