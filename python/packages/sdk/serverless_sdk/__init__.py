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
from .lib.notice import report as report_notice
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
    disable_request_response_monitoring: bool

    def __init__(
        self,
        disable_captured_events_stdout=False,
        disable_python_log_monitoring=False,
        disable_request_response_monitoring=False,
    ):
        self.disable_captured_events_stdout = (
            bool(environ.get("SLS_DISABLE_CAPTURED_EVENTS_STDOUT"))
            or disable_captured_events_stdout
        )
        self.disable_python_log_monitoring = (
            bool(environ.get("SLS_DISABLE_PYTHON_LOG_MONITORING"))
            or disable_python_log_monitoring
        )
        self.disable_request_response_monitoring = (
            bool(environ.get("SLS_DISABLE_REQUEST_RESPONSE_MONITORING"))
            or disable_request_response_monitoring
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
    _is_dev_mode: bool

    def __init__(self):
        self._is_initialized = False
        self.trace_spans = TraceSpans()
        self._event_emitter = event_emitter
        self._custom_tags = Tags()

        self._report_error = report_error
        self._report_warning = report_warning
        self._report_notice = report_notice

    def _initialize(
        self,
        org_id: Optional[str] = None,
        disable_captured_events_stdout: Optional[bool] = False,
        disable_python_log_monitoring: Optional[bool] = False,
        disable_request_response_monitoring: Optional[bool] = False,
    ):
        if self._is_initialized:
            return
        self.org_id = environ.get(SLS_ORG_ID, default=org_id)
        self._is_debug_mode = bool(environ.get("SLS_SDK_DEBUG"))
        self._is_dev_mode = bool(environ.get("SLS_DEV_MODE_ORG_ID"))
        self._settings = ServerlessSdkSettings(
            disable_captured_events_stdout,
            disable_python_log_monitoring,
            disable_request_response_monitoring,
        )

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
