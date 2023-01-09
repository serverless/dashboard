import pytest


def test_trace_payload_exported():
    try:
        from .. import TracePayload

    except ImportError as e:
        raise AssertionError("TracePayload not exported") from e


def test_request_response_exported():
    try:
        from .. import RequestResponse

    except ImportError as e:
        raise AssertionError("RequestResponse not exported") from e
