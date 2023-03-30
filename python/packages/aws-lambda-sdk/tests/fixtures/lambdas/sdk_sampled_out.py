counter = 0


def handler(event, context):
    global counter

    counter += 1
    invocation_id = counter

    from sls_sdk. import serverlessSdk as sdk
    from serverless_aws_lambda_sdk import serverlessSdk

    if sdk is not serverlessSdk:
        raise Exception("SDK exports mismatch")
    sdk._create_trace_span("user.span").close()

    sdk.set_tag("user.tag", f"example:{invocation_id}")

    return {
        "name": sdk.name,
        "version": sdk.version,
        "rootSpanName": sdk.trace_spans.root.name,
    }
