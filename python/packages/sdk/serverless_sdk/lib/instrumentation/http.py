import time
import importlib
from urllib.parse import urlparse
from urllib.parse import parse_qs
import serverless_sdk


class BaseInstrumenter:
    def __init__(self, target_module):
        self._is_installed = False
        self._target_module = target_module

    def install(self):
        if self._is_installed:
            return

        try:
            self._module = importlib.import_module(self._target_module)
        except ImportError:
            return

        self._install()
        self._is_installed = True

    def uninstall(self):
        if not self._is_installed:
            return

        self._uninstall()
        self._is_installed = False

    def _install(self):
        raise NotImplementedError

    def _uninstall(self):
        raise NotImplementedError


class AIOHTTPInstrumenter(BaseInstrumenter):
    def __init__(self):
        super().__init__("aiohttp")
        self._original_request = None

    def _instrumented_request(self):
        async def _func(_self, *args, **kwargs):
            start_time = time.perf_counter_ns()
            serverless_sdk.serverlessSdk._debug_log("HTTP request")
            (method, path) = (args[0], args[1])
            parsed_path = urlparse(path)
            query = parse_qs(parsed_path.query)
            _self._sls_trace_span = serverless_sdk.serverlessSdk._create_trace_span(
                "python.https.request",
                start_time=start_time,
            )
            try:
                response = await self._original_request(_self, *args, **kwargs)
                _self._sls_trace_span._set_name(f"python.{response.url.scheme}.request")
                _self._sls_trace_span.tags.update(
                    {
                        "method": method,
                        "protocol": "HTTP/1.1",
                        "host": response.host,
                        "path": parsed_path.path,
                        "request_header_names": [h for h in _self.headers.keys()],
                        "query_parameter_names": [q for q in query.keys()],
                    },
                    prefix="http",
                )
                return response
            except Exception as ex:
                if ex.args and hasattr(ex.args[0], "host"):
                    _self._sls_trace_span.tags.update(
                        {
                            "method": method,
                            "protocol": "HTTP/1.1",
                            "host": ex.args[0].host,
                            "path": parsed_path.path,
                            "request_header_names": [h for h in _self.headers.keys()],
                            "query_parameter_names": [q for q in query.keys()],
                            "error_code": ex.os_error.__class__.__name__
                            if hasattr(ex, "os_error")
                            else ex.__class__.__name__,
                        },
                        prefix="http",
                    )
                    _self._sls_trace_span._set_name(
                        f"python.{'https' if ex.args[0].is_ssl else 'http'}.request"
                    )
                raise
            finally:
                if _self._sls_trace_span.end_time is None:
                    _self._sls_trace_span.close()
                del _self._sls_trace_span

        return _func

    def _install(self):
        self._original_request = self._module.ClientSession._request
        self._module.ClientSession._request = self._instrumented_request()

    def _uninstall(self):
        self._module.ClientSession._request = self._original_request


class NativeHTTPInstrumenter(BaseInstrumenter):
    def __init__(self):
        super().__init__("http")
        self._original_request = None
        self._original_getresponse = None

    def _instrumented_request(self):
        def _func(_self, *args, **kwargs):
            start_time = time.perf_counter_ns()

            serverless_sdk.serverlessSdk._debug_log("HTTP request")
            protocol = (
                "https" if _self.__class__.__name__ == "HTTPSConnection" else "http"
            )
            (method, path) = (args[0], args[1])
            parsed_path = urlparse(path)
            query = parse_qs(parsed_path.query)
            _self._sls_trace_span = serverless_sdk.serverlessSdk._create_trace_span(
                f"python.{protocol}.request",
                start_time=start_time,
            )
            _self._sls_trace_span.tags.update(
                {
                    "method": method,
                    "protocol": "HTTP/1.1",
                    "host": _self.host,
                    "path": parsed_path.path,
                    "request_header_names": [
                        h for h in kwargs.get("headers", {}).keys()
                    ],
                    "query_parameter_names": [q for q in query.keys()],
                },
                prefix="http",
            )

            try:
                self._original_request(_self, *args, **kwargs)
            except Exception as ex:
                _self._sls_trace_span.tags["http.error_code"] = ex.__class__.__name__
                raise
            finally:
                if _self._sls_trace_span.end_time is None:
                    _self._sls_trace_span.close()
                del _self._sls_trace_span

        return _func

    def _instrumented_getresponse(self):
        def _func(http_self, *args, **kwargs):
            if not hasattr(http_self, "_sls_trace_span"):
                return self._original_getresponse(http_self, *args, **kwargs)

            try:
                response = self._original_getresponse(http_self, *args, **kwargs)
                http_self._sls_trace_span.tags["http.status_code"] = response.status
                return response
            finally:
                http_self._sls_trace_span.close()
                del http_self._sls_trace_span

        return _func

    def _install(self):
        self._original_request = self._module.client.HTTPConnection.request
        self._original_getresponse = self._module.client.HTTPConnection.getresponse
        self._module.client.HTTPConnection.request = self._instrumented_request()
        self._module.client.HTTPConnection.getresponse = (
            self._instrumented_getresponse()
        )

    def _uninstall(self):
        self._module.client.HTTPConnection.request = self._original_request
        self._module.client.HTTPConnection.getresponse = self._original_getresponse


_instrumenters = [NativeHTTPInstrumenter(), AIOHTTPInstrumenter()]
_is_installed = False


def install():
    global _is_installed
    if _is_installed:
        return
    _is_installed = True
    for instrumenter in _instrumenters:
        instrumenter.install()


def uninstall():
    global _is_installed
    if not _is_installed:
        return
    for instrumenter in _instrumenters:
        instrumenter.uninstall()
    _is_installed = False
