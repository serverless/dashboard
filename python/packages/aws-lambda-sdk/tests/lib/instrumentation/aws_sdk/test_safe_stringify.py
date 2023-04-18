from serverless_aws_lambda_sdk.lib.instrumentation.aws_sdk.safe_stringify import (
    safe_stringify,
)


def test_safe_stringify_success():
    # given
    input = {"foo": "bar"}

    # when
    result = safe_stringify(input)

    # then
    assert result == '{"foo": "bar"}'


def test_safe_stringify_failure():
    # given
    input = {"foo": object()}

    # when
    result = safe_stringify(input)

    # then
    assert result is None
