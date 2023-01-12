# Serverless SDK

## Properties and methods of the `serverlessSdk`

### `.traceSpans`

Dictionary of common spans created in context of given environment

### `serverlessSdk.instrumentation`

Most of the instrumentation is setup automatically, still there are scenarios when it's difficult to ensure that (e.g. when target modules are imported as ESM, or come from bundles). In such case instrumentation need to be set manually. In context of `@serverless/sdk` following instrumentation extensions are provided:

- `.expressApp.install(express)` - Instrument Express. See [instrumentatiom/express-app](instrumentation/express-app.md)

### `.captureError(error[, options])`

Record captured error

- `error` - Captured error
- `options`:
  - `tags` _(object)_ - User tags object. Tag names can contain only lowercase alphanumeric tokens separated with dot. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
  - `fingerprint` _(string)_ - Console UI groups common errors by the _fingerprint_, which by default is derived from the error stack trace. This can be overriden by passing custom `fingeprint` value

### `.captureWarning(message[, options])`

Record warning

- `message` - Warning message
- `options`:

  - `tags` _(object)_ - User tags object. Tag names can contain only lowercase alphanumeric tokens separated with dot. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
  - `fingerprint` _(string)_ - Console UI groups common warnings by the _fingerprint_, which by default is derived from its message. This can be overriden by passing custom `fingeprint` value
