import logging
import time
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
    timestamp=time.perf_counter_ns(),
    tags: Tags = Tags(),
    type="handledUser",
    name=None,
    stack=None,
):
    captured_event = CapturedEvent("telemetry.error.generated.v1", timestamp)
    tags = {
        "type": TYPE_MAP[type],
    }
    if isinstance(error, Exception):
        tags["name"] = type(error).__name__
        tags["message"] = str(error)
    else:
        tags["name"] = name or type(error).__name__
        tags["message"] = str(error)
    tags["stacktrace"] = stack or resolve_stack_trace_string(error)
    captured_event.tags.update(tags, prefix="error")

    logging.error({
        "source": "serverlessSdk",
        "type": "ERROR_TYPE_CAUGHT_USER",
        "name": tags["name"],
        "message": tags["message"],
        "stack": tags["stacktrace"],
    })
    return captured_event
