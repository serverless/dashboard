from serverless_sdk_schema import TracePayload, RequestResponse


def to_trace_payload(payload_dct: dict) -> TracePayload:
    payload = TracePayload()
    payload.from_dict(payload_dct)
    spans = payload_dct["spans"]
    events = payload_dct["events"]
    for index, span in enumerate(payload.spans):
        span.id = str.encode(spans[index]["id"])
        span.trace_id = str.encode(spans[index]["traceId"])
        span.parent_span_id = (
            str.encode(spans[index]["parentSpanId"])
            if spans[index]["parentSpanId"]
            else None
        )
    for index, event in enumerate(payload.events):
        event.id = str.encode(events[index]["id"])
        event.span_id = (
            str.encode(events[index]["spanId"]) if events[index]["spanId"] else None
        )
        event.trace_id = (
            str.encode(events[index]["traceId"]) if events[index]["traceId"] else None
        )
    return payload


def to_request_response_payload(payload_dct: dict) -> RequestResponse:
    payload = RequestResponse()
    payload.from_dict(payload_dct)
    if payload_dct["spanId"]:
        payload.span_id = str.encode(payload_dct["spanId"])
    if payload_dct["traceId"]:
        payload.trace_id = str.encode(payload_dct["traceId"])
    return payload
