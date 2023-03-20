from __future__ import annotations
import sys
from os import environ
from typing import List, Optional
from typing_extensions import Final
from types import SimpleNamespace

from .base import Nanoseconds, SLS_ORG_ID, __version__, __name__
from .lib import trace
from .lib.emitter import event_emitter, EventEmitter
from .lib.tags import Tags, ValidTags
from .lib.error_captured_event import create as create_error_captured_event
from .lib.warning_captured_event import create as create_warning_captured_event
from .lib.error import report as report_error
from .lib.warning import report as report_warning
from .lib.instrumentation.logging import install as install_logging


__all__: Final[List[str]] = [
    "serverlessSdk",
]


class TraceSpans(SimpleNamespace):
    @property
    def root(self):
        return trace.root_span


class ServerlessSdkSettings:
    disable_captured_events_stdout: bool
    disable_python_log_monitoring: bool

    def __init__(self):
        self.disable_captured_events_stdout = bool(
            environ.get("SLS_DISABLE_CAPTURED_EVENTS_STDOUT")
        )
        self.disable_python_log_monitoring = bool(
            environ.get("SLS_DISABLE_PYTHON_LOG_MONITORING")
        )


class ServerlessSdk:
    name: Final[str] = __name__
    version: Final[str] = __version__
    _event_emitter: EventEmitter

    trace_spans: TraceSpans
    instrumentation: Final = ...

    org_id: Optional[str] = None
    _settings: ServerlessSdkSettings
    _custom_tags: Tags
    _is_initialized: bool
    _is_debug_mode: bool

    def __init__(self):
        self._is_initialized = False
        self.trace_spans = TraceSpans()
        self._event_emitter = event_emitter
        self._settings = ServerlessSdkSettings()
        self._custom_tags = Tags()

        self._report_error = report_error
        self._report_warning = report_warning

    def _initialize(self, org_id: Optional[str] = None):
        if self._is_initialized:
            return
        self.org_id = environ.get(SLS_ORG_ID, default=org_id)
        self._is_debug_mode = bool(environ.get("SLS_SDK_DEBUG"))
        if not self._settings.disable_python_log_monitoring:
            install_logging()

        self._is_initialized = True

    def _create_trace_span(
        self,
        name: str,
        input: Optional[str] = None,
        output: Optional[str] = None,
        start_time: Optional[Nanoseconds] = None,
        tags: Optional[Tags] = None,
    ) -> trace.TraceSpan:
        return trace.TraceSpan(name, input, output, start_time, tags)

    def _debug_log(self, *args):
        if self._is_debug_mode:
            print("⚡ SDK:", *args, file=sys.stderr)

    def capture_error(self, error, **kwargs):
        try:
            create_error_captured_event(error, **kwargs)
        except Exception as ex:
            report_error(ex)

    def capture_warning(self, message: str, **kwargs):
        try:
            create_warning_captured_event(message, **kwargs)
        except Exception as ex:
            report_error(ex)

    def set_tag(self, name: str, value: ValidTags):
        try:
            self._custom_tags[name] = value
        except Exception as ex:
            report_error(ex, type="USER")


serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
