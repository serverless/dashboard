import pytest
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response
import urllib3


@pytest.fixture(autouse=True)
def instrumented_sdk(reset_sdk):
    from serverless_sdk import serverlessSdk

    serverlessSdk._initialize()
    return serverlessSdk


def test_instrument_http(
    instrumented_sdk,
    httpserver: HTTPServer,
):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    urllib3.PoolManager().request("GET", httpserver.url_for("/foo/bar?baz=qux"))

    # then
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert instrumented_sdk.trace_spans.root.tags == {
        "http.method": "GET",
        "http.protocol": "HTTP/1.1",
        "http.host": "127.0.0.1",
        "http.path": "/foo/bar",
        "http.request_header_names": ["User-Agent"],
        "http.query_parameter_names": ["baz"],
    }
