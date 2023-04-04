import serverless_sdk


def hello(event, context):
    print(serverless_sdk.SDK)
    return "ok"
