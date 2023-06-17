from unittest.mock import MagicMock
from serverless_aws_lambda_sdk.instrument.lib.captured_event import should_include


def test_should_include_dev_mode_fingerprints_returns_false():
    # given
    event = MagicMock()
    event.custom_fingerprint = "INPUT_BODY_BINARY"

    # when
    result = should_include(event)

    # then
    assert result is False


def test_should_include_other_events_returns_true():
    # given
    event = MagicMock()
    event.custom_fingerprint = "foo"

    # when
    result = should_include(event)

    # then
    assert result is True
