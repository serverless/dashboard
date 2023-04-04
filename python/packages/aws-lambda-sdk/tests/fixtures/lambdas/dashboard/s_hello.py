import sys

sys.path.insert(0, "./dashboard")
import serverless_sdk

sdk = serverless_sdk.SDK(
    org_id="test",
    application_name="test-collision",
    app_uid="test",
    org_uid="test",
    deployment_uid="4cae2cd7-e6c4-4628-8395-a9ababd11d77",
    service_name="test-collision",
    should_log_meta=True,
    should_compress_logs=True,
    disable_aws_spans=False,
    disable_http_spans=False,
    stage_name="dev",
    plugin_version="6.2.3",
    disable_frameworks_instrumentation=False,
    serverless_platform_stage="prod",
)

handler_wrapper_kwargs = {"function_name": "test-collision-dev-hello", "timeout": 6}
try:
    user_handler = serverless_sdk.get_user_handler("handler.hello")
    handler = sdk.handler(user_handler, **handler_wrapper_kwargs)
except Exception as error:
    e = error

    def error_handler(event, context):
        raise e

    handler = sdk.handler(error_handler, **handler_wrapper_kwargs)
