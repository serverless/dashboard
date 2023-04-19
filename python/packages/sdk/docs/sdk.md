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

### `.capture_error(error[, tags, fingerprint])`

Record captured error. Captured error is sent to Serverless Console backend and printed to the stdout in structured format (writing to stdout can be disabled with `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` env var)

- `error` - Captured error
- `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _str_, _bool_, _int_, _float_, _datetime_ or _List_ containing any values of prior listed types
- `fingerprint` _(str)_ - Console UI groups common warnings by the _fingerprint_, which by default is derived from its message. This can be overriden by passing custom `fingerprint` value

### `.capture_warning(message[, tags, fingerprint])`

Record warning. Captured warning is sent to Serverless Console backend and printed to the stdout in structured format (writing to stdout can be disabled with `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` env var)

- `message` - Warning message
- `tags` _(object)_ - User tags object. Tag names can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters. Values can be _str_, _bool_, _int_, _float_, _datetime_ or _List_ containing any values of prior listed types
- `fingerprint` _(str)_ - Console UI groups common warnings by the _fingerprint_, which by default is derived from its message. This can be overriden by passing custom `fingerprint` value

### `.set_tag(name, value)`

Set custom (user defined) trace tag

- `name` _(str)_ - Tag name, can contain alphanumeric (both lower and upper case), `-`, `_` and `.` characters
- `value` (any) - Tag value. Can be _str_, _bool_, _int_, _float_, _datetime_ or _List_ containing any values of prior listed types

## Thread safety

Public properties and methods of the `serverlessSdk` object is intended to be thread-safe without need for any special measurements to be taken by consumers.
