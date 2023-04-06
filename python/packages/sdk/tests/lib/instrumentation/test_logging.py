import pytest
from unittest.mock import MagicMock
import sls_sdk.lib.instrumentation.logging
import logging
import json


@pytest.fixture(autouse=True)
def instrumentation_setup():
    sls_sdk.lib.instrumentation.logging.install()
    yield
    sls_sdk.lib.instrumentation.logging.uninstall()


def test_instrument_error(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.logging, "create_error_captured_event", mock
    )
    error = Exception("My error")

    # when
    logging.error(error)

    # then
    mock.assert_called_once_with(error, origin="pythonLogging")


def test_instrument_error_with_multiple_arguments(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.logging, "create_error_captured_event", mock
    )
    error = "%s %s went wrong"
    args = ("logging", "test")

    # when
    logging.error(error, *args, exc_info=True)

    # then
    mock.assert_called_once_with(error % args, origin="pythonLogging")


def test_instrument_warning(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.logging,
        "create_warning_captured_event",
        mock,
    )
    message = "My message: %s"

    # when
    logging.warning(message, "hello")

    # then
    mock.assert_called_once_with(message % "hello", origin="pythonLogging")


def test_instrument_warn(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.logging,
        "create_warning_captured_event",
        mock,
    )
    message = "My message: %s"

    # when
    logging.warn(message, "hello")

    # then
    mock.assert_called_once_with(message % "hello", origin="pythonLogging")


def test_instrument_warning_recognize_sdk_warning(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.logging,
        "create_warning_captured_event",
        mock,
    )
    mock_json = MagicMock()
    monkeypatch.setattr(json, "dumps", mock_json)
    message = "Something is wrong"

    # when
    data = {"source": "serverlessSdk", "message": message}
    logging.warning(data)

    # then
    mock.assert_not_called()
    mock_json.assert_called_once_with(data, indent=2)


def test_instrument_warning_recognize_sdk_error(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.instrumentation.logging,
        "create_error_captured_event",
        mock,
    )
    mock_json = MagicMock()
    monkeypatch.setattr(json, "dumps", mock_json)
    message = "Something is wrong"

    # when
    data = {"source": "serverlessSdk", "message": message}
    logging.error(data)

    # then
    mock.assert_not_called()
    mock_json.assert_called_once_with(data, indent=2)
