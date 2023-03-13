from __future__ import annotations

from os import environ
from typing import List, Optional
from typing_extensions import Final
from types import SimpleNamespace

from .base import Nanoseconds, SLS_ORG_ID, __version__, __name__
from .lib import trace
from .lib.captured_event import CapturedEvent
from .lib.tags import Tags
from .lib.error_captured_event import create as create_error_captured_event
from .lib.error import report as report_error


__all__: Final[List[str]] = [
    "serverlessSdk",
]


class TraceSpans(SimpleNamespace):
    @property
    def root(self):
        return trace.root_span


class ServerlessSdk:
    name: Final[str] = __name__
    version: Final[str] = __version__

    trace_spans: TraceSpans
    instrumentation: Final = ...

    org_id: Optional[str] = None
    _captured_events: List[CapturedEvent] = []

    def __init__(self):
        self.trace_spans = TraceSpans()

    def _initialize(self, org_id: Optional[str] = None):
        self.org_id = environ.get(SLS_ORG_ID, default=org_id)

    def _create_trace_span(
        self,
        name: str,
        input: Optional[str] = None,
        output: Optional[str] = None,
        start_time: Optional[Nanoseconds] = None,
        tags: Optional[Tags] = None,
    ) -> trace.TraceSpan:
        return trace.TraceSpan(name, input, output, start_time, tags)

    def capture_error(self, error, **kwargs) -> CapturedEvent:
        try:
            _error = create_error_captured_event(error, **kwargs)
            self._captured_events.append(_error)
            return _error
        except Exception as ex:
            self._captured_events.append(report_error(ex))


serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
