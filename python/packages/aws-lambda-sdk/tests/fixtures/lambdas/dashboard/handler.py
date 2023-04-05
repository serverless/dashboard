import serverless_sdk
from sls_sdk import serverlessSdk


def hello(event, context):
    print(serverless_sdk.SDK)
    print(serverlessSdk.capture_error)
    return "ok"
