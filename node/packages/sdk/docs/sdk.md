# Serverless SDK

## Properties and methods of the `serverlessSdk`

### `.traceSpans`

Dictionary of common spans created in context of given environment

### `serverlessSdk.instrumentation`

Most of the instrumentation is setup automatically, still there are scenarios when it's difficult to ensure that (e.g. when target modules are imported as ESM, or come from bundles). In such case instrumentation need to be set manually. In context of `@serverless/sdk` following instrumentation extensions are provided:

- `.expressApp.install(express)` - Instrument Express. See [instrumentatiom/express-app](instrumentation/express-app.md)

### `.createTraceSpan(name[, options])`

Create custom trade span

- `name` - Name of the span
- `options` - Optional setup:
  - `startTime` _(bigInt)_ - Externally recorded span _start time_. If not provided, it's resolved automatically on span creation. It cannot be set in a future, and must not be set before `startTime` of the currently ongoing span
  - `immediateDescendants` _([...string])_ - If intention is to create sub span descenant at once, names of those spans can be passed with this option. Descendant spans will be created automatically and will share same `startTime` as top sub span
  - `onCloseByRoot` _(function)_ - If provided, it'll be invoked if span will be autoclosed when closing the invocation trace. Useful for reporting errors in such scenarios

Returns instance of [TraceSpan](trace-span.md)

### `.captureError(error[, options])`

Record captured error

- `error` - Captured error
- `options`:
  - `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
  - `fingerprint` _(string)_ - Console UI groups common errors by the _fingerprint_, which by default is derived from the error stack trace. This can be overriden by passing custom `fingeprint` value

### `.captureWarning(message[, options])`

Record warning

- `message` - Warning message
- `options`:
  - `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
  - `fingerprint` _(string)_ - Console UI groups common warnings by the _fingerprint_, which by default is derived from its message. This can be overriden by passing custom `fingeprint` value
