from .imports import internally_imported

with internally_imported():
    from typing import Optional
    import time

from .trace import TraceSpan
from .captured_event import CapturedEvent


def report(message: str, code, trace_span: Optional[TraceSpan] = None):
    return CapturedEvent(
        "telemetry.notice.generated.v1",
        timestamp=time.perf_counter_ns(),
        custom_fingerprint=code,
        tags={
            "notice.message": message,
            "notice.type": 1,
        },
        trace_span=trace_span,
    )
