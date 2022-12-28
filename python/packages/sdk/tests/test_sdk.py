from typing import TypeAlias

import pytest


ServerlessSdk: TypeAlias = 'ServerlessSdk'


@pytest.fixture
def sdk() -> ServerlessSdk:
  from ..sdk import serverlessSdk

  return serverlessSdk


def test_can_import_serverless_sdk():
  try:
    from ..sdk import serverlessSdk

  except ImportError:
    raise AssertionError("Cannot import `serverlessSdk`")


def test_has_name(sdk: ServerlessSdk):
  assert hasattr(sdk, 'name')
  assert isinstance(sdk.name, str)


def test_has_version(sdk: ServerlessSdk):
  assert hasattr(sdk, 'version')
  assert isinstance(sdk.version, str)
