import base64
import json
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response


def test_telemetry_dev_mode_disabled(reset_sdk):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry

    # then
    assert not hasattr(telemetry, "send")


def test_telemetry_dev_mode_enabled(
    reset_sdk_dev_mode,
    httpserver: HTTPServer,
):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk._initialize()
    payload = base64.b64encode(json.dumps({}).encode("utf-8"))

    path = None

    def handler(request: Request):
        nonlocal path
        path = request.path
        return Response(str("OK"))

    httpserver.expect_request("/trace").respond_with_handler(handler)

    # when
    telemetry.send("trace", payload)
    telemetry.close_connection()

    assert path == "/trace"


def test_telemetry_multiple_requests(reset_sdk_dev_mode, httpserver: HTTPServer):
    # given
    import threading
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk._initialize()
    payload = base64.b64encode(json.dumps({}).encode("utf-8"))

    paths = []

    def handler(request: Request):
        paths.append(request.path)
        return Response(str("OK"))

    httpserver.expect_request("/trace").respond_with_handler(handler)
    httpserver.expect_request("/request-response").respond_with_handler(handler)

    # when
    def _run():
        telemetry.send("trace", payload)
        telemetry.send("trace", payload)
        telemetry.send("trace", payload)
        telemetry.send("request-response", payload)
        telemetry.close_connection()

    t = threading.Thread(target=_run)
    t.start()
    t.join()

    assert paths == ["/trace", "/trace", "/trace", "/request-response"]
