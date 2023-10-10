from __future__ import annotations


def test_is_api_event_returns_true(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.api_events import is_api_event
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk.trace_spans.aws_lambda.tags[
        "aws.lambda.event_type"
    ] = "aws.apigateway.rest"

    # when
    result = is_api_event()

    # then
    assert result


def test_is_api_event_returns_false(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.api_events import is_api_event
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk.trace_spans.aws_lambda.tags["aws.lambda.event_type"] = "aws.sqs"

    # when
    result = is_api_event()

    # then
    assert not result


def test_is_api_gateway_v2_event_returns_true(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.api_events import (
        is_api_gateway_v2_event,
    )
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk.trace_spans.aws_lambda.tags[
        "aws.lambda.event_type"
    ] = "aws.apigatewayv2.http.v2"

    # when
    result = is_api_gateway_v2_event()

    # then
    assert result


def test_is_api_gateway_v2_event_returns_false(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.instrument.lib.api_events import (
        is_api_gateway_v2_event,
    )
    from serverless_aws_lambda_sdk import serverlessSdk

    serverlessSdk.trace_spans.aws_lambda.tags[
        "aws.lambda.event_type"
    ] = "aws.apigatewayv2.http.v1"

    # when
    result = is_api_gateway_v2_event()

    # then
    assert not result
