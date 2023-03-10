from serverless_sdk import serverlessSdk as sdk


def handler(event, context):
    from serverless_aws_lambda_sdk import serverlessSdk

    if sdk is not serverlessSdk:
        raise Exception("SDK exports mismatch")
    sdk._create_trace_span("user.span").close()
    return {
        "name": sdk.name,
        "version": sdk.version,
        "rootSpanName": sdk.trace_spans.root.name,
    }
