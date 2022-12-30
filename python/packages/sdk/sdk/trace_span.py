from typing import List

from typing_extensions import Final, Self
from backports.cached_property import cached_property  # available in Python >=3.8

from .base import TraceId
from .generate_ids import generate_id


__all__: Final[List[str]] = [
    "TraceSpan",
]


class TraceSpan:
    id: TraceId
    traceId: TraceId
    parentSpan: Self
    name: str

    def __init__(self, name: str):
        self.name = name

    @cached_property
    def id(self) -> TraceId:
        return generate_id()

    @cached_property
    def traceId(self) -> TraceId:
        parent = self.parentSpan

        return parent.traceId if parent else generate_id()
