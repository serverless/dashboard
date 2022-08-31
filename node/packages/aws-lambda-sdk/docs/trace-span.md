# TraceSpan

_New trace span can be created by invoking a `createSubSpan` method on currently ongoing span._

## Properties

### `name` _(string)_

Span name

### `traceId` _(string)_

Id of a trace (same for all spans in a trace)

### `spanId` _(string)_

Id of a span, unique for each span

### `startTime` _(bigInt)_

High-resolution nanoseconds timestamp, result of [`process.hrtime.bigint()`](https://nodejs.org/api/process.html#processhrtimebigint) (not an epoch timestamp)

### `endTime` _(bigInt)_

High-resolution Nanoseconds timestamp, result of [`process.hrtime.bigint()`](https://nodejs.org/api/process.html#processhrtimebigint) (not an epoch timestamp)

### `parentSpan` _(TraceSpan)_

Parent `TraceSpan` (`null` in case of a root span)

### `subSpans` _(Set(...TraceSpan))_

Set of all direct sub spans

### `spans` _(Set(...TraceSpan))_

Set of all descendant spans (dynamically resolved)

### `tags` _(Map)_

Map of tags set on a span.

Tag name must be a string that is `.` separated list of `[a-z][a-z0-9]*` tokens

Tag value can be _boolean_, _number_ or _string_. Date can also be passed as a _value_ input, but it'll be normalized to ISO string.

#### `tags.setMany(tags[, options)`

Set many tags at once.

- `tags` - Plain object, key value map of tags

Supported options

- `prefix` - Tag name prefix for all tags

## Methods

### `createSubSpan(name[, options])`

Create a sub span of an ongoing span. (invoking this method on closed span will result with exception).

- `name` - Name of the span
- `options` - Optional setup:
  - `startTime` _(bigInt)_ - Externally recorded span _start time_. If not provided, it's resolved automatically on span creation. It cannot be set in a future, and must not be past of `traceSpan.startTime`
  - `immediateDescendants` _([...string])_ - If intention is to create sub span descenant sub spans at once, names of those spans can be passed with this option. Descendant spans will be created automatically and will share same `startTime` as top sub span
  - `tags` _(object)_ - Tags to be set on created span (does not apply to eventual descendants as enforced via `immediateDescendants` option)

### `close([options])`

Closes span and all sub spans.

Supported options:

- `endTime` - Externally recorded _end time_. If not provided, it's resolved automatically. Cannot be earlier than `startTime` and cannot be set in a future

#### `toJSON()`

Returns JSON representation of the span
