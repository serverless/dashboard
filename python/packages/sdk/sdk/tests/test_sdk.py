from typing_extensions import TypeAlias
from types import MethodType

import pytest


ServerlessSdk: TypeAlias = 'ServerlessSdk'


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
  assert hasattr(sdk, 'name')
  assert isinstance(sdk.name, str)


def test_has_version(sdk: ServerlessSdk):
  assert hasattr(sdk, 'version')
  assert isinstance(sdk.version, str)


def test_has_tracespans(sdk: ServerlessSdk):
  assert hasattr(sdk, 'traceSpans')


def test_has_instrumentation(sdk: ServerlessSdk):
  assert hasattr(sdk, 'instrumentation')


def test_has_initialize_method(sdk: ServerlessSdk):
  assert hasattr(sdk, '_initialize')
  assert isinstance(sdk._initialize, MethodType)

  code = sdk._initialize.__code__

  # takes `options` argument
  assert code.co_argcount >= 2
  assert 'options' in code.co_varnames


def test_initialize_supports_options(sdk: ServerlessSdk):
  from .. import Options

  org_id = 'test'
  options = Options(orgId=org_id)
  assert options.orgId == org_id

  sdk._initialize(options)
  assert sdk.orgId == options.orgId


def test_initialize_favors_env_var(sdk: ServerlessSdk):
  from os import environ
  from .. import Options

  options = Options(orgId='opts')

  env: str = 'env'
  environ['SLS_ORG_ID'] = env

  sdk._initialize(options)
  assert sdk.orgId != options.orgId
  assert sdk.orgId == env
