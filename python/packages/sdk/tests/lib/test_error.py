from __future__ import annotations
import pytest
from unittest.mock import MagicMock, patch, ANY
from sls_sdk.lib.error import report as report_error, logger
import sls_sdk.lib.error_captured_event


def test_error_with_exception(monkeypatch):
    # given
    error = Exception("Something went wrong")
    create_error_captured_event = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.error_captured_event,
        "create",
        create_error_captured_event,
    )

    # when
    with patch.object(logger, "error") as mock_logger:
        report_error(error)
        mock_logger.call_args[0][0].items() <= dict(
            {
                "source": "serverlessSdk",
                "type": "ERROR_TYPE_CAUGHT_SDK_INTERNAL",
                "name": "Exception",
                "message": "Something went wrong",
            }
        ).items()
        mock_logger.assert_called_once()

    # then
    create_error_captured_event.assert_called_once_with(
        "Something went wrong",
        name="Exception",
        stack="Exception: Something went wrong\n",
        type="handledSdkInternal",
        origin="pythonLogging",
    )


def test_error_with_custom_object(monkeypatch):
    # given
    error = {
        "code": "Foo",
        "message": "Bar",
    }
    create_error_captured_event = MagicMock()
    monkeypatch.setattr(
        sls_sdk.lib.error_captured_event,
        "create",
        create_error_captured_event,
    )

    # when
    with patch.object(logger, "error") as mock_logger:
        report_error(error, "USER")
        mock_logger.call_args[0][0].items() <= dict(
            {
                "source": "serverlessSdk",
                "type": "ERROR_TYPE_CAUGHT_SDK_INTERNAL",
                "name": "Exception",
                "message": "Something went wrong",
            }
        ).items()
        mock_logger.assert_called_once()

    # then
    create_error_captured_event.assert_called_once()
    create_error_captured_event.assert_called_once_with(
        str(error), name=ANY, stack=ANY, type="handledSdkUser", origin="pythonLogging"
    )


def test_error_with_crash_exception(monkeypatch):
    # given
    error = Exception("Something went wrong")
    monkeypatch.setenv("SLS_CRASH_ON_SDK_ERROR", "1")

    # when
    with pytest.raises(Exception) as ex:
        report_error(error)
        assert ex is error


def test_error_with_crash_custom_object(monkeypatch):
    # given
    error = "Something went wrong"
    monkeypatch.setenv("SLS_CRASH_ON_SDK_ERROR", "1")

    # when
    with pytest.raises(Exception, match=error):
        report_error(error)
