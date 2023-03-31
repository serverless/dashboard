import pytest
from unittest.mock import patch
import asyncio
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response
import sys


@pytest.fixture()
def instrumented_sdk(reset_sdk):
    import serverless_sdk

    serverless_sdk.serverlessSdk._initialize()
    yield serverless_sdk.serverlessSdk
    serverless_sdk.lib.instrumentation.http.uninstall()


def test_instrument_urllib3(
    instrumented_sdk,
    httpserver: HTTPServer,
):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib3

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


def test_instrument_requests(
    instrumented_sdk,
    httpserver: HTTPServer,
):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import requests

    requests.get(httpserver.url_for("/foo/bar?baz=qux"), headers={"User-Agent": "foo"})

    # then
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "GET",
                "http.protocol": "HTTP/1.1",
                "http.host": "127.0.0.1",
                "http.path": "/foo/bar",
                "http.query_parameter_names": ["baz"],
            }
        ).items()
    )
    assert (
        "User-Agent"
        in instrumented_sdk.trace_spans.root.tags["http.request_header_names"]
    )


def test_instrument_aiohttp(
    instrumented_sdk,
    httpserver: HTTPServer,
):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)
    import serverless_sdk.lib.trace

    serverless_sdk.lib.trace.root_span = None

    # when
    import aiohttp

    async def _get():
        async with aiohttp.ClientSession(headers={"User-Agent": "foo"}) as session:
            async with session.get(httpserver.url_for("/foo/bar?baz=qux")) as resp:
                print(resp.status)
                print(await resp.text())

    asyncio.run(_get())

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


def test_instrument_aiohttp_noops_if_aiohttp_is_not_installed():
    with patch.dict(sys.modules, {"aiohttp": None}):
        # given
        import serverless_sdk

        # when
        serverless_sdk.serverlessSdk._initialize()

        # then
        instrumenter = [
            x
            for x in serverless_sdk.lib.instrumentation.http._instrumenters
            if x._target_module == "aiohttp"
        ][0]
        assert not instrumenter._is_installed

        serverless_sdk.lib.instrumentation.http.uninstall()
