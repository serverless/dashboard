import pytest
from unittest.mock import patch
import asyncio
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response
import sys
import json


@pytest.fixture(params=[False, True])
def instrumented_sdk(reset_sdk, request, monkeypatch):
    # if dev mode is enabled in the fixture
    if request.param:
        monkeypatch.setenv("SLS_DEV_MODE_ORG_ID", "test-org")
    import serverless_sdk

    serverless_sdk.serverlessSdk._initialize(
        disable_request_response_monitoring=not request.param
    )
    yield serverless_sdk.serverlessSdk
    serverless_sdk.lib.instrumentation.http.uninstall()


def _assert_request_response_body(sdk, request_body, response_body):
    assert (
        not sdk._is_dev_mode
        or isinstance(request_body, str)
        or sdk.trace_spans.root.input == json.dumps(request_body)
    )
    assert (
        not sdk._is_dev_mode
        or isinstance(request_body, str)
        or sdk.trace_spans.root.output == response_body
    )


@pytest.mark.parametrize("request_body", [{"foo": "bar"}, "a" * 1024 * 128])
def test_instrument_urllib(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib.parse
    import urllib.request

    url = httpserver.url_for("/foo/bar?baz=qux")
    headers = {"User-Agent": "foo"}

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(
        req, data=json.dumps(request_body).encode()
    ) as response:
        response.read()

    # then
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "POST",
                "http.protocol": "HTTP/1.1",
                "http.host": "127.0.0.1",
                "http.path": "/foo/bar",
                "http.query_parameter_names": ["baz"],
                "http.status_code": 200,
            }
        ).items()
    )
    assert (
        "User-Agent"
        in instrumented_sdk.trace_spans.root.tags["http.request_header_names"]
    )
    _assert_request_response_body(instrumented_sdk, request_body, "OK")


@pytest.mark.parametrize("request_body", [{"foo": "bar"}, "a" * 1024 * 128])
def test_instrument_urllib3(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib3

    urllib3.PoolManager().request(
        "POST",
        httpserver.url_for("/foo/bar?baz=qux"),
        body=json.dumps(request_body).encode(),
    )

    # then
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert instrumented_sdk.trace_spans.root.tags == {
        "http.method": "POST",
        "http.protocol": "HTTP/1.1",
        "http.host": "127.0.0.1",
        "http.path": "/foo/bar",
        "http.request_header_names": ["User-Agent"],
        "http.query_parameter_names": ["baz"],
        "http.status_code": 200,
    }
    assert (
        not instrumented_sdk._is_dev_mode
        or isinstance(request_body, str)
        or instrumented_sdk.trace_spans.root.input == json.dumps(request_body)
    )
    assert (
        not instrumented_sdk._is_dev_mode
        or isinstance(request_body, str)
        or instrumented_sdk.trace_spans.root.output == "OK"
    )
    _assert_request_response_body(instrumented_sdk, request_body, "OK")


@pytest.mark.parametrize("request_body", [{"foo": "bar"}, "a" * 1024 * 128])
def test_instrument_requests(instrumented_sdk, httpserver: HTTPServer, request_body):
    # given
    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import requests

    requests.get(
        httpserver.url_for("/foo/bar?baz=qux"),
        headers={"User-Agent": "foo"},
        data=json.dumps({"foo": "bar"}).encode(),
    )

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
                "http.status_code": 200,
            }
        ).items()
    )
    assert (
        "User-Agent"
        in instrumented_sdk.trace_spans.root.tags["http.request_header_names"]
    )
    _assert_request_response_body(instrumented_sdk, request_body, "OK")


@pytest.mark.parametrize("request_body", [{"foo": "bar"}, "a" * 1024 * 128])
def test_instrument_aiohttp(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
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
            async with session.get(
                httpserver.url_for("/foo/bar?baz=qux"), data=request_body
            ) as resp:
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
        "http.status_code": 200,
    }
    _assert_request_response_body(instrumented_sdk, request_body, "OK")


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
