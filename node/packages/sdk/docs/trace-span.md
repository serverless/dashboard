# TraceSpan

_New trace span can be created via [`serverlessSdk.createTraceSpan`](./sdk.md#serverlesssdkcreatetracespanname-options)._

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

### `close([options])`

Closes span and all sub spans.

Supported options:

- `endTime` - Externally recorded _end time_. If not provided, it's resolved automatically. Cannot be earlier than `startTime` and cannot be set in a future

### `closeContext`

After creating a span, this needs to be called if, after a certain point, we do not want to attribute the following logic to the span context

e.g.:

```javascript
const fooSpan = serverlessSdk.createTraceSpan('foo');
runFoo();
// Ensure "bar" trace span is not a sub span of "foo"
fooSpan.closeContext();
const barSpan = serverlessSdk.createTraceSpan('bar');
runBar();
```

### `destroy()`

Permanently removes the span from the trace. Useful if we created span, but logic it was supposed to describe failed to initialize,, e.g.:

```javascript
const fooSpan = serverlessSdk.createTraceSpan('foo');
try {
  runFoo().finally(() => fooSpan.close());
} catch (error) {
  fooSpan.destroy();
  throw error;
}
```

#### `toJSON()`

Returns JSON representation of the span
