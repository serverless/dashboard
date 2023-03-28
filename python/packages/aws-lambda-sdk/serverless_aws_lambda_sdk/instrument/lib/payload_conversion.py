from serverless_sdk_schema import TracePayload, RequestResponse
from google.protobuf import json_format


def to_trace_payload(payload_dct: dict) -> TracePayload:
    payload = json_format.ParseDict(payload_dct, TracePayload())
    return payload


def to_request_response_payload(payload_dct: dict) -> RequestResponse:
    payload = json_format.ParseDict(payload_dct, RequestResponse())
    if payload_dct["spanId"]:
        payload.span_id = str.encode(payload_dct["spanId"])
    if payload_dct["traceId"]:
        payload.trace_id = str.encode(payload_dct["traceId"])
    return payload
