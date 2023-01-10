from __future__ import annotations
from typing_extensions import TypeAlias
from types import MethodType
import inspect

import pytest


ServerlessSdk: TypeAlias = "ServerlessSdk"


@pytest.fixture
def sdk() -> ServerlessSdk:
    from .. import serverlessSdk

    return serverlessSdk


def test_can_import_serverless_sdk():
    try:
        from .. import serverlessSdk

    except ImportError:
        raise AssertionError("Cannot import `serverlessSdk`")


def test_has_name(sdk: ServerlessSdk):
    assert hasattr(sdk, "name")
    assert isinstance(sdk.name, str)


def test_has_version(sdk: ServerlessSdk):
    assert hasattr(sdk, "version")
    assert isinstance(sdk.version, str)


def test_has_tracespans(sdk: ServerlessSdk):
    assert hasattr(sdk, "traceSpans")


def test_has_instrumentation(sdk: ServerlessSdk):
    assert hasattr(sdk, "instrumentation")


def test_has_initialize_method_with_params(sdk: ServerlessSdk):
    assert hasattr(sdk, "_initialize")
    assert isinstance(sdk._initialize, MethodType)

    # check if method takes `org_id` param
    signature = inspect.signature(sdk._initialize)
    params = signature.parameters

    assert len(params) >= 1
    assert "org_id" in params


def test_initialize_supports_org_id(sdk: ServerlessSdk):
    org_id: str = "test"

    sdk._initialize(org_id=org_id)
    assert sdk.orgId == org_id


def test_initialize_favors_env_var(sdk: ServerlessSdk):
    from os import environ

    org_id: str = "test"
    env: str = "env"

    environ["SLS_ORG_ID"] = env

    sdk._initialize(org_id=org_id)
    assert sdk.orgId != org_id
    assert sdk.orgId == env
