import logging
import time
from builtins import type as builtins_type
from typing import Optional
from .tags import Tags
from .captured_event import CapturedEvent
from .stack_trace_string import resolve as resolve_stack_trace_string


logger = logging.getLogger(__name__)


TYPE_MAP = {
    "unhandled": 1,
    "handledUser": 2,
    "handledSdkUser": 3,
    "handledSdkInternal": 4,
}


def create(
    error,
    timestamp: Optional[int] = None,
    tags: Optional[Tags] = None,
    type: str = "handledUser",
    name=None,
    stack=None,
    origin: Optional[str] = None,
    fingerprint: Optional[str] = None,
):
    timestamp = timestamp or time.perf_counter_ns()
    tags = tags or Tags()
    captured_event = CapturedEvent(
        "telemetry.error.generated.v1",
        timestamp=timestamp,
        custom_tags=tags,
        origin=origin,
        custom_fingerprint=fingerprint,
    )
    _tags = {
        "type": TYPE_MAP[type],
    }
    if isinstance(error, Exception):
        _tags["name"] = builtins_type(error).__name__
        _tags["message"] = str(error)
    else:
        _tags["name"] = name or builtins_type(error).__name__
        _tags["message"] = str(error)
    _tags["stacktrace"] = stack or resolve_stack_trace_string(error)
    captured_event.tags.update(_tags, prefix="error")

    # to avoid circular dependency, require inline
    from .. import serverlessSdk

    if (
        origin == "pythonLogging"
        or type != "handledUser"
        or serverlessSdk._settings.disable_captured_events_stdout
    ):
        return captured_event

    error_log_data = {
        "source": "serverlessSdk",
        "type": "ERROR_TYPE_CAUGHT_USER",
        "name": _tags["name"],
        "message": _tags["message"],
        "stack": _tags["stacktrace"],
    }
    if fingerprint:
        error_log_data["fingerprint"] = fingerprint
    logger.error(error_log_data)
    return captured_event
