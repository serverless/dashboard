from __future__ import annotations

from os import environ
from typing import List, Optional

from typing_extensions import Final

from .base import Nanoseconds, SLS_ORG_ID, __version__
from .trace_span import TraceSpan


__all__: Final[List[str]] = [
    "ServerlessSdk",
]


class ServerlessSdk:
    name: Final[str] = __name__
    version: Final[str] = __version__

    traceSpans: Final = ...
    instrumentation: Final = ...

    orgId: Optional[str] = None

    def _initialize(self, org_id: Optional[str] = None):
        self.orgId = environ.get(SLS_ORG_ID, default=org_id)

    def createTraceSpan(
        self,
        name: str,
        input: str,
        output: str,
        start_time: Optional[Nanoseconds] = None,
    ) -> TraceSpan:
        return TraceSpan(name, input, output, start_time)
