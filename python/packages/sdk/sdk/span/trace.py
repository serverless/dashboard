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


TraceSpanContext = ContextVar[Optional["TraceSpan"]]


ctx: Final[TraceSpanContext] = ContextVar("ctx", default=None)
root_span = None  # type: Optional[TraceSpan]


class TraceSpanBuf(BaseModel):
    """Type-validated intermediate protobuf representation of a TraceSpan"""

    id: bytes
    trace_id: bytes
    parent_span_id: Optional[bytes]
    name: str
    start_time_unix_nano: int
    end_time_unix_nano: int
    tags: Tags
    input: Optional[str]
    output: Optional[str]
    timestamp: Optional[int]
    is_historical: Optional[bool]
    type: Optional[str]


class TraceSpan:
    parentSpan: Self
    name: str
    startTime: Nanoseconds
    endTime: Optional[Nanoseconds] = None
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
    def resolveCurrentSpan() -> Optional[TraceSpan]:
        global root_span
        span = TraceSpan._get_span()

        return span or root_span or None

    @staticmethod
    def _get_span() -> Optional[TraceSpan]:
        return ctx.get(None)

    def _set_spans(self):
        self._set_root_span()
        self._set_parent_span()
        self._set_ctx()

    def _set_root_span(self):
        global root_span

        if root_span is None:
            root_span = self
            self.parentSpan = None

        elif root_span.endTime is not None:
            raise UnreachableTrace("Cannot initialize span: Trace is closed")

    def _set_parent_span(self):
        self.parentSpan = TraceSpan.resolveCurrentSpan()

        while self.parentSpan.endTime:
            self.parentSpan = self.parentSpan.parentSpan or root_span

    def _set_ctx(self):
        ctx.set(self)

    def _set_tags(self, tags: Optional[Tags]):
        self.tags = Tags()

        if tags is not None:
            self.tags.update(tags)

    def _set_start_time(self, start_time: Optional[Nanoseconds]):
        default_start = time_ns()

        if start_time is not None and not isinstance(start_time, Nanoseconds):
            raise InvalidType("`startTime` must be an integer.")

        if start_time is not None and start_time > default_start:
            raise FutureSpanStartTime(
                "Cannot initialize span: Start time cannot be set in the future"
            )

        self.startTime = start_time or default_start

    @cached_property
    def id(self) -> TraceId:
        return generate_id()

    @cached_property
    def traceId(self) -> TraceId:
        parent = self.parentSpan

        if parent is self:
            return generate_id()

        return parent.traceId if parent else generate_id()

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

        if self.endTime is not None:
            raise ClosureOnClosedSpan("TraceSpan already closed.")

        self.endTime = default if end_time is None else end_time

        if self is root_span:
            ctx.set(None)

    def toProtobufObject(self) -> TraceSpanBuf:
        return TraceSpanBuf(
            id=self.id,
            trace_id=self.traceId,
            parent_span_id=self.parentSpan.id if self.parentSpan else None,
            name=self.name,
            start_time_unix_nano=self.startTime,
            end_time_unix_nano=self.endTime,
            tags=self.tags,
            input=self.input,
            output=self.output,
            # timestamp=time_ns(),
            # is_historical=None,
            # type=None,
        )
