from __future__ import annotations
from types import MethodType
from unittest.mock import MagicMock
import pytest

from . import get_params
import serverless_sdk
from serverless_sdk import ServerlessSdk
from serverless_sdk.base import SLS_ORG_ID
from serverless_sdk.lib.error_captured_event import TYPE_MAP as ERROR_TYPE_MAP
from serverless_sdk.lib.warning_captured_event import TYPE_MAP as WARNING_TYPE_MAP
from serverless_sdk.lib.emitter import event_emitter


@pytest.fixture
def sdk() -> ServerlessSdk:
    from serverless_sdk import serverlessSdk

    return serverlessSdk


def test_can_import_serverless_sdk():
    try:
        from serverless_sdk import serverlessSdk

    except ImportError as e:
        raise AssertionError("Cannot import `serverlessSdk`") from e


def test_has_name(sdk: ServerlessSdk):
    assert hasattr(sdk, "name")
    assert isinstance(sdk.name, str)


def test_has_version(sdk: ServerlessSdk):
    assert hasattr(sdk, "version")
    assert isinstance(sdk.version, str)


def test_has_tracespans(sdk: ServerlessSdk):
    assert hasattr(sdk, "trace_spans")


def test_has_instrumentation(sdk: ServerlessSdk):
    assert hasattr(sdk, "instrumentation")


def test_has_event_emitter(sdk: ServerlessSdk):
    assert hasattr(sdk, "_event_emitter")
    assert sdk._event_emitter is event_emitter


def test_has_initialize_method_with_params(sdk: ServerlessSdk):
    assert hasattr(sdk, "_initialize")
    assert isinstance(sdk._initialize, MethodType)

    # check if method takes `org_id` param
    params = get_params(sdk._initialize)

    assert len(params) >= 1
    assert "org_id" in params


def test_initialize_supports_org_id(monkeypatch, sdk: ServerlessSdk):
    org_id: str = "test"

    monkeypatch.delenv("SLS_ORG_ID", raising=False)
    sdk._initialize(org_id=org_id)
    assert sdk.org_id == org_id


def test_initialize_favors_env_var(sdk: ServerlessSdk):
    from os import environ

    org_id: str = "test"
    env: str = "env"

    environ[SLS_ORG_ID] = env

    sdk._is_initialized = False
    sdk._initialize(org_id=org_id)
    assert sdk.org_id != org_id
    assert sdk.org_id == env


def test_has_create_trace_span_method(sdk: ServerlessSdk):
    assert hasattr(sdk, "_create_trace_span")
    assert isinstance(sdk._create_trace_span, MethodType)

    args = "name", "input", "output", "start_time", "tags"
    params = get_params(sdk._create_trace_span)

    assert len(params) >= len(args)
    assert all(arg in params for arg in args)


def test_create_trace_span_returns_trace_span(sdk: ServerlessSdk):
    from serverless_sdk.lib.trace import TraceSpan

    span = sdk._create_trace_span("name", "input", "output")

    assert isinstance(span, TraceSpan)


def test_sdk_exposes_capture_error(sdk: ServerlessSdk):
    # given
    error = Exception("My error")
    captured = None

    def _captured_event_handler(event):
        nonlocal captured
        captured = event

    # when
    sdk._event_emitter.on("captured-event", _captured_event_handler)
    sdk.capture_error(error, tags={"user.tag": "somevalue"})

    # then
    assert captured.tags["error.message"] == "My error"
    assert captured.custom_tags["user.tag"] == "somevalue"
    assert captured.tags["error.type"] == ERROR_TYPE_MAP["handledUser"]


def test_sdk_capture_unhandled_error(sdk: ServerlessSdk):
    # given
    error = Exception("My error")
    captured = None

    def _captured_event_handler(event):
        nonlocal captured
        captured = event

    # when
    sdk._event_emitter.on("captured-event", _captured_event_handler)
    sdk.capture_error(error, type="unhandled", tags={"user.tag": "somevalue"})

    # then
    assert captured.tags["error.message"] == "My error"
    assert captured.custom_tags["user.tag"] == "somevalue"
    assert captured.tags["error.type"] == ERROR_TYPE_MAP["unhandled"]


def test_sdk_exposes_capture_warning(sdk: ServerlessSdk):
    # given
    warning = "My warning"
    captured = None

    def _captured_event_handler(event):
        nonlocal captured
        captured = event

    # when
    sdk._event_emitter.on("captured-event", _captured_event_handler)
    sdk.capture_warning(warning, tags={"user.tag": "somevalue"})

    # then
    assert captured.tags["warning.message"] == warning
    assert captured.custom_tags["user.tag"] == "somevalue"
    assert captured.tags["warning.type"] == WARNING_TYPE_MAP["user"]


def test_sdk_exposes_set_tag(sdk: ServerlessSdk):
    # given
    tag_name = "tag"
    tag_value = "value"

    # when
    sdk.set_tag(tag_name, tag_value)

    # then
    assert sdk._custom_tags[tag_name] == tag_value


def test_sdk_set_tag_does_not_crash_on_invalid_input(sdk: ServerlessSdk, monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(serverless_sdk, "report_error", mock)
    tag_name = ""
    tag_value = "value"

    # when
    failed = False
    try:
        sdk.set_tag(tag_name, tag_value)
    except:
        failed = True

    # then
    assert not failed
    mock.assert_called_once()


def test_initialize_all_options(sdk: ServerlessSdk, monkeypatch):
    # given
    _settings = sdk._settings
    org_id: str = "test"
    monkeypatch.setenv("SLS_ORG_ID", org_id)
    monkeypatch.setenv("SLS_SDK_DEBUG", "1")
    monkeypatch.setenv("SLS_DEV_MODE_ORG_ID", org_id)
    monkeypatch.setenv("SLS_DISABLE_CAPTURED_EVENTS_STDOUT", "1")
    monkeypatch.setenv("SLS_DISABLE_PYTHON_LOG_MONITORING", "1")
    monkeypatch.setenv("SLS_DISABLE_REQUEST_RESPONSE_MONITORING", "1")

    # when
    sdk._is_initialized = False
    sdk._initialize()

    # then
    assert sdk.org_id == org_id
    assert sdk._settings.disable_captured_events_stdout
    assert sdk._settings.disable_python_log_monitoring
    assert sdk._settings.disable_request_response_monitoring
    assert sdk._is_dev_mode
    assert sdk._is_debug_mode

    sdk._settings = _settings
