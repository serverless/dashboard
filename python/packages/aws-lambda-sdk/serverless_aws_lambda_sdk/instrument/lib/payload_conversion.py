from serverless_sdk_schema import TracePayload, RequestResponse
from google.protobuf import json_format


def to_trace_payload(payload_dct: dict) -> TracePayload:
    return json_format.ParseDict(payload_dct, TracePayload())


def to_request_response_payload(payload_dct: dict) -> RequestResponse:
    return json_format.ParseDict(payload_dct, RequestResponse())
