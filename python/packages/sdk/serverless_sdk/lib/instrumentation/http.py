import http.client
import time
import serverless_sdk
from urllib.parse import urlparse
from urllib.parse import parse_qs

_is_installed = False

_original_request = None
_original_getresponse = None


def _instrumented_request(self, *args, **kwargs):
    start_time = time.perf_counter_ns()
    serverless_sdk.serverlessSdk._debug_log("HTTP request")
    protocol = self._protocol
    (method, path) = (args[0], args[1])
    parsed_path = urlparse(path)
    query = parse_qs(parsed_path.query)

    self._sls_trace_span = serverless_sdk.serverlessSdk._create_trace_span(
        f"python.{protocol}.request",
        start_time=start_time,
    )
    self._sls_trace_span.tags.update(
        {
            "method": method,
            "protocol": "HTTP/1.1",
            "host": self.host,
            "path": f"/{parsed_path.path}",
            "request_header_names": [h for h in kwargs.get("headers", {}).keys()],
            "query_parameter_names": [q for q in query.keys()],
        },
        prefix="http",
    )

    try:
        _original_request(self, *args, **kwargs)
    except Exception as ex:
        self._sls_trace_span.tags["http.error_code"] = ex.__class__.__name__
        self._sls_trace_span.close()
        del self._sls_trace_span


def _instrumented_getresponse(self, *args, **kwargs):
    if not hasattr(self, "_sls_trace_span"):
        return _original_getresponse(self, *args, **kwargs)

    try:
        response = _original_getresponse(self, *args, **kwargs)
        self._sls_trace_span.tags["http.status_code"] = response.status
        return response
    finally:
        self._sls_trace_span.close()
        del self._sls_trace_span


def install():
    global _is_installed
    if _is_installed:
        return
    _is_installed = True

    global _original_request, _original_getresponse
    _original_request = http.client.HTTPConnection.request
    _original_getresponse = http.client.HTTPConnection.getresponse

    http.client.HTTPConnection.request = _instrumented_request
    http.client.HTTPConnection.getresponse = _instrumented_getresponse


def uninstall():
    global _is_installed
    if not _is_installed:
        return
    http.client.HTTPConnection.request = _original_request
    http.client.HTTPConnection.getresponse = _original_getresponse
    _is_installed = False
