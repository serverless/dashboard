# TraceSpan

## Properties

### `name` _(string)_

Span name

### `trace_id` _(string)_

Id of a trace (same for all spans in a trace)

### `span_id` _(string)_

Id of a span, unique for each span

### `start_time` _(int)_

High-resolution nanoseconds timestamp, result of [`time.perf_counter_ns()`](https://docs.python.org/3/library/time.html#time.perf_counter_ns) (not an epoch timestamp)

### `end_time` _(int)_

High-resolution Nanoseconds timestamp, result of [`time.perf_counter_ns()`](https://docs.python.org/3/library/time.html#time.perf_counter_ns) (not an epoch timestamp)

### `parent_span` _(TraceSpan)_

Parent `TraceSpan` (`None` in case of a root span)

### `sub_spans` _(list(...TraceSpan))_

List of all direct sub spans

### `spans` _(Set(...TraceSpan))_

List of all descendant spans (dynamically resolved)

### `tags` _(dict)_

Dictionary of internal tags set on a span.

### `input` _(string)_

Eventual span input body

### `output` _(string)_

Eventual span output body
