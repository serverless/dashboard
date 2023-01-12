# TraceSpan

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

Map of internal tags set on a span.

### `input` _(string)_

Eventual span input body

### `output` _(string)_

Eventual span output body

## Methods

#### `toJSON()`

Returns JSON representation of the span
