from __future__ import annotations
from unittest.mock import MagicMock, patch


def test_non_api_event(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.response_tags import resolve
    from serverless_aws_lambda_sdk import serverlessSdk

    # when
    with patch(
        "serverless_aws_lambda_sdk.instrument.lib.response_tags.is_api_event"
    ) as mock_is_api_event:
        mock_is_api_event.return_value = False
        resolve(None)

    # then
    mock_is_api_event.assert_called_once()
    assert not hasattr(
        serverlessSdk.trace_spans.aws_lambda.tags, "aws.lambda.http.status_code"
    )
    assert not hasattr(
        serverlessSdk.trace_spans.aws_lambda.tags, "aws.lambda.http.error_code"
    )


def test_api_event_success(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.response_tags import resolve
    from serverless_aws_lambda_sdk import serverlessSdk

    status_code = 200

    # when
    with patch(
        "serverless_aws_lambda_sdk.instrument.lib.response_tags.is_api_event"
    ) as mock_is_api_event:
        mock_is_api_event.return_value = True
        resolve({"statusCode": str(status_code)})

    # then
    mock_is_api_event.assert_called_once()
    assert (
        serverlessSdk.trace_spans.aws_lambda.tags["aws.lambda.http.status_code"]
        == status_code
    )
    assert not hasattr(
        serverlessSdk.trace_spans.aws_lambda.tags, "aws.lambda.http.error_code"
    )


def test_api_event_invalid_status_code(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.response_tags import resolve
    from serverless_aws_lambda_sdk import serverlessSdk

    status_code = 900

    # when
    with patch(
        "serverless_aws_lambda_sdk.instrument.lib.response_tags.is_api_event"
    ) as mock_is_api_event:
        mock_is_api_event.return_value = True
        resolve({"statusCode": str(status_code)})

    # then
    mock_is_api_event.assert_called_once()
    assert (
        serverlessSdk.trace_spans.aws_lambda.tags["aws.lambda.http.error_code"]
        == "INVALID_STATUS_CODE"
    )
    assert not hasattr(
        serverlessSdk.trace_spans.aws_lambda.tags, "aws.lambda.http.status_code"
    )


def test_api_event_error(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.response_tags import resolve
    from serverless_aws_lambda_sdk import serverlessSdk

    status_code = 200

    # when
    with patch(
        "serverless_aws_lambda_sdk.instrument.lib.response_tags.is_api_event"
    ) as mock_is_api_event:
        mock_is_api_event.return_value = True
        resolve(str(status_code))

    # then
    mock_is_api_event.assert_called_once()
    assert not hasattr(
        serverlessSdk.trace_spans.aws_lambda.tags, "aws.lambda.http.status_code"
    )
    assert not hasattr(
        serverlessSdk.trace_spans.aws_lambda.tags, "aws.lambda.http.error_code"
    )
