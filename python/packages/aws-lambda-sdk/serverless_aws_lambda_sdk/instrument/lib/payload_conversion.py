from serverless_sdk_schema import TracePayload, RequestResponse
from google.protobuf import json_format


def to_trace_payload(payload_dct: dict) -> TracePayload:
    spans = payload_dct["spans"]
    events = payload_dct["events"]
    payload = json_format.ParseDict(payload_dct, TracePayload())
    for index, span in enumerate(payload.spans):
        span.id = bytes(spans[index]["id"], "utf-8")
        span.trace_id = bytes(spans[index]["traceId"], "utf-8")
        if spans[index]["parentSpanId"]:
            span.parent_span_id = bytes(spans[index]["parentSpanId"], "utf-8")
    for index, event in enumerate(payload.events):
        event.id = bytes(events[index]["id"], "utf-8")
        if events[index]["spanId"]:
            event.span_id = bytes(events[index]["spanId"], "utf-8")
        if events[index]["traceId"]:
            event.trace_id = bytes(events[index]["traceId"], "utf-8")

    return payload


def to_request_response_payload(payload_dct: dict) -> RequestResponse:
    payload = json_format.ParseDict(payload_dct, RequestResponse())
    payload.span_id = bytes(payload_dct["spanId"], "utf-8")
    payload.trace_id = bytes(payload_dct["traceId"], "utf-8")
    return payload
