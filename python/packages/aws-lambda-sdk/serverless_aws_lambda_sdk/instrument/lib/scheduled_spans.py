import time
import os
import json
from .sdk import serverlessSdk
from .invocation_context import get as get_invocation_context
from .telemetry import send as send_telemetry
from .payload_conversion import to_trace_payload


def flush():
    pass


if serverlessSdk._is_dev_mode:
    _pending_spans = []
    _pending_captured_events = []
    _last_flush_time = 0

    def _flush(force=True):
        global _last_flush_time
        if not _pending_spans and not _pending_captured_events:
            _last_flush_time = time.perf_counter_ns()
            return

        def _convert_span(span):
            span_payload = span.to_protobuf_dict()
            del span_payload["input"]
            del span_payload["output"]
            return span_payload

        # If flush is not forced and last flush was dobe 50ms ago, do nothing
        if not force and time.perf_counter_ns() - _last_flush_time < 50_000_000:
            return

        payload = {
            "slsTags": {
                "orgId": serverlessSdk.org_id,
                "service": os.environ.get("AWS_LAMBDA_FUNCTION_NAME", None),
                "sdk": {
                    "name": serverlessSdk.name,
                    "version": serverlessSdk.version,
                },
            },
            "spans": [_convert_span(s) for s in _pending_spans],
            "events": [e.to_protobuf_dict() for e in _pending_captured_events],
            "customTags": json.dumps(serverlessSdk._custom_tags),
        }
        _pending_spans.clear()
        _pending_captured_events.clear()
        if not get_invocation_context():
            payload["spans"] = [
                s for s in payload["spans"] if s["name"] != "aws.lambda"
            ]

        send_telemetry("trace", bytes(to_trace_payload(payload)))
        _last_flush_time = time.perf_counter_ns()

    def _should_force_flush():
        context = get_invocation_context()
        return context and context.get_remaining_time_in_millis() < 50

    def _captured_event_handler(captured_event):
        _pending_captured_events.append(captured_event)
        _flush(_should_force_flush())

    def _trace_span_close_handler(trace_span):
        _pending_spans.append(trace_span)
        _flush(_should_force_flush())

    serverlessSdk._event_emitter.on("captured-event", _captured_event_handler)
    serverlessSdk._event_emitter.on("trace-span-close", _trace_span_close_handler)
    flush = _flush  # noqa: F811
