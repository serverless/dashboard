from __future__ import annotations
from unittest.mock import MagicMock, patch
from serverless_sdk.lib.warning import report as report_warning, logger
import serverless_sdk.lib.error


def test_report_warning(monkeypatch):
    # given
    warning = "Something went wrong"
    code = "WARN_CODE"
    create_warning_captured_event = MagicMock()
    monkeypatch.setattr(
        serverless_sdk.lib.warning,
        "create_warning_captured_event",
        create_warning_captured_event,
    )

    # when
    with patch.object(logger, "warning") as mock_logger:
        report_warning(warning, code)
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
    create_warning_captured_event.assert_called_once_with(
        "Something went wrong",
        fingerprint=code,
        type="sdkInternal",
        origin="pythonConsole",
    )
