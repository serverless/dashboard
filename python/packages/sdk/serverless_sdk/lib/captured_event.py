from __future__ import annotations
from typing import List, Optional
import time
from backports.cached_property import cached_property  # available in Python >=3.8
from typing_extensions import Final
from .timing import to_protobuf_epoch_timestamp
from .id import generate_id
from .name import get_resource_name
from .tags import Tags, convert_tags_to_protobuf
from .trace import TraceSpan
from ..exceptions import FutureEventTimestamp


__all__: Final[List[str]] = [
    "CapturedEvent",
]


class CapturedEvent:
    name: str
    timestamp: int
    tags: Tags
    custom_tags: Tags
    trace_span: Optional[TraceSpan]

    def __init__(
        self,
        name: str,
        timestamp: Optional[int] = None,
        tags: Optional[Tags] = None,
        custom_tags: Optional[Tags] = None,
        trace_span: Optional[TraceSpan] = None,
    ):
        trace_span = trace_span or TraceSpan.resolve_current_span()
        default_timestamp = time.perf_counter_ns()
        self.name = get_resource_name(name)
        if timestamp and timestamp > default_timestamp:
            raise FutureEventTimestamp(
                "Cannot intialize captured event Start time cannot be set in the future"
            )
        self.timestamp = timestamp or default_timestamp

        self.tags = Tags()
        if tags:
            self.tags.update(tags)

        self.custom_tags = Tags()
        if custom_tags:
            self.custom_tags.update(custom_tags)

        self.trace_span = trace_span

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
            "customTags": convert_tags_to_protobuf(self.custom_tags),
        }
