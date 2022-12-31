from __future__ import annotations

from typing_extensions import Final, Self
from typing import Dict, List, Optional
from time import time_ns

from backports.cached_property import cached_property  # available in Python >=3.8

from .base import Nanoseconds, TraceId, ValidTags
from .generate_ids import generate_id
from .get_ensure_resource_name import get_ensure_resource_name


__all__: Final[List[str]] = [
    "TraceSpan",
]


class TraceSpan:
    parentSpan: Self
    name: str
    startTime: Nanoseconds
    input: str
    output: str
    tags: Dict[str, ValidTags]

    def __init__(
        self,
        name: str,
        input: str,
        output: str,
        start_time: Optional[Nanoseconds] = None,
    ):
        self.name = get_ensure_resource_name(name)
        self.input = input
        self.output = output
        self._set_start_time(start_time)

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
