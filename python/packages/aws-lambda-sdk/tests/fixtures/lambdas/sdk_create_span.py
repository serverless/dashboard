from serverless_sdk import serverlessSdk as sdk


def handler(event, context):
    from serverless_aws_lambda_sdk import serverlessSdk

    if sdk is not serverlessSdk:
        raise Exception("SDK exports mismatch")

    span = sdk.create_span("user.parent")
    sdk.create_span("user.child.one").close()
    with sdk.create_span("user.child.two"):
        pass
    span.close()

    return {
        "name": sdk.name,
        "version": sdk.version,
        "rootSpanName": sdk.trace_spans.root.name,
    }
