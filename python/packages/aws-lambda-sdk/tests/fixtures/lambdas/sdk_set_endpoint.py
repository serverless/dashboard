import json
from sls_sdk import serverlessSdk as sdk


def handler(event, context) -> str:
    sdk.set_endpoint("/test/set/endpoint")
    return {
        "statusCode": 200,
        "body": json.dumps("ok"),
    }
