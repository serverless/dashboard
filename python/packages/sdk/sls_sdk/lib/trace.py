from __future__ import annotations
from collections.abc import Iterable
import logging
import time
from typing import List, Optional, Callable
from contextvars import ContextVar
from backports.cached_property import cached_property  # available in Python >=3.8
from typing_extensions import Final, Self
import json
from .timing import to_protobuf_epoch_timestamp
from ..base import Nanoseconds, TraceId
from ..exceptions import (
    ClosureOnClosedSpan,
    FutureSpanStartTime,
    InvalidType,
    UnreachableTrace,
    PastSpanEndTime,
    FutureSpanEndTime,
)
from .emitter import event_emitter
from .id import generate_id
from .name import get_resource_name
from .tags import Tags, convert_tags_to_protobuf

logger = logging.getLogger(__name__)


__all__: Final[List[str]] = [
    "TraceSpan",
]


TraceSpanContext = ContextVar[Optional["TraceSpan"]]


ctx: Final[TraceSpanContext] = ContextVar("ctx", default=None)
root_span: Optional[TraceSpan] = None


class TraceSpan:
    parent_span: Self
    name: str
    start_time: Nanoseconds
    end_time: Optional[Nanoseconds] = None
    _input: Optional[str] = None
    _output: Optional[str] = None
    tags: Tags
    custom_tags: Tags
    sub_spans: List[Self]
    _on_close_by_root: Optional[Callable] = None

    def __init__(
        self,
        name: str,
        input: Optional[str] = None,
        output: Optional[str] = None,
        start_time: Optional[Nanoseconds] = None,
        tags: Optional[Tags] = None,
        immediate_descendants: Optional[List[str]] = None,
        on_close_by_root: Optional[Callable] = None,
    ):
        self._set_name(name)
        self.input = input
        self.output = output
        self.sub_spans = []

        self._set_start_time(start_time)
        self._set_tags(tags)
        self._set_spans(immediate_descendants)
        self._on_close_by_root = on_close_by_root

    @staticmethod
    def resolve_current_span() -> Optional[TraceSpan]:
        span = ctx.get(None)
        return span or root_span or None

    def _set_spans(self, immediate_descendants: Optional[List[str]]):
        self._set_span_hierarchy()
        ctx.set(self)
        if immediate_descendants and len(immediate_descendants) > 0:
            TraceSpan(
                immediate_descendants.pop(0),
                start_time=self.start_time,
                immediate_descendants=immediate_descendants,
            )

    def _set_span_hierarchy(self):
        global root_span
        if root_span is None:
            root_span = self
            self.parent_span = None
        else:
            if root_span.end_time is not None:
                raise UnreachableTrace("Cannot initialize span: Trace is closed")

            self.parent_span = TraceSpan.resolve_current_span()
            while self.parent_span.end_time:
                self.parent_span = self.parent_span.parent_span or root_span

        if self.parent_span:
            self.parent_span.sub_spans.append(self)

    def _set_name(self, name):
        self.name = get_resource_name(name)

    def _set_tags(self, tags: Optional[Tags]):
        self.tags = Tags()
        self.custom_tags = Tags()

        if tags is not None:
            self.tags.update(tags)

    def _set_start_time(self, start_time: Optional[Nanoseconds]):
        default_start = time.perf_counter_ns()

        if start_time is not None and not isinstance(start_time, Nanoseconds):
            raise InvalidType("`start_time` must be an integer.")

        if start_time is not None and start_time > default_start:
            raise FutureSpanStartTime(
                "Cannot initialize span: Start time cannot be set in the future"
            )
        self.start_time = start_time or default_start

    @cached_property
    def id(self) -> TraceId:
        return generate_id()

    @cached_property
    def trace_id(self) -> TraceId:
        parent = self.parent_span

        if parent is self:
            return generate_id()

        return parent.trace_id if parent else generate_id()

    @property
    def spans(self) -> List[TraceSpan]:
        return [self] + list(_flatten([s.spans for s in self.sub_spans]))

    @property
    def output(self) -> str:
        return self._output

    @output.setter
    def output(self, value: str):
        if value is not None and not isinstance(value, str):
            raise InvalidType("`output` must be a string.")

        self._output = value

    @property
    def input(self) -> str:
        return self._input

    @input.setter
    def input(self, value: str):
        if value is not None and not isinstance(value, str):
            raise InvalidType("`input` must be a string.")

        self._input = value

    def close(self, end_time: Optional[Nanoseconds] = None):
        default: Nanoseconds = time.perf_counter_ns()
        target_end_time = end_time

        if self.end_time is not None:
            raise ClosureOnClosedSpan(
                f"Cannot close span ({self.name}): Span already closed"
            )

        if target_end_time:
            if target_end_time < self.start_time:
                raise PastSpanEndTime(
                    "Cannot close span: End time cannot be earlier than start time"
                )
            if target_end_time > default:
                raise FutureSpanEndTime(
                    "Cannot close span: End time cannot be set in the future"
                )

        self.end_time = default if end_time is None else end_time
        if self is root_span:
            # if this is the root span, check if there are any leftovers
            # and finally reset root_span and reset the context
            left_over_spans = []
            for sub_span in self.spans:
                if not sub_span.end_time:
                    if sub_span._on_close_by_root:
                        sub_span._on_close_by_root()
                    sub_span.close(end_time=self.end_time)
                    left_over_spans.append(sub_span)

            if left_over_spans:
                spans = ", ".join([s.name for s in left_over_spans])
                logger.error(
                    "Serverless SDK Warning: Following trace spans didn't end before"
                    + f" end of lambda invocation: {spans}"
                )
            ctx.set(self)
        else:
            # if this is not the root span and context points to this
            # then we need to reset the context to the first open ancestor span
            if self is ctx.get(None):
                current = self.parent_span
                found = False
                # loop through ancestors
                while current:
                    if not current.end_time:
                        # break at the first open ancestor and store it in the context
                        ctx.set(current)
                        found = True
                        break
                    current = current.parent_span
                if not found:
                    ctx.set(root_span)

        event_emitter.emit("trace-span-close", self)
        return self

    def to_protobuf_dict(self):
        result = {
            "id": self.id,
            "traceId": self.trace_id,
            "parentSpanId": self.parent_span.id if self.parent_span else None,
            "name": self.name,
            "startTimeUnixNano": to_protobuf_epoch_timestamp(self.start_time),
            "endTimeUnixNano": to_protobuf_epoch_timestamp(self.end_time),
            "input": self.input,
            "output": self.output,
            "tags": convert_tags_to_protobuf(self.tags),
        }
        if self.custom_tags:
            result["customTags"] = json.dumps(self.custom_tags)
        return result


def _flatten(xs):
    # https://stackoverflow.com/a/2158532
    for x in xs:
        if isinstance(x, Iterable) and not isinstance(x, (str, bytes)):
            yield from _flatten(x)
        else:
            yield x
