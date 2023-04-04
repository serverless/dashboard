from __future__ import annotations
from unittest.mock import MagicMock, patch
from sls_sdk.lib.notice import report as report_notice
from sls_sdk.lib.emitter import event_emitter


def test_report_notice():
    # given
    warning = "Something went wrong"
    code = "NOTICE_CODE"
    span = MagicMock()

    # when
    with patch.object(event_emitter, "emit") as mock_emit:
        captured_event = report_notice(warning, code, span)

    # then
    assert captured_event.trace_span == span
    mock_emit.assert_called_once_with("captured-event", captured_event)
