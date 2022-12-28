def test_can_import_serverless_sdk():
  try:
    from ..sdk import serverlessSdk

  except ImportError:
    raise AssertionError("Cannot import `serverlessSdk`")


