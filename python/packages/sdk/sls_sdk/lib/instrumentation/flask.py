import re
from sls_sdk import serverlessSdk
from ..error import report as report_error
from functools import partial

_instrumenter = None


class Instrumenter:
    def __init__(self, flask):
        self._flask = flask
        # Signals https://flask.palletsprojects.com/en/2.2.x/signals/ cover most of the
        # use-cases, except for the case of user exceptions such as http 404.
        # In that case, we need to override the handle_user_exception
        # to create a span for the error. See _handle_user_exception for more details.
        self._signals = [
            (self._flask.appcontext_pushed, self._handle_appcontext_pushed),
            (self._flask.request_started, self._handle_request_started),
            (self._flask.request_finished, self._handle_request_finished),
            (self._flask.got_request_exception, self._handle_got_request_exception),
            (self._flask.appcontext_popped, self._handle_appcontext_popped),
        ]
        self._root_span = None
        self._route_span = None
        self._error_span = None
        self._reported_exception = None

    def sanitize_span_name(self, name):
        if name is None:
            return "unknown"
        return (
            re.sub(r"^\d+", "", re.sub(r"[^0-9a-zA-Z]", "", name)).lower() or "unknown"
        )

    def install(self):
        for signal, handler in self._signals:
            signal.connect(handler)

    def uninstall(self):
        for signal, handler in self._signals:
            signal.disconnect(handler)

    def _handle_user_exception(self, sender):
        # This replaces the default Flask.handle_user_exception method.
        def _instrumented(flask, exception):
            try:
                if not self._error_span:
                    span_name = self.sanitize_span_name(exception.__class__.__name__)
                    self._error_span = serverlessSdk._create_trace_span(
                        f"flask.error.{span_name}"
                    )
                    serverlessSdk.capture_error(exception)
                    self._reported_exception = exception
            except Exception as ex:
                report_error(ex)

            try:
                return self._flask.Flask.handle_user_exception(flask, exception)
            finally:
                self._safe_close([self._error_span])

        return partial(_instrumented, sender)

    def _handle_appcontext_pushed(self, sender, **kwargs):
        if self._root_span:
            return
        if hasattr(sender, "handle_user_exception"):
            sender.handle_user_exception = self._handle_user_exception(sender)
        try:
            self._root_span = serverlessSdk._create_trace_span("flask")
            self._route_span = None
            self._error_span = None
            self._reported_exception = None
        except Exception as ex:
            report_error(ex)

    def _handle_request_started(self, sender, **extra):
        if not self._flask.request.endpoint:
            return
        try:
            span_name = ".".join(
                [
                    "flask",
                    "route",
                    self.sanitize_span_name(self._flask.request.method),
                    self.sanitize_span_name(self._flask.request.endpoint),
                ]
            )
            self._route_span = serverlessSdk._create_trace_span(span_name)
        except Exception as ex:
            report_error(ex)

    def _handle_request_finished(self, sender, response, **extra):
        self._safe_close([self._route_span])

    def _handle_got_request_exception(self, sender, exception, **extra):
        if self._reported_exception is exception:
            return
        try:
            span_name = self.sanitize_span_name(exception.__class__.__name__)
            self._error_span = serverlessSdk._create_trace_span(
                f"flask.error.{span_name}"
            )
            serverlessSdk.capture_error(exception)
            self._reported_exception = exception
        except Exception as ex:
            report_error(ex)

    def _handle_appcontext_popped(self, sender, **kwargs):
        # restore back the original handle_user_exception
        sender.handle_user_exception = (
            lambda *args, **kwargs: self._flask.Flask.handle_user_exception(
                self, *args, **kwargs
            )
        )
        self._safe_close([self._root_span, self._route_span, self._error_span])
        self._root_span = self._route_span = self._error_span = None

    def _safe_close(self, spans):
        try:
            for span in spans:
                if span and not span.end_time:
                    span.close()
            return True
        except Exception as ex:
            report_error(ex)
            return False


def install():
    global _instrumenter
    if _instrumenter:
        return

    try:
        import importlib

        flask = importlib.import_module("flask")
    except ImportError:
        return

    _instrumenter = Instrumenter(flask)
    _instrumenter.install()


def uninstall():
    global _instrumenter
    if not _instrumenter:
        return
    _instrumenter.uninstall()
    _instrumenter = None
