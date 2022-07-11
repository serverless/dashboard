from typing import Dict

from opentelemetry.sdk.trace import ReadableSpan, Span
from opentelemetry.trace import SpanContext, format_span_id, format_trace_id

from serverless.aws_lambda_otel_extension.span_attributes.extension import SlsExtensionSpanAttributes

SLS_ORIGINAL_PROPERTIES = SlsExtensionSpanAttributes.SLS_ORIGINAL_PROPERTIES


def telemetry_formatted_span(span: ReadableSpan) -> Dict:

    parent_id = None

    if span.parent is not None:
        if isinstance(span.parent, Span):
            parent_id = format_span_id(span.parent.get_span_context().span_id)
        if isinstance(span.parent, SpanContext):
            parent_id = format_span_id(span.parent.span_id)

    events = []

    for event in span.events:
        events.append(
            {
                "name": event.name,
                "timeUnixNano": str(event.timestamp),
                "attributes": {
                    **span._format_attributes(event.attributes),
                    SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(event.attributes).keys()),
                },
            }
        )

    links = []

    for link in span.links:
        links.append(
            {
                "traceId": format_trace_id(link.context.trace_id),
                "spanId": format_span_id(link.context.span_id),
                "attributes": {
                    **span._format_attributes(link.attributes),
                    SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(link.attributes).keys()),
                },
            }
        )

    data: Dict = {
        "name": span._name,
        "traceId": format_trace_id(span.context.trace_id),
        "spanId": format_span_id(span.context.span_id),
        "parentSpanId": parent_id,
        "kind": f"SPAN_KIND_{span.kind.name}",
        "startTimeUnixNano": str(span._start_time),
        "endTimeUnixNano": str(span._end_time),
        "attributes": {
            **span._format_attributes(span._attributes),
            SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(span._attributes).keys()),
        },
        "events": events,
        "links": links,
        "status": {},
    }

    return data
