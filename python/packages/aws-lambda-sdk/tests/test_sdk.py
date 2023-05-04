from __future__ import annotations
from importlib_metadata import version


def test_can_import_serverless_sdk(reset_sdk):
    try:
        from sls_sdk import serverlessSdk

    except ImportError as e:
        raise AssertionError("Cannot import `serverlessSdk`") from e


def test_has_name(reset_sdk):
    from sls_sdk import serverlessSdk as sdk

    assert hasattr(sdk, "name")
    assert isinstance(sdk.name, str)
    assert sdk.name == "serverless-aws-lambda-sdk"


def test_has_version(reset_sdk):
    from sls_sdk import serverlessSdk as sdk

    assert hasattr(sdk, "version")
    assert isinstance(sdk.version, str)
    assert sdk.version == version(sdk.name)
