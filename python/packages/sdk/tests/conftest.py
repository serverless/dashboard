import pytest
import sys
import importlib
from . import TEST_ORG, TEST_DEV_MODE_ORG_ID


def _uninstall():
    import sls_sdk.lib.instrumentation.http
    import sls_sdk.lib.instrumentation.flask
    import sls_sdk.lib.instrumentation.logging
    import sls_sdk.lib.trace

    sls_sdk.lib.instrumentation.http.uninstall()
    sls_sdk.lib.instrumentation.flask.uninstall()
    sls_sdk.lib.instrumentation.logging.uninstall()

    def _uninstall_threading_hook(threading):
        _wrapping_method = getattr(threading.Thread, "start", None)
        if hasattr(_wrapping_method, "__wrapped__"):
            setattr(
                threading.Thread,
                "start",
                _wrapping_method.__wrapped__,
            )

    sls_sdk.lib.trace._import_hook.disable(_uninstall_threading_hook)
    if sls_sdk.lib.trace.root_span:
        if not sls_sdk.lib.trace.root_span.end_time:
            sls_sdk.lib.trace.root_span.close()
        sls_sdk.lib.trace.root_span = None
    sls_sdk.lib.trace._CONTEXT.set(None)


@pytest.fixture()
def reset_sdk(monkeypatch, request):
    _reset_sdk_reimport(monkeypatch, request)
    yield
    _uninstall()


@pytest.fixture()
def reset_sdk_dev_mode(monkeypatch, request):
    _reset_sdk_reimport(monkeypatch, request, True, True)
    yield
    _uninstall()


def _reset_sdk_reimport(
    monkeypatch, request, is_dev_mode: bool = False, is_debug_mode: bool = False
):
    # clean up the import hook if it was enabled
    import_hook = [
        x for x in sys.meta_path if type(sys.meta_path[0]).__name__ == "CustomImporter"
    ]
    if import_hook:
        sys.meta_path.remove(import_hook[0])

    module_prefixes_to_delete = [
        "sls_sdk",
        "threading",
        "concurrent.futures",
        "http.client",
        "urllib",
        "urllib3",
        "aiohttp",
        "requests",
        "flask",
    ]
    deleted_modules = []
    for key in list(sys.modules.keys()):
        if [prefix for prefix in module_prefixes_to_delete if key.startswith(prefix)]:
            deleted_modules.append(key)
            del sys.modules[key]

    monkeypatch.setenv("SLS_ORG_ID", TEST_ORG)
    if is_dev_mode:
        monkeypatch.setenv("SLS_DEV_MODE_ORG_ID", TEST_DEV_MODE_ORG_ID)
    else:
        monkeypatch.delenv("SLS_DEV_MODE_ORG_ID", False)

    if is_debug_mode:
        monkeypatch.setenv("SLS_SDK_DEBUG", "1")
    else:
        monkeypatch.delenv("SLS_SDK_DEBUG", False)

    if hasattr(request, "param") and type(request.param) is dict:
        for key in request.param:
            monkeypatch.setenv(key, request.param[key])

    # make sure the SDK & other deleted modules are reimported
    for module in deleted_modules + module_prefixes_to_delete:
        importlib.import_module(module)

    # make sure the SDK is imported
    importlib.import_module("sls_sdk")


@pytest.fixture(scope="session")
def httpserver_listen_address():
    return ("127.0.0.1", 9800)


@pytest.fixture(params=[False, True])
def instrumented_sdk(reset_sdk, request, monkeypatch):
    # if dev mode is enabled in the fixture
    if request.param:
        monkeypatch.setenv("SLS_DEV_MODE_ORG_ID", "test-org")
    import sls_sdk

    sls_sdk.serverlessSdk._initialize(
        disable_request_response_monitoring=not request.param
    )
    yield sls_sdk.serverlessSdk
    _uninstall()
