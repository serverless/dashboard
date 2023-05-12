from serverless_aws_lambda_sdk.lib.instrumentation.aws_sdk.safe_stringify import (
    safe_stringify,
)
from datetime import datetime


def test_safe_stringify_success():
    # given
    input = {"foo": "bar"}

    # when
    result = safe_stringify(input)

    # then
    assert result == '{"foo": "bar"}'


def test_safe_stringify_failure():
    # given
    input = {object(): object()}

    # when
    result = safe_stringify(input)

    # then
    assert result is None


def test_safe_stringify_with_datetime():
    # given
    now = datetime.now()
    input = {"timestamp": now}

    # when
    result = safe_stringify(input)

    # then
    assert result == f'{{"timestamp": "{str(now)}"}}'
