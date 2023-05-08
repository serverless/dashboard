import pytest
from unittest.mock import patch
import sys
import importlib
from . import TEST_FUNCTION, TEST_FUNCTION_VERSION, TEST_ORG, TEST_DEV_MODE_ORG_ID


@pytest.fixture()
def reset_sdk(monkeypatch, request):
    yield _reset_sdk(monkeypatch, request)


@pytest.fixture()
def reset_sdk_debug_mode(monkeypatch, request):
    yield _reset_sdk(monkeypatch, request, False, True)


@pytest.fixture()
def reset_sdk_dev_mode(monkeypatch, request):
    yield _reset_sdk(monkeypatch, request, True, True)


def _reset_sdk(
    monkeypatch, request, is_dev_mode: bool = False, is_debug_mode: bool = False
):
    module_prefixes_to_delete = [
        "serverless_sdk",
        "sls_sdk",
        "threading",
        "concurrent.futures",
        "http.client",
        "urllib",
        "urllib3",
        "aiohttp",
        "requests",
        "flask",
        "serverless_aws_lambda_sdk",
    ]
    deleted_modules = []
    for key in list(sys.modules.keys()):
        if [prefix for prefix in module_prefixes_to_delete if key.startswith(prefix)]:
            deleted_modules.append(key)
            del sys.modules[key]

    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", TEST_FUNCTION)
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_VERSION", TEST_FUNCTION_VERSION)
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

    # make sure 3rd party dependencies are imported
    for module in deleted_modules + module_prefixes_to_delete:
        if not module.startswith("serverless_"):
            importlib.import_module(module)

    # finally, make sure the SDK is imported
    importlib.import_module("serverless_aws_lambda_sdk")
    return monkeypatch


@pytest.fixture()
def mocked_print():
    from builtins import print as original_print

    with patch("builtins.print") as mocked_print:
        mocked_print.side_effect = original_print
        yield mocked_print


@pytest.fixture(scope="session")
def httpserver_listen_address():
    return ("127.0.0.1", 2773)
