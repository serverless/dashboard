from aiohttp.test_utils import loop_context
from aiohttp import web
import base64
import json


def test_telemetry_dev_mode_disabled(reset_sdk):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry

    # then
    assert not hasattr(telemetry, "send_async")


def test_telemetry_dev_mode_enabled(reset_sdk_dev_mode, aiohttp_server):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk._initialize()
    payload = base64.b64encode(json.dumps({}).encode("utf-8"))

    path = None
    telemetry._TELEMETRY_SERVER_URL = "http://localhost:2774/"

    # when
    with loop_context() as loop:

        async def _mock_server(request):
            nonlocal path
            path = request.path
            return web.Response(text="OK")

        async def _trace_request():
            app = web.Application()
            app.router.add_get("/trace", _mock_server)
            server = await aiohttp_server(app, port=2774)
            await telemetry.open_session()
            await telemetry.send_async("trace", payload)
            await telemetry.close_session()
            await server.close()

        loop.run_until_complete(_trace_request())

    assert path == "/trace"


def test_telemetry_multiple_requests(reset_sdk_dev_mode, aiohttp_server):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk._initialize()
    payload = base64.b64encode(json.dumps({}).encode("utf-8"))

    path = None
    telemetry._TELEMETRY_SERVER_URL = "http://localhost:2774/"

    # when
    with loop_context() as loop:

        async def _mock_server(request):
            nonlocal path
            path = request.path
            return web.Response(text="OK")

        async def _trace_request():
            nonlocal path
            app = web.Application()
            app.router.add_get("/trace", _mock_server)
            server = await aiohttp_server(app, port=2774)
            await telemetry.open_session()
            await telemetry.send_async("trace", payload)
            await telemetry.close_session()
            assert path == "/trace"

            path = None
            await telemetry.open_session()
            await telemetry.send_async("trace", payload)
            await telemetry.close_session()
            assert path == "/trace"
            await server.close()

        loop.run_until_complete(_trace_request())
