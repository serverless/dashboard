import pytest
from unittest.mock import MagicMock
import serverless_sdk.lib.instrumentation.http
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response
import urllib3


@pytest.fixture(autouse=True)
def instrumentation_setup():
    serverless_sdk.lib.instrumentation.http.install()
    yield
    serverless_sdk.lib.instrumentation.http.uninstall()


def test_instrument_http(
    reset_sdk,
    instrumentation_setup,
    httpserver_listen_address,
    httpserver: HTTPServer,
):
    # given
    from serverless_sdk import serverlessSdk

    serverlessSdk._initialize()

    def handler(request: Request):
        return Response(str("OK"))

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    # when
    urllib3.PoolManager().request("GET", httpserver.url_for("/foo/bar"))
