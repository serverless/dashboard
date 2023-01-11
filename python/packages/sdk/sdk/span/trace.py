from __future__ import annotations

from time import time_ns
from typing import List, Optional
from contextvars import ContextVar

from backports.cached_property import cached_property  # available in Python >=3.8
from pydantic import BaseModel
from typing_extensions import Final, Self

from ..base import Nanoseconds, TraceId
from ..exceptions import (
    ClosureOnClosedSpan,
    FutureSpanStartTime,
    InvalidType,
    UnreachableTrace,
)
from .id import generate_id
from .name import get_resource_name
from .tags import Tags


__all__: Final[List[str]] = [
    "TraceSpan",
]

NO_SPAN: Final = None


TraceSpanContext = ContextVar[Optional["TraceSpan"]]


ctx: Final[TraceSpanContext] = ContextVar("ctx", default=None)
root_span = None  # type: Optional[TraceSpan]


class TraceSpanBuf(BaseModel):
    """Type-validated intermediate protobuf representation of a TraceSpan"""

    id: bytes
    trace_id: bytes
    parent_span_id: Optional[bytes]
    name: str
    start_time_unix_nano: Nanoseconds
    end_time_unix_nano: Nanoseconds
    tags: Tags
    input: Optional[str]
    output: Optional[str]
    timestamp: Optional[Nanoseconds]
    is_historical: Optional[bool]
    type: Optional[str]


class TraceSpan:
    parent_span: Self
    name: str
    start_time: Nanoseconds
    end_time: Optional[Nanoseconds] = None
    input: Optional[str] = None
    output: Optional[str] = None
    tags: Tags

    def __init__(
        self,
        name: str,
        input: Optional[str] = None,
        output: Optional[str] = None,
        start_time: Optional[Nanoseconds] = None,
        tags: Optional[Tags] = None,
    ):
        self.name = get_resource_name(name)
        self.input = input
        self.output = output

        self._set_start_time(start_time)
        self._set_tags(tags)
        self._set_spans()

    @staticmethod
    def resolve_current_span() -> Optional[TraceSpan]:
        global root_span
        span = TraceSpan._get_span()

        return span or root_span or NO_SPAN

    @staticmethod
    def _get_span() -> Optional[TraceSpan]:
        return ctx.get(NO_SPAN)

    def _set_spans(self):
        self._set_root_span()
        self._set_parent_span()
        self._set_ctx()

    def _set_root_span(self):
        global root_span

        if root_span is NO_SPAN:
            root_span = self
            self.parent_span = NO_SPAN

        elif root_span.end_time is not NO_SPAN:
            raise UnreachableTrace("Cannot initialize span: Trace is closed")

    def _set_parent_span(self):
        global root_span
        self.parent_span = TraceSpan.resolve_current_span()

        while self.parent_span.end_time:
            self.parent_span = self.parent_span.parent_span or root_span

    def _set_ctx(self):
        ctx.set(self)

    def _set_tags(self, tags: Optional[Tags]):
        self.tags = Tags()

        if tags is not None:
            self.tags.update(tags)

    def _set_start_time(self, start_time: Optional[Nanoseconds]):
        default_start = time_ns()

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
    def output(self) -> str:
        return self._output

    @output.setter
    def output(self, value: str):
        if not isinstance(value, str):
            raise InvalidType("`output` must be a string.")

        self._output = value

    def close(self, end_time: Optional[Nanoseconds] = None):
        global root_span
        default: Nanoseconds = time_ns()

        if self.end_time is not None:
            raise ClosureOnClosedSpan("TraceSpan already closed.")

        self.end_time = default if end_time is None else end_time

    def to_protobuf_object(self) -> TraceSpanBuf:
        return TraceSpanBuf(
            id=self.id,
            trace_id=self.trace_id,
            parent_span_id=self.parent_span.id if self.parent_span else None,
            name=self.name,
            start_time_unix_nano=self.start_time,
            end_time_unix_nano=self.end_time,
            tags=self.tags,
            input=self.input,
            output=self.output,
        )
