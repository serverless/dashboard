# Serverless SDK

## Properties and methods of the `serverlessSdk`

### `.name`

Name of the used SDK package. By default `@serverless/sdk`, but if environment extension is used, it's overriden (to e.g. `@serverless/aws-lambda-sdk`)

### `.version`

Package version

### `.orgId`

Authenticated Serverless Console organization id

### `.traceSpans`

Dictionary of common spans created in context of given environment

### `.instrumentation`

Most of the instrumentation is setup automatically, still there are scenarios when it's difficult to ensure that (e.g. when target modules are bundled). In such case instrumentation need to be set manually. In context of `@serverless/sdk` following instrumentation extensions are provided:

- `.instrumentation.expressApp.install(express)` - Instrument Express. See [instrumentatiom/express-app](instrumentation/express-app.md)

### `.captureError(error[, options])`

Record captured error. Captured error is sent to Serverless Console backend and printed to the stdout in structured format (writing to stdout can be disabled with `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` env var)

- `error` - Captured error
- `options`:
  - `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
  - `fingerprint` _(string)_ - Console UI groups common errors by the _fingerprint_, which by default is derived from the error stack trace. This can be overriden by passing custom `fingerprint` value

### `.captureWarning(message[, options])`

Record warning. Captured warning is sent to Serverless Console backend and printed to the stdout in structured format (writing to stdout can be disabled with `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` env var)

- `message` - Warning message
- `options`:
  - `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
  - `fingerprint` _(string)_ - Console UI groups common warnings by the _fingerprint_, which by default is derived from its message. This can be overriden by passing custom `fingerprint` value

### `.setTag(name, value)`

Set custom (user defined) trace tag

- `name` _(string)_ - Tag name, can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters
- `value` (any) - Tag value. Can be _string_, _boolean_, _number_, _Date_ or _Array_ containing any values of prior listed types
