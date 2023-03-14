# Serverless SDK

## Properties and methods of the `serverlessSdk`

### `.name`

Name of the used SDK package. By default `serverless-sdk`, but if environment extension is used, it's overriden (to e.g. `serverless-aws-lambda-sdk`)

### `.version`

Package version

### `.org_id`

Authenticated Serverless Console organization id

### `.trace_spans`

Dictionary of common spans created in context of given environment

### `.capture_error(error[, tags])`

Record captured error. Captured error is sent to Serverless Console backend and printed to the stdout in structured format (writing to stdout can be disabled with `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` env var)

- `error` - Captured error
- `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _string_, _boolean_, _number_, Date or Array containing any values of prior listed types
