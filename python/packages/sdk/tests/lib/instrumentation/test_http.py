import pytest
from unittest.mock import patch
import asyncio
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response
import sys
from types import SimpleNamespace
import uuid
from urllib.parse import urlparse
import time
from unittest.mock import MagicMock

LARGE_REQUEST_PAYLOAD = b"a" * 1024 * 128
SMALL_REQUEST_PAYLOAD = b"a"

LARGE_RESPONSE_PAYLOAD = b"r" * 1024 * 128
SMALL_RESPONSE_PAYLOAD = b"r"


def _assert_request_response_body(sdk, request_body, response_body):
    assert (
        not sdk._is_dev_mode
        or (request_body is None and sdk.trace_spans.root.input is None)
        or (len(request_body) > 1024 * 127 and sdk.trace_spans.root.input is None)
        or sdk.trace_spans.root.input == request_body.decode("utf-8")
    )
    # TODO: Uncomment after response body observation is fixed
    # assert (
    #     not sdk._is_dev_mode
    #     or (response_body is None and sdk.trace_spans.root.output is None)
    #     or (len(response_body) > 1024 * 127 and sdk.trace_spans.root.output is None)
    #     or sdk.trace_spans.root.output == response_body.decode("utf-8")
    # )


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD, LARGE_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_http_client(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
    response_body,
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import http.client

    url = urlparse(httpserver.url_for("/foo/bar?baz=qux"))
    headers = {"User-Agent": "foo"}

    conn = http.client.HTTPConnection(url.hostname, url.port)
    conn.request("POST", url.path + "?" + url.query, request_body, headers)
    resp = conn.getresponse()
    conn.close()

    # then
    assert resp.read() == response_body
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "POST",
                "http.protocol": "HTTP/1.1",
                "http.host": f"127.0.0.1:{httpserver.port}",
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
    _assert_request_response_body(instrumented_sdk, request_body, response_body)


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD, LARGE_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_urllib(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
    response_body,
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib.parse
    import urllib.request

    url = httpserver.url_for("/foo/bar?baz=qux")
    headers = {"User-Agent": "foo"}

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, data=request_body) as response:
        resp = response.read()

    # then
    assert resp == response_body
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "POST",
                "http.protocol": "HTTP/1.1",
                "http.host": f"127.0.0.1:{httpserver.port}",
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
    _assert_request_response_body(instrumented_sdk, request_body, response_body)


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD, LARGE_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_urllib3(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
    response_body,
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib3

    resp = urllib3.PoolManager().request(
        "POST",
        httpserver.url_for("/foo/bar?baz=qux"),
        body=request_body,
    )

    # then
    assert resp.data == response_body
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert instrumented_sdk.trace_spans.root.tags == {
        "http.method": "POST",
        "http.protocol": "HTTP/1.1",
        "http.host": f"127.0.0.1:{httpserver.port}",
        "http.path": "/foo/bar",
        "http.request_header_names": [],
        "http.query_parameter_names": ["baz"],
        "http.status_code": 200,
    }
    _assert_request_response_body(instrumented_sdk, request_body, response_body)


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD, LARGE_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_requests(
    instrumented_sdk, httpserver: HTTPServer, request_body, response_body
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import requests

    resp = requests.get(
        httpserver.url_for("/foo/bar?baz=qux"),
        headers={"User-Agent": "foo"},
        data=request_body,
    )

    # then
    assert resp.text == response_body.decode("utf-8")
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "GET",
                "http.protocol": "HTTP/1.1",
                "http.host": f"127.0.0.1:{httpserver.port}",
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
    _assert_request_response_body(instrumented_sdk, request_body, response_body)


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD, LARGE_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_requests_ignore_following_request(
    instrumented_sdk, httpserver: HTTPServer, request_body, response_body
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    from sls_sdk.lib.instrumentation.http import (
        ignore_following_request,
        reset_ignore_following_request,
    )
    import requests

    ignore_following_request()
    resp = requests.get(
        httpserver.url_for("/foo/bar?baz=qux"),
        headers={"User-Agent": "foo"},
        data=request_body,
    )

    # then
    assert instrumented_sdk.trace_spans.root is None
    assert resp.text == response_body.decode("utf-8")

    # when
    reset_ignore_following_request()
    resp = requests.get(
        httpserver.url_for("/foo/bar?baz=qux"),
        headers={"User-Agent": "foo"},
        data=request_body,
    )

    # then
    assert resp.text == response_body.decode("utf-8")
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "GET",
                "http.protocol": "HTTP/1.1",
                "http.host": f"127.0.0.1:{httpserver.port}",
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
    _assert_request_response_body(instrumented_sdk, request_body, response_body)


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD, LARGE_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_aiohttp(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
    response_body,
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import aiohttp

    async def _get():
        async with aiohttp.ClientSession(headers={"User-Agent": "foo"}) as session:
            async with session.get(
                httpserver.url_for("/foo/bar?baz=qux"), data=request_body
            ) as resp:
                print(resp.status)
                response = await resp.text()
                print(response)
                return response

    resp = asyncio.run(_get())

    # then
    assert resp == response_body.decode("utf-8")
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert instrumented_sdk.trace_spans.root.tags == {
        "http.method": "GET",
        "http.protocol": "HTTP/1.1",
        "http.host": f"127.0.0.1:{httpserver.port}",
        "http.path": "/foo/bar",
        "http.request_header_names": ["User-Agent"],
        "http.query_parameter_names": ["baz"],
        "http.status_code": 200,
    }
    _assert_request_response_body(instrumented_sdk, request_body, response_body)


@pytest.mark.parametrize(
    "request_body",
    [
        (SMALL_REQUEST_PAYLOAD),
        (LARGE_REQUEST_PAYLOAD),
    ],
)
def test_instrument_native_http_error(
    instrumented_sdk,
    request_body,
):
    # given
    import urllib.parse
    import urllib.request

    host = str(uuid.uuid4()) + ":1234"
    url = f"https://{host}/foo/bar?baz=qux"
    headers = {"User-Agent": "foo"}

    # when
    req = urllib.request.Request(url, headers=headers)
    with pytest.raises(urllib.error.URLError):
        with urllib.request.urlopen(req, data=request_body) as response:
            response.read()

    # then
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.https.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "POST",
                "http.protocol": "HTTP/1.1",
                "http.host": host,
                "http.path": "/foo/bar",
                "http.query_parameter_names": ["baz"],
                "http.error_code": "gaierror",
            }
        ).items()
    )
    assert (
        "User-Agent"
        in instrumented_sdk.trace_spans.root.tags["http.request_header_names"]
    )
    _assert_request_response_body(instrumented_sdk, request_body, None)


def test_instrument_aiohttp_error(
    instrumented_sdk,
):
    # given
    host = str(uuid.uuid4()) + ":1234"
    url = f"https://{host}/foo/bar?baz=qux"

    # when
    import aiohttp

    async def _get():
        async with aiohttp.ClientSession(headers={"User-Agent": "foo"}) as session:
            async with session.get(url) as resp:
                print(resp.status)
                print(await resp.text())

    with pytest.raises(aiohttp.client_exceptions.ClientConnectorError):
        asyncio.run(_get())

    # then
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.https.request"
    assert instrumented_sdk.trace_spans.root.tags == {
        "http.method": "GET",
        "http.protocol": "HTTP/1.1",
        "http.host": host,
        "http.path": "/foo/bar",
        "http.request_header_names": ["User-Agent"],
        "http.query_parameter_names": ["baz"],
        "http.error_code": "ClientConnectorError",
    }
    _assert_request_response_body(instrumented_sdk, None, None)


def test_instrument_aiohttp_unsupported_version(instrumented_sdk):
    mock_aiohttp = SimpleNamespace()
    mock_aiohttp.ClientSession = SimpleNamespace()

    with patch.dict(sys.modules, {"aiohttp": mock_aiohttp}):
        # given
        import sls_sdk.lib.instrumentation.http
        from sls_sdk.lib.instrumentation.http import NativeAIOHTTPInstrumenter

        sls_sdk.lib.instrumentation.http.uninstall()
        instrumenter = NativeAIOHTTPInstrumenter()

        assert not instrumenter._import_hook.enabled

        # when
        instrumenter.install(True)

        # then
        assert instrumenter._import_hook.enabled
        assert instrumenter._module is not None
        assert instrumenter._original_init is None


def test_instrument_aiohttp_noops_if_aiohttp_is_not_installed():
    with patch.dict(sys.modules, {"aiohttp": None}):
        # given
        import sls_sdk
        from sls_sdk.lib.instrumentation.http import NativeAIOHTTPInstrumenter

        # when
        sls_sdk.serverlessSdk._initialize()

        # then
        instrumenter = [
            x
            for x in sls_sdk.lib.instrumentation.http._instrumenters
            if isinstance(x, NativeAIOHTTPInstrumenter)
        ][0]
        assert not instrumenter._is_installed

        sls_sdk.lib.instrumentation.http.uninstall()


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_aiohttp_sls_ignore(
    instrumented_sdk,
    httpserver: HTTPServer,
    request_body,
    response_body,
):
    # given
    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import aiohttp

    async def _get():
        async with aiohttp.ClientSession(headers={"User-Agent": "foo"}) as session:
            session._sls_ignore = True
            async with session.get(
                httpserver.url_for("/foo/bar?baz=qux"), data=request_body
            ) as resp:
                print(resp.status)
                response = await resp.text()
                print(response)
                return response

    resp = asyncio.run(_get())

    # then
    assert resp == response_body.decode("utf-8")
    assert instrumented_sdk.trace_spans.root is None


def test_instrument_duration_requests(instrumented_sdk, httpserver: HTTPServer):
    # given
    def handler(request: Request):
        time.sleep(0.2)
        return Response("ok")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import requests

    resp = requests.get(
        httpserver.url_for("/foo/bar"),
    )

    # then
    assert resp.text == "ok"
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.end_time
        - instrumented_sdk.trace_spans.root.start_time
        > 200_000_000
    )


def test_instrument_duration_http_client(instrumented_sdk, httpserver: HTTPServer):
    # given
    def handler(request: Request):
        time.sleep(0.2)
        return Response("ok")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import http.client

    url = urlparse(httpserver.url_for("/foo/bar"))

    conn = http.client.HTTPConnection(url.hostname, url.port)
    conn.request("POST", url.path + "?" + url.query)
    resp = conn.getresponse()
    conn.close()

    # then
    assert resp.read().decode("utf-8") == "ok"
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.end_time
        - instrumented_sdk.trace_spans.root.start_time
        > 200_000_000
    )


def test_instrument_duration_urllib(instrumented_sdk, httpserver: HTTPServer):
    # given
    def handler(request: Request):
        time.sleep(0.2)
        return Response("ok")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib.parse
    import urllib.request

    url = httpserver.url_for("/foo/bar")

    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        resp = response.read()

    # then
    assert resp.decode("utf-8") == "ok"
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.end_time
        - instrumented_sdk.trace_spans.root.start_time
        > 200_000_000
    )


def test_instrument_duration_urllib3(instrumented_sdk, httpserver: HTTPServer):
    # given
    def handler(request: Request):
        time.sleep(0.2)
        return Response("ok")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import urllib3

    resp = urllib3.PoolManager().request(
        "POST",
        httpserver.url_for("/foo/bar?baz=qux"),
        headers={"Foo": "Bar"},
        body=b"hello world",
    )

    # then
    assert resp.data.decode("utf-8") == "ok"
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.end_time
        - instrumented_sdk.trace_spans.root.start_time
        > 200_000_000
    )


def test_instrument_duration_aiohttp(instrumented_sdk, httpserver):
    # given
    def handler(request: Request):
        time.sleep(0.2)
        return Response("ok")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import aiohttp

    async def _get():
        async with aiohttp.ClientSession(headers={"User-Agent": "foo"}) as session:
            async with session.get(httpserver.url_for("/foo/bar?baz=qux")) as resp:
                print(resp.status)
                response = await resp.text()
                print(response)
                return response

    resp = asyncio.run(_get())

    # then
    assert resp == "ok"
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.end_time
        - instrumented_sdk.trace_spans.root.start_time
        > 200_000_000
    )


def test_instrument_requests_post_data_from_file(
    instrumented_sdk, httpserver: HTTPServer
):
    # given
    def handler(request: Request):
        return Response("ok")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import requests

    with open(__file__, "rb") as f:
        resp = requests.post(
            httpserver.url_for("/foo/bar?baz=qux"),
            headers={"User-Agent": "foo"},
            data=f,
        )

    # then
    assert resp.text == "ok"
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "POST",
                "http.protocol": "HTTP/1.1",
                "http.host": f"127.0.0.1:{httpserver.port}",
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
    if instrumented_sdk._is_dev_mode:
        with open(__file__, "r") as f:
            assert instrumented_sdk.trace_spans.root.input == f.read()


def test_instrument_requests_with_binary_body(
    instrumented_sdk, httpserver: HTTPServer, monkeypatch
):
    # given
    mock_report_error = MagicMock()
    import sls_sdk.lib.instrumentation.http

    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.http, "report_error", mock_report_error
    )

    def handler(request: Request):
        return Response(b"\x8b")

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    import requests

    resp = requests.get(
        httpserver.url_for("/foo/bar?baz=qux"),
        headers={"User-Agent": "foo"},
        data=SMALL_REQUEST_PAYLOAD,
    )

    # then
    assert resp.content == b"\x8b"
    assert len(instrumented_sdk.trace_spans.root.spans) == 1
    assert instrumented_sdk.trace_spans.root.name == "python.http.request"
    assert (
        instrumented_sdk.trace_spans.root.tags.items()
        >= dict(
            {
                "http.method": "GET",
                "http.protocol": "HTTP/1.1",
                "http.host": f"127.0.0.1:{httpserver.port}",
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
    mock_report_error.assert_not_called()
    _assert_request_response_body(instrumented_sdk, SMALL_REQUEST_PAYLOAD, None)
