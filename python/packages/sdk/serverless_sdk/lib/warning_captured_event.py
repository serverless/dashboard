import logging
import time
from typing import Optional
from .tags import Tags
from .captured_event import CapturedEvent
from .stack_trace_string import resolve as resolve_stack_trace_string


logger = logging.getLogger(__name__)


TYPE_MAP = {
    "user": 1,
    "sdkUser": 2,
    "sdkInternal": 3,
}


def create(
    message: str,
    tags: Optional[Tags] = None,
    type: str = "user",
    origin: Optional[str] = None,
    fingerprint: Optional[str] = None,
):
    timestamp = time.perf_counter_ns()
    stack_trace = resolve_stack_trace_string()

    tags = tags or Tags()
    captured_event = CapturedEvent(
        "telemetry.warning.generated.v1",
        timestamp=timestamp,
        custom_tags=tags,
        custom_fingerprint=fingerprint,
        tags={
            "warning.message": message,
            "warning.type": TYPE_MAP[type],
            "warning.stacktrace": stack_trace,
        },
        origin=origin,
    )
    # to avoid circular dependency, require inline
    from .. import serverlessSdk

    if (
        origin == "pythonConsole"
        or type != "user"
        or serverlessSdk._settings.disable_captured_events_stdout
    ):
        return captured_event

    warn_log_data = {
        "source": "serverlessSdk",
        "type": "WARNING_TYPE_USER",
        "message": message,
        "stack": stack_trace,
    }
    if fingerprint:
        warn_log_data["fingerprint"] = fingerprint
    logger.warning(warn_log_data)
    return captured_event
