import json


def handler(event, context) -> str:
    return {
        "statusCode": 200,
        "body": json.dumps("ok"),
    }
