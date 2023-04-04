from __future__ import annotations


def test_sdk_alias():
    # given
    from sls_sdk import serverlessSdk

    # when
    from serverless_sdk import serverlessSdk as serverlessSdkAlias

    # then
    assert serverlessSdk is serverlessSdkAlias
