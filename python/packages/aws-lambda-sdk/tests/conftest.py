import pytest
import sys
import importlib
from . import TEST_FUNCTION, TEST_FUNCTION_VERSION, TEST_ORG


@pytest.fixture()
def reset_sdk(monkeypatch, request):
    modules = sys.modules.copy()
    for key in list(sys.modules.keys()):
        if key.startswith("serverless_"):
            del sys.modules[key]

    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", TEST_FUNCTION)
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_VERSION", TEST_FUNCTION_VERSION)
    monkeypatch.setenv("SLS_ORG_ID", TEST_ORG)

    if hasattr(request, "param") and type(request.param) is dict:
        for key in request.param:
            monkeypatch.setenv(key, request.param[key])

    for key in list(modules.keys()):
        if key.startswith("serverless_"):
            importlib.import_module(key)

    # make sure the SDK is imported
    importlib.import_module("serverless_aws_lambda_sdk")
    yield monkeypatch
