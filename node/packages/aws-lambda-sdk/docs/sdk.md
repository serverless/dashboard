# Serverless SDK

If function is instrumented via internal extension, then Serverless SDK is accessible at `serverlessSdk` global variable.

In other cases it can be required (or imported) from `@serverless/aws-lambda-sdk` (note: do not load SDK that way if it's already accessible globally)

## Properties and methods of Serverless SDK

### `serverlessSdk.traceSpans`

_For detailed info on spans check [trace-spans.md](./trace-spans.md)_

- `awsLambda` - Root AWS lambda span
- `awsLambdaInitialization` - Initialization span
- `awsLambdaInvocation` - Invocation span (not available at _initialization_ phase)

### `serverlessSdk.instrument`

Most of the instrumentation is setup automatically, still there are scenarios when it's difficult to ensure that (e.g. when target modules are imported as ESM, or come from bundles). In such case instrumentation need to be set manually, and then following utilities should be used:

- `awsSdkV2(AWS)` - Instrument AWS SDK v2 (takes instance of SDK as the argument)
- `awsSdkV3Client(client)` - Instrument AWS SDK v3 client

### `serverlessSdk.createTraceSpan(name[, options])`

- `name` - Name of the span
- `options` - Optional setup:
  - `startTime` _(bigInt)_ - Externally recorded span _start time_. If not provided, it's resolved automatically on span creation. It cannot be set in a future, and must not be past of `parentSpan.startTime`
  - `immediateDescendants` _([...string])_ - If intention is to create sub span descenant at once, names of those spans can be passed with this option. Descendant spans will be created automatically and will share same `startTime` as top sub span
  - `tags` _(object)_ - Tags to be set on created span (does not apply to eventual descendants as enforced via `immediateDescendants` option)
  - `onCloseByRoot` _(function)_ - If provided, it'll be invoked if span will be autoclosed when closing the invocation trace. Useful for reporting errors in such scenarios
