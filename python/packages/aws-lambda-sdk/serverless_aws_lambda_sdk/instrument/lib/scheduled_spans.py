import time
from typing import Callable
from .sdk import serverlessSdk

serverlessSdk._deferred_telemetry_requests = []

_pending_spans = []
_pending_captured_events = []
_is_scheduled = False


def flush():
    return None


def _flush():
    pass


def _schedule_eventually():
    _pending_spans.clear()
    _pending_captured_events.clear()


def _captured_event_handler(captured_event):
    _pending_captured_events.append(captured_event)
    _schedule_eventually()


def _trace_span_close_handler(trace_span):
    _pending_spans.append(trace_span)
    _schedule_eventually()


if serverlessSdk._is_dev_mode:
    flush = _flush  # noqa: F811
    serverlessSdk._event_emitter.on("captured-event", _captured_event_handler)
    serverlessSdk._event_emitter.on("trace-span-close", _trace_span_close_handler)
