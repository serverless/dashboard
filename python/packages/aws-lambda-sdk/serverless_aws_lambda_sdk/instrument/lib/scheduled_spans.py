from .sdk import serverlessSdk
from .invocation_context import get as get_invocation_context

serverlessSdk._deferred_telemetry_requests = []


def flush():
    pass


if serverlessSdk._is_dev_mode:
    _pending_spans = []
    _pending_captured_events = []
    _is_scheduled = False

    def _flush():
        pass

    def _schedule_eventually():
        global _is_scheduled
        if _is_scheduled:
            return
        _is_scheduled = True
        context = get_invocation_context()
        sleep_seconds = (
            min(
                50,
                max(0, context.get_remaining_time_in_millis() - 50 if context else 50),
            )
            / 1000
        )
        _pending_spans.clear()
        _pending_captured_events.clear()

    def _captured_event_handler(captured_event):
        _pending_captured_events.append(captured_event)
        _schedule_eventually()

    def _trace_span_close_handler(trace_span):
        _pending_spans.append(trace_span)
        _schedule_eventually()

    # serverlessSdk._event_emitter.on("captured-event", _captured_event_handler)
    # serverlessSdk._event_emitter.on("trace-span-close", _trace_span_close_handler)
    flush = _flush  # noqa: F811
