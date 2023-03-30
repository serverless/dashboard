from __future__ import annotations
from typing import List, Optional
import time
import json
from backports.cached_property import cached_property  # available in Python >=3.8
from typing_extensions import Final
from .timing import to_protobuf_epoch_timestamp
from .id import generate_id
from .name import get_resource_name
from .tags import Tags, convert_tags_to_protobuf
from .trace import TraceSpan
from ..exceptions import FutureEventTimestamp
from .emitter import event_emitter
from .error import report as report_error

__all__: Final[List[str]] = [
    "CapturedEvent",
]


class CapturedEvent:
    name: str
    timestamp: int
    tags: Tags
    custom_tags: Tags
    trace_span: Optional[TraceSpan]
    origin: Optional[str]
    custom_fingerprint: Optional[str]

    def __init__(
        self,
        name: str,
        timestamp: Optional[int] = None,
        tags: Optional[Tags] = None,
        custom_tags: Optional[Tags] = None,
        trace_span: Optional[TraceSpan] = None,
        origin: Optional[str] = None,
        custom_fingerprint: Optional[str] = None,
    ):
        trace_span = trace_span or TraceSpan.resolve_current_span()
        default_timestamp = time.perf_counter_ns()
        self.name = get_resource_name(name)
        if origin:
            self.origin = origin

        if timestamp and timestamp > default_timestamp:
            raise FutureEventTimestamp(
                "Cannot intialize captured event Start time cannot be set in the future"
            )
        self.timestamp = timestamp or default_timestamp
        self.custom_fingerprint = custom_fingerprint

        self.tags = Tags()
        if tags:
            self.tags.update(tags)

        self.custom_tags = Tags()
        try:
            if custom_tags:
                self.custom_tags._update(custom_tags)
        except Exception as ex:
            report_error(ex, type="USER")

        self.trace_span = trace_span
        event_emitter.emit("captured-event", self)

    @cached_property
    def id(self) -> str:
        return generate_id()

    def to_protobuf_dict(self):
        return {
            "id": self.id,
            "traceId": self.trace_span.trace_id if self.trace_span else None,
            "spanId": self.trace_span.id if self.trace_span else None,
            "timestampUnixNano": to_protobuf_epoch_timestamp(self.timestamp),
            "eventName": self.name,
            "tags": convert_tags_to_protobuf(self.tags),
            "customTags": json.dumps(self.custom_tags),
            "customFingerprint": self.custom_fingerprint,
        }
