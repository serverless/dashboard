import pytest
import sys
import importlib
from . import TEST_ORG, TEST_DEV_MODE_ORG_ID


@pytest.fixture()
def sdk(monkeypatch, request):
    _reset_sdk(monkeypatch, request, False, True)
    from serverless_sdk import serverlessSdk

    serverlessSdk._initialize()
    yield serverlessSdk


def _reset_sdk(
    monkeypatch, request, is_dev_mode: bool = False, is_debug_mode: bool = False
):
    for key in list(sys.modules.keys()):
        if [prefix for prefix in ["serverless_", "sls_"] if key.startswith(prefix)]:
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

    # make sure the SDK is imported
    importlib.import_module("serverless_sdk")
