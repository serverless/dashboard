from unittest.mock import MagicMock
import requests
import base64
import json


def test_telemetry_dev_mode_disabled(reset_sdk, monkeypatch):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry

    mock = MagicMock()
    monkeypatch.setattr(requests, "Session", mock)

    # when
    telemetry.send(None, None)

    # then

    mock.assert_not_called()


def test_telemetry_dev_mode_enabled(reset_sdk_dev_mode, monkeypatch):
    # given
    import serverless_aws_lambda_sdk.instrument.lib.telemetry as telemetry
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk._initialize()

    mock = MagicMock()
    monkeypatch.setattr(requests, "Session", mock)
    payload = base64.b64encode(json.dumps({}).encode("utf-8"))
    mock.return_value.get.return_value.status_code = 200

    # when
    telemetry.send("test", payload)

    # then
    mock.assert_called_with()
    mock.return_value.get.assert_called_once_with(
        "http://localhost:2773/test",
        headers={
            "Content-Type": "application/x-protobuf",
            "Content-Length": str(len(payload)),
        },
        data=payload,
        stream=False,
    )
