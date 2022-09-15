# Serverless SDK

If function is instrumented via internal extension, then Serverless SDK is accessible at `serverlessSdk` global variable.

In other cases it can be required (or imported) from `@serverless/aws-lambda-sdk` (note: do not load SDK that way if it's already accessible globally)

## Properties and methods of Serverless SDK

### `serverlessSdk.traceSpans`

_For detailed info on spans check [trace-spans.md](./trace-spans.md)_

- `awsLambda` - Root AWS lambda span
- `awsLambdaInitialization` - Initialization span
- `awsLambdaInvocation` - Invocation span (not available at _initialization_ phase)
