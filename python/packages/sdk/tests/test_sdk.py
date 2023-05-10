from __future__ import annotations
from types import MethodType
from importlib_metadata import version
from unittest.mock import MagicMock

from . import get_params


def test_can_import_serverless_sdk(reset_sdk):
    try:
        from sls_sdk import serverlessSdk  # noqa: F401

    except ImportError as e:
        raise AssertionError("Cannot import `serverlessSdk`") from e


def test_has_name(instrumented_sdk):
    assert hasattr(instrumented_sdk, "name")
    assert isinstance(instrumented_sdk.name, str)


def test_has_version(instrumented_sdk):
    assert hasattr(instrumented_sdk, "version")
    assert isinstance(instrumented_sdk.version, str)
    assert instrumented_sdk.version == version(instrumented_sdk.name)


def test_has_tracespans(instrumented_sdk):
    assert hasattr(instrumented_sdk, "trace_spans")


def test_has_instrumentation(instrumented_sdk):
    assert hasattr(instrumented_sdk, "instrumentation")


def test_has_event_emitter(instrumented_sdk):
    from sls_sdk.lib.emitter import event_emitter

    assert hasattr(instrumented_sdk, "_event_emitter")
    assert instrumented_sdk._event_emitter is event_emitter


def test_has_initialize_method_with_params(instrumented_sdk):
    assert hasattr(instrumented_sdk, "_initialize")
    assert isinstance(instrumented_sdk._initialize, MethodType)

    # check if method takes `org_id` param
    params = get_params(instrumented_sdk._initialize)

    assert len(params) >= 1
    assert "org_id" in params


def test_initialize_supports_org_id(monkeypatch, reset_sdk):
    from sls_sdk import serverlessSdk as sdk

    org_id: str = "test"

    monkeypatch.delenv("SLS_ORG_ID", raising=False)
    sdk._initialize(org_id=org_id)
    assert sdk.org_id == org_id


def test_initialize_favors_env_var(instrumented_sdk):
    from os import environ

    org_id: str = "test"
    env: str = "env"

    environ["SLS_ORG_ID"] = env

    instrumented_sdk._is_initialized = False
    instrumented_sdk._initialize(org_id=org_id)
    assert instrumented_sdk.org_id != org_id
    assert instrumented_sdk.org_id == env


def test_has_create_trace_span_method(instrumented_sdk):
    assert hasattr(instrumented_sdk, "_create_trace_span")
    assert isinstance(instrumented_sdk._create_trace_span, MethodType)

    args = "name", "input", "output", "start_time", "tags"
    params = get_params(instrumented_sdk._create_trace_span)

    assert len(params) >= len(args)
    assert all(arg in params for arg in args)


def test_create_trace_span_returns_trace_span(instrumented_sdk):
    import sls_sdk.lib.trace

    span = instrumented_sdk._create_trace_span("name", "input", "output")

    assert isinstance(span, sls_sdk.lib.trace.TraceSpan)


def test_sdk_exposes_capture_error(instrumented_sdk):
    # given
    from sls_sdk.lib.error_captured_event import TYPE_MAP as ERROR_TYPE_MAP

    error = Exception("My error")
    captured = None

    def _captured_event_handler(event):
        nonlocal captured
        captured = event

    # when
    instrumented_sdk._event_emitter.on("captured-event", _captured_event_handler)
    instrumented_sdk.capture_error(error, tags={"user.tag": "somevalue"})

    # then
    assert captured.tags["error.message"] == "My error"
    assert captured.custom_tags["user.tag"] == "somevalue"
    assert captured.tags["error.type"] == ERROR_TYPE_MAP["handledUser"]


def test_sdk_capture_unhandled_error(instrumented_sdk):
    # given
    from sls_sdk.lib.error_captured_event import TYPE_MAP as ERROR_TYPE_MAP

    error = Exception("My error")
    captured = None

    def _captured_event_handler(event):
        nonlocal captured
        captured = event

    # when
    instrumented_sdk._event_emitter.on("captured-event", _captured_event_handler)
    instrumented_sdk.capture_error(
        error, type="unhandled", tags={"user.tag": "somevalue"}
    )

    # then
    assert captured.tags["error.message"] == "My error"
    assert captured.custom_tags["user.tag"] == "somevalue"
    assert captured.tags["error.type"] == ERROR_TYPE_MAP["unhandled"]


def test_sdk_exposes_capture_warning(instrumented_sdk):
    # given
    from sls_sdk.lib.warning_captured_event import TYPE_MAP as WARNING_TYPE_MAP

    warning = "My warning"
    captured = None

    def _captured_event_handler(event):
        nonlocal captured
        captured = event

    # when
    instrumented_sdk._event_emitter.on("captured-event", _captured_event_handler)
    instrumented_sdk.capture_warning(warning, tags={"user.tag": "somevalue"})

    # then
    assert captured.tags["warning.message"] == warning
    assert captured.custom_tags["user.tag"] == "somevalue"
    assert captured.tags["warning.type"] == WARNING_TYPE_MAP["user"]


def test_sdk_exposes_set_tag(instrumented_sdk):
    # given
    tag_name = "tag"
    tag_value = "value"

    # when
    instrumented_sdk.set_tag(tag_name, tag_value)

    # then
    assert instrumented_sdk._custom_tags[tag_name] == tag_value


def test_sdk_set_tag_does_not_crash_on_invalid_input(reset_sdk, monkeypatch):
    # given
    import sls_sdk
    from sls_sdk import serverlessSdk as sdk

    mock = MagicMock()
    monkeypatch.setattr(sls_sdk, "report_error", mock)
    tag_name = ""
    tag_value = "value"

    # when
    failed = False
    try:
        sdk.set_tag(tag_name, tag_value)
    except Exception:
        failed = True

    # then
    assert not failed
    mock.assert_called_once()


def test_initialize_all_options(instrumented_sdk, monkeypatch):
    # given
    _settings = instrumented_sdk._settings
    org_id: str = "test"
    monkeypatch.setenv("SLS_ORG_ID", org_id)
    monkeypatch.setenv("SLS_SDK_DEBUG", "1")
    monkeypatch.setenv("SLS_DEV_MODE_ORG_ID", org_id)
    monkeypatch.setenv("SLS_DISABLE_CAPTURED_EVENTS_STDOUT", "1")
    monkeypatch.setenv("SLS_DISABLE_PYTHON_LOG_MONITORING", "1")
    monkeypatch.setenv("SLS_DISABLE_REQUEST_RESPONSE_MONITORING", "1")

    # when
    instrumented_sdk._is_initialized = False
    instrumented_sdk._initialize()

    # then
    assert instrumented_sdk.org_id == org_id
    assert instrumented_sdk._settings.disable_captured_events_stdout
    assert instrumented_sdk._settings.disable_python_log_monitoring
    assert instrumented_sdk._settings.disable_request_response_monitoring
    assert instrumented_sdk._is_dev_mode
    assert instrumented_sdk._is_debug_mode

    instrumented_sdk._settings = _settings


def test_initialize_extension(instrumented_sdk):
    # given
    instrumented_sdk._initialize_extension = MagicMock()

    # when
    instrumented_sdk._is_initialized = False
    instrumented_sdk._initialize(
        "foo",
        org_id="test",
        disable_captured_events_stdout=True,
        disable_python_log_monitoring=True,
        disable_request_response_monitoring=True,
        disable_http_monitoring=True,
        disable_flask_monitoring=True,
        bar="baz",
    )

    # then
    instrumented_sdk._initialize_extension.assert_called_once_with("foo", bar="baz")
