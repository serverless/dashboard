from __future__ import annotations

import sls_sdk

from ..imports import internally_imported

with internally_imported():
    import time
    import contextvars
    import contextlib
    from urllib.parse import urlparse
    from urllib.parse import parse_qs
    import io
    from typing import Iterable, Optional, Any

from ..error import report as report_error
from .import_hook import ImportHook
from .wrapper import replace_method


SDK = sls_sdk.serverlessSdk
_IGNORE_FOLLOWING_REQUEST = contextvars.ContextVar("ignore", default=False)


def ignore_following_request():
    _IGNORE_FOLLOWING_REQUEST.set(True)


def reset_ignore_following_request():
    _IGNORE_FOLLOWING_REQUEST.set(False)


_HTTP_SPAN = contextvars.ContextVar("http-span", default=None)


def safe_call(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception:
            return None

    return wrapper


def _decode_bytes(body: bytes, encoding: Optional[str], gzip: Any):
    if encoding == "gzip":
        return gzip.decompress(body).decode("utf-8")
    return body.decode("utf-8")


@safe_call
def _decode_body(body: Any, encoding: Optional[str] = None, gzip: Optional[Any] = None):
    if isinstance(body, bytes):
        return _decode_bytes(body, encoding, gzip)
    elif isinstance(body, str):
        return body
    elif isinstance(body, io.IOBase):
        if body.seekable():
            current_position = body.tell()
            try:
                return _decode_bytes(body.read(), encoding, gzip)
            finally:
                body.seek(current_position)
        elif hasattr(body, "peek"):
            return _decode_bytes(body.peek(), encoding, gzip)
        else:
            return None
    elif isinstance(body, Iterable):
        return _decode_bytes(b"".join(body), encoding, gzip)
    else:
        return None


class BaseInstrumenter:
    def __init__(self, target_module):
        self._import_hook = ImportHook(target_module)
        self._is_installed = False
        self._module = None
        self._gzip = None

    def install(self, should_monitor_request_response):
        if self._is_installed:
            return
        self.should_monitor_request_response = should_monitor_request_response

        if self._import_hook.enabled:
            return

        self._import_hook.enable(self._install)
        self._is_installed = True

        if should_monitor_request_response:
            with internally_imported():
                import gzip

                self._gzip = gzip

    def uninstall(self):
        if not self._is_installed:
            return

        self._import_hook.disable(self._uninstall)
        self._is_installed = False

    def _install(self, module):
        raise NotImplementedError

    def _uninstall(self, module):
        raise NotImplementedError

    def _capture_request_body(
        self, trace_span, body: Any, encoding: Optional[str] = None
    ):
        if not body:
            return
        if not self.should_monitor_request_response:
            return

        decoded = _decode_body(body, encoding, self._gzip)
        if not decoded:
            return
        length = len(decoded)

        if length > SDK._maximum_body_byte_length:
            SDK._report_notice(
                "Large body excluded",
                "INPUT_BODY_TOO_LARGE",
                trace_span,
            )
            return
        try:
            trace_span.input = decoded
        except Exception:
            pass


class NativeAIOHTTPInstrumenter(BaseInstrumenter):
    def __init__(self):
        super().__init__("aiohttp")
        self._original_init = None

    async def _capture_response_body(self, trace_span, response):
        # response is a aiohttp.ClientResponse object
        if not self.should_monitor_request_response or not hasattr(
            response.content, "unread_data"
        ):
            return
        if (
            response.content_length
            and response.content_length > SDK._maximum_body_byte_length
        ):
            SDK._report_notice(
                "Large body excluded",
                "OUTPUT_BODY_TOO_LARGE",
                trace_span,
            )
            return
        try:
            response_body = await response.read()
            response.content.unread_data(response_body)
            if response_body:
                trace_span.output = _decode_body(response_body)
        except Exception as ex:
            report_error(ex)

    async def _on_request_start(self, session, trace_config_ctx, params):
        trace_config_ctx.start_time = time.perf_counter_ns()
        SDK._debug_log("HTTP request")
        trace_config_ctx.trace_span = SDK._create_trace_span(
            f"python.{params.url.scheme}.request",
            start_time=trace_config_ctx.start_time,
        )
        trace_config_ctx.trace_span.tags.update(
            {
                "method": params.method,
                "protocol": "HTTP/1.1",
                "host": f"{params.url.host}:{params.url.port}",
                "path": params.url.path,
                "request_header_names": list(params.headers.keys()),
                "query_parameter_names": list(params.url.query.keys()),
            },
            prefix="http",
        )
        trace_config_ctx.request_body = None

    async def _on_request_chunk_sent(self, session, trace_config_ctx, params):
        if not hasattr(trace_config_ctx, "trace_span"):
            return
        if trace_config_ctx.request_body is None:
            trace_config_ctx.request_body = params.chunk
        else:
            trace_config_ctx.request_body += params.chunk

    async def _on_request_exception(self, session, trace_config_ctx, params):
        if not hasattr(trace_config_ctx, "trace_span"):
            return
        self._capture_request_body(
            trace_config_ctx.trace_span, trace_config_ctx.request_body
        )
        trace_config_ctx.trace_span.tags.update(
            {"error_code": params.exception.__class__.__name__}, prefix="http"
        )
        if trace_config_ctx.trace_span.end_time is None:
            trace_config_ctx.trace_span.close()

    async def _on_request_end(self, session, trace_config_ctx, params):
        if not hasattr(trace_config_ctx, "trace_span"):
            return
        self._capture_request_body(
            trace_config_ctx.trace_span,
            trace_config_ctx.request_body,
            params.headers.get("Content-Encoding")
            if hasattr(params, "headers")
            else None,
        )
        trace_config_ctx.trace_span.tags.update(
            {"status_code": params.response.status}, prefix="http"
        )
        await self._capture_response_body(trace_config_ctx.trace_span, params.response)
        if trace_config_ctx.trace_span.end_time is None:
            trace_config_ctx.trace_span.close()

    def _instrumented_init(self, trace_config):
        def _init(_self, *args, **kwargs):
            if "trace_configs" in kwargs:
                kwargs["trace_configs"].append(trace_config)
            else:
                kwargs["trace_configs"] = [trace_config]
            self._original_init(_self, *args, **kwargs)

        return _init

    def _install(self, module):
        self._module = module
        if hasattr(self._module, "TraceConfig"):
            trace_config = self._module.TraceConfig()
            trace_config.on_request_start.append(self._on_request_start)
            trace_config.on_request_chunk_sent.append(self._on_request_chunk_sent)
            trace_config.on_request_end.append(self._on_request_end)
            trace_config.on_request_exception.append(self._on_request_exception)

            self._original_init = self._module.ClientSession.__init__
            self._module.ClientSession.__init__ = self._instrumented_init(trace_config)

    def _uninstall(self, module):
        if self._original_init:
            self._module.ClientSession.__init__ = self._original_init
        self._module = None


# urllib3 uses the native "http.client" library, this prevents further
# instrumentation in case the request is coming from urllib3
# or other higher level libraries like requests which make use of urllib3.
_DISABLE_NATIVE_INSTRUMENTATION = contextvars.ContextVar(
    "disable-native-instrumentation", default=False
)


class NativeHTTPInstrumenter(BaseInstrumenter):
    def __init__(self):
        super().__init__("http.client")
        self._original_request = None
        self._original_getresponse = None

    def _instrumented_request(self):
        # See https://docs.python.org/3/library/http.client.html#http.client.HTTPConnection.request
        # for the signature of the request method
        def _func(_self, method, url, body=None, headers={}, *, encode_chunked=False):
            if _IGNORE_FOLLOWING_REQUEST.get() or _DISABLE_NATIVE_INSTRUMENTATION.get():
                return self._original_request(
                    _self, method, url, body, headers, encode_chunked=encode_chunked
                )
            start_time = time.perf_counter_ns()

            SDK._debug_log("HTTP request")
            protocol = (
                "https" if _self.__class__.__name__ == "HTTPSConnection" else "http"
            )

            trace_span = SDK._create_trace_span(
                f"python.{protocol}.request",
                start_time=start_time,
            )
            _HTTP_SPAN.set(trace_span)

            try:
                parsed_path = urlparse(url)
                query = parse_qs(parsed_path.query)
                trace_span.tags.update(
                    {
                        "method": method,
                        "protocol": "HTTP/1.1",
                        "host": f"{_self.host}:{_self.port}",
                        "path": parsed_path.path,
                        "request_header_names": [h for h in headers.keys()],
                        "query_parameter_names": [q for q in query.keys()],
                    },
                    prefix="http",
                )
                self._capture_request_body(
                    trace_span, body, headers.get("Content-Encoding")
                )

                self._original_request(
                    _self, method, url, body, headers, encode_chunked=encode_chunked
                )
            except Exception as ex:
                trace_span = _HTTP_SPAN.get()
                trace_span.tags["http.error_code"] = ex.__class__.__name__
                if trace_span.end_time is None:
                    trace_span.close()
                raise

        return _func

    def _instrumented_getresponse(self):
        # See https://docs.python.org/3/library/http.client.html#http.client.HTTPConnection.getresponse
        # for the signature of the getresponse method
        def _func(_self, *args, **kwargs):
            trace_span = _HTTP_SPAN.get()
            if (
                not trace_span
                # or trace_span.tags.get("http.method") is None
                or _IGNORE_FOLLOWING_REQUEST.get()
                or _DISABLE_NATIVE_INSTRUMENTATION.get()
            ):
                return self._original_getresponse(_self, *args, **kwargs)

            try:
                response = self._original_getresponse(_self, *args, **kwargs)
                trace_span.tags["http.status_code"] = response.status
                self._capture_response_body(trace_span, response)
                return response
            finally:
                if trace_span.end_time is None:
                    trace_span.close()

        return _func

    def _capture_response_body(self, trace_span, response):
        if not self.should_monitor_request_response:
            return
        if response.length > SDK._maximum_body_byte_length:
            SDK._report_notice(
                "Large body excluded",
                "OUTPUT_BODY_TOO_LARGE",
                trace_span,
            )
            return
        try:
            response_body = response.peek()
            if response_body:
                trace_span.output = _decode_body(response_body)
        except Exception as ex:
            report_error(ex)

    def _install(self, module):
        self._module = module
        self._original_request = self._module.HTTPConnection.request
        self._original_getresponse = self._module.HTTPConnection.getresponse
        self._module.HTTPConnection.request = self._instrumented_request()
        self._module.HTTPConnection.getresponse = self._instrumented_getresponse()

    def _uninstall(self, module):
        self._module.HTTPConnection.request = self._original_request
        self._module.HTTPConnection.getresponse = self._original_getresponse
        self._module = None


# urllib3 calls the "urlopen" method recursively for certain scenarios like redirects.
# This context variable is used to prevent the instrumented "urlopen" method from
# being called recursively.
_URLLIB3_IS_RECURSIVE_CALL = contextvars.ContextVar(
    "urllib3-recursive-call", default=False
)


class URLLib3Instrumenter(BaseInstrumenter):
    @staticmethod
    @contextlib.contextmanager
    def _prevent_recursive_instrumentation():
        _URLLIB3_IS_RECURSIVE_CALL.set(True)
        _DISABLE_NATIVE_INSTRUMENTATION.set(True)
        try:
            yield
        finally:
            _DISABLE_NATIVE_INSTRUMENTATION.set(False)
            _URLLIB3_IS_RECURSIVE_CALL.set(False)

    def __init__(self):
        super().__init__("urllib3")
        self._target_method = "urlopen"

    def _patched_call(self, actual_url_open, instance, args, kwargs):
        if _IGNORE_FOLLOWING_REQUEST.get() or _URLLIB3_IS_RECURSIVE_CALL.get():
            return actual_url_open(*args, **kwargs)

        start_time = time.perf_counter_ns()
        SDK._debug_log("HTTP request")
        protocol = instance.scheme

        trace_span = SDK._create_trace_span(
            f"python.{protocol}.request",
            start_time=start_time,
        )

        try:
            # see function signature for urlopen method in urllib3
            # https://github.com/urllib3/urllib3/blob/main/src/urllib3/connectionpool.py
            method = args[0] if len(args) > 0 else kwargs.get("method")
            parsed_path = urlparse(args[1] if len(args) > 1 else kwargs.get("url"))
            body = args[2] if len(args) > 2 else kwargs.get("body")
            headers = kwargs.get("headers", {})
            query = parse_qs(parsed_path.query)
            trace_span.tags.update(
                {
                    "method": method,
                    "protocol": "HTTP/1.1",
                    "host": f"{instance.host}:{instance.port}",
                    "path": parsed_path.path,
                    "request_header_names": [h for h in headers.keys()],
                    "query_parameter_names": [q for q in query.keys()],
                },
                prefix="http",
            )
            self._capture_request_body(
                trace_span, body, headers.get("Content-Encoding")
            )

            with URLLib3Instrumenter._prevent_recursive_instrumentation():
                response = actual_url_open(*args, **kwargs)

                trace_span.tags["http.status_code"] = response.status
                self._capture_response_body(trace_span, response)
                return response
        except Exception as ex:
            trace_span.tags["http.error_code"] = ex.__class__.__name__
            raise
        finally:
            if trace_span.end_time is None:
                trace_span.close()

    def _capture_response_body(self, trace_span, response):
        if not self.should_monitor_request_response:
            return

        response_length = int(response.headers.get("Content-Length", 0))
        if response_length > SDK._maximum_body_byte_length:
            SDK._report_notice(
                "Large body excluded",
                "OUTPUT_BODY_TOO_LARGE",
                trace_span,
            )
            return

        response_body = None
        # if data is peekable, use it instead of the response.data
        # this makes sure the response body is not consumed when
        # instrumenting http requests through "requests" library.
        if (
            hasattr(response, "_original_response")
            and hasattr(response._original_response, "peek")
            and callable(response._original_response.peek)
        ):
            response_body = response._original_response.peek()
            length = len(response_body)
            if length == 0 and length != response_length:
                response_body = response.data
        try:
            if response_body is not None:
                trace_span.output = _decode_body(response_body)
        except Exception as ex:
            report_error(ex)

    def _install(self, module):
        self._module = module
        replace_method(
            module.connectionpool.HTTPConnectionPool,
            self._target_method,
            self._patched_call,
        )

    def _uninstall(self, module):
        _wrapping_method = getattr(
            module.connectionpool.HTTPConnectionPool, self._target_method, None
        )
        if hasattr(_wrapping_method, "__wrapped__"):
            setattr(
                module.connectionpool.HTTPConnectionPool,
                self._target_method,
                _wrapping_method.__wrapped__,
            )
        self._module = None


_instrumenters = [
    NativeHTTPInstrumenter(),
    URLLib3Instrumenter(),
    NativeAIOHTTPInstrumenter(),
]
_is_installed = False


def install():
    global _is_installed
    if _is_installed:
        return
    _is_installed = True
    for instrumenter in _instrumenters:
        instrumenter.install(
            SDK._is_dev_mode and not SDK._settings.disable_request_response_monitoring
        )


def uninstall():
    global _is_installed
    if not _is_installed:
        return
    for instrumenter in _instrumenters:
        instrumenter.uninstall()
    _is_installed = False
