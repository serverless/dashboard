from unittest.mock import MagicMock, call
from serverless_sdk.lib.captured_event import CapturedEvent
from serverless_sdk.lib.trace import TraceSpan
from serverless_sdk_schema import TracePayload
import asyncio
import time
import base64


def test_buffer(reset_sdk_dev_mode):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.dev_mode import ThreadSafeBuffer

    buffer = ThreadSafeBuffer()
    buffer.add_span("span1")
    buffer.add_span("span2")
    buffer.add_captured_event("event1")
    buffer.add_captured_event("event2")

    # when
    spans, events = buffer.get_all()

    # then
    assert spans == ["span1", "span2"]
    assert events == ["event1", "event2"]

    spans, events = buffer.get_all()
    assert spans == []
    assert events == []


def test_dev_mode(reset_sdk_dev_mode, monkeypatch):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.dev_mode

    async def _sleep():
        # mimic behaviour of an http request
        await asyncio.sleep(0.05)

    send_async = MagicMock()
    send_async.side_effect = lambda x, y: _sleep()
    close_session = MagicMock()
    close_session.side_effect = lambda: _sleep()
    monkeypatch.setattr(
        serverless_aws_lambda_sdk.instrument.lib.dev_mode, "send_async", send_async
    )
    monkeypatch.setattr(
        serverless_aws_lambda_sdk.instrument.lib.dev_mode,
        "close_session",
        close_session,
    )
    loop = serverless_aws_lambda_sdk.instrument.lib.dev_mode.get_event_loop()
    trace_body1 = b"trace-body-1"
    trace_body2 = b"trace-body-2"

    # when
    loop.add_captured_event(CapturedEvent("event1"))
    loop.send_telemetry("request-response", trace_body1)
    loop.send_telemetry("request-response", trace_body2)
    loop.add_captured_event(CapturedEvent("event2"))
    # sleep for 100ms to make sure the first two captured events are sent
    time.sleep(0.1)
    # add an event to assert it is sent in a separate network request
    loop.add_captured_event(CapturedEvent("event3"))
    time.sleep(0.1)

    assert loop._buffered_data._pending_spans == []
    assert loop._buffered_data._pending_captured_events == []

    loop.add_span(TraceSpan("span1"))
    time.sleep(0.01)

    loop.add_span(TraceSpan("span2"))

    loop._terminate()

    # then
    assert loop._buffered_data._pending_spans == []
    assert loop._buffered_data._pending_captured_events == []

    assert send_async.call_count == 5
    assert send_async.mock_calls[0] == call("request-response", trace_body1)
    assert send_async.mock_calls[1] == call("request-response", trace_body2)
    assert send_async.call_args_list[2][0][0] == "trace"
    assert send_async.call_args_list[3][0][0] == "trace"

    trace_payload1 = TracePayload.FromString(send_async.call_args_list[2][0][1])
    trace_payload2 = TracePayload.FromString(send_async.call_args_list[3][0][1])
    assert [x.event_name for x in trace_payload1.events] == ["event1", "event2"]
    assert [x.event_name for x in trace_payload2.events] == ["event3"]

    trace_payload3 = TracePayload.FromString(send_async.call_args_list[4][0][1])
    assert [x.name for x in trace_payload3.spans] == ["span1", "span2"]

    close_session.assert_called_once_with()


def test_dev_mode_close_timing(reset_sdk_dev_mode, monkeypatch):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.dev_mode

    async def _sleep():
        # mimic behaviour of an http request
        await asyncio.sleep(0.05)

    send_async = MagicMock()
    send_async.side_effect = lambda x, y: _sleep()
    close_session = MagicMock()
    close_session.side_effect = lambda: _sleep()
    monkeypatch.setattr(
        serverless_aws_lambda_sdk.instrument.lib.dev_mode, "send_async", send_async
    )
    monkeypatch.setattr(
        serverless_aws_lambda_sdk.instrument.lib.dev_mode,
        "close_session",
        close_session,
    )
    loop = serverless_aws_lambda_sdk.instrument.lib.dev_mode.get_event_loop()
    trace_body1 = b"trace-body-1"
    trace_body2 = b"trace-body-2"

    # when
    loop.add_span(TraceSpan("span1"))
    loop.add_captured_event(CapturedEvent("event1"))
    loop.send_telemetry("request-response", trace_body1)
    loop.send_telemetry("request-response", trace_body2)
    loop.add_captured_event(CapturedEvent("event2"))
    loop.add_captured_event(CapturedEvent("event3"))
    loop.add_span(TraceSpan("span2"))

    loop._terminate()

    # then
    assert loop._buffered_data._pending_spans == []
    assert loop._buffered_data._pending_captured_events == []

    assert send_async.call_count == 3
    assert send_async.mock_calls[0] == call("request-response", trace_body1)
    assert send_async.mock_calls[1] == call("request-response", trace_body2)
    assert send_async.call_args_list[2][0][0] == "trace"

    trace_payload = TracePayload.FromString(send_async.call_args_list[2][0][1])
    assert [x.event_name for x in trace_payload.events] == [
        "event1",
        "event2",
        "event3",
    ]
    assert [x.name for x in trace_payload.spans] == [
        "span1",
        "span2",
    ]
