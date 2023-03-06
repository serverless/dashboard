import pytest
import sys
import importlib


TEST_ORG = "test-org"
TEST_FUNCTION = "test-function"
TEST_FUNCTION_VERSION = "1"


@pytest.fixture()
def reset_sdk(monkeypatch):
    modules = sys.modules.copy()
    for key in list(sys.modules.keys()):
        if key.startswith("serverless_"):
            del sys.modules[key]

    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", TEST_FUNCTION)
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_VERSION", TEST_FUNCTION_VERSION)
    monkeypatch.setenv("SLS_ORG_ID", TEST_ORG)

    for key in list(modules.keys()):
        if key.startswith("serverless_"):
            importlib.import_module(key)
