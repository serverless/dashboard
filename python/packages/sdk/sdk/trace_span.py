from __future__ import annotations

from time import time_ns
from typing import List, Optional

from backports.cached_property import cached_property  # available in Python >=3.8
from typing_extensions import Final, Self

from .base import Nanoseconds, TraceId
from .generate_ids import generate_id
from .resource_name import get_resource_name
from .tags import Tags


__all__: Final[List[str]] = [
    "TraceSpan",
]


class TraceSpan:
    parentSpan: Self
    name: str
    startTime: Nanoseconds
    endTime: Optional[Nanoseconds]
    input: Optional[str]
    output: Optional[str]
    tags: Tags

    def __init__(
        self,
        name: str,
        input: Optional[str] = None,
        output: Optional[str] = None,
        start_time: Optional[Nanoseconds] = None,
        tags: Optional[Tags] = None
    ):
        self.name = get_resource_name(name)
        self.input = input
        self._output: str = output
        self._set_start_time(start_time)
        self.tags = Tags()

        if tags is not None:
            self.tags.update(tags)

    def _set_start_time(self, start_time: Optional[Nanoseconds]):
        default_start = time_ns()

        if start_time is not None and not isinstance(start_time, Nanoseconds):
            raise TypeError(f"`startTime` must be an integer.")

        self.startTime = start_time or default_start

    @cached_property
    def id(self) -> TraceId:
        return generate_id()

    @cached_property
    def traceId(self) -> TraceId:
        parent = self.parentSpan

        return parent.traceId if parent else generate_id()

    @property
    def output(self) -> str:
        return self._output

    @output.setter
    def output(self, value: str):
        if not isinstance(value, str):
            raise TypeError(f"`output` must be a string.")

        self._output = value

    def close(self, end_time: Optional[Nanoseconds]):
        if self.endTime is not None:
            raise Exception("TraceSpan already closed.")

        self.endTime = time_ns() if end_time is None else end_time
