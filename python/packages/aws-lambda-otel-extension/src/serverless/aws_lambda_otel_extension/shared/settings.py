# Simple properties as module variables to avoid having a redundant settings variable and Settings class.

from serverless.aws_lambda_otel_extension.shared import constants, defaults, environment

otel_server_host = environment.SLS_OTEL_SERVER_HOST or defaults.SLS_OTEL_SERVER_HOST
otel_server_port = int(environment.SLS_OTEL_SERVER_PORT or defaults.SLS_OTEL_SERVER_PORT)
otel_server_url = environment.SLS_OTEL_SERVER_URL or "http://{}:{}/".format(otel_server_host, otel_server_port)


log_server_host = environment.SLS_LOG_SERVER_HOST or defaults.SLS_LOG_SERVER_HOST
log_server_port = int(environment.SLS_LOG_SERVER_PORT or defaults.SLS_LOG_SERVER_PORT)
log_server_url = environment.SLS_LOG_SERVER_URL or "http://{}:{}/".format(log_server_host, log_server_port)

extensions_api_register_url = environment.EXTENSIONS_API_REGISTER_URL or "http://{}/{}".format(
    environment.AWS_LAMBDA_RUNTIME_API,
    constants.EXTENSIONS_API_REGISTER_PATH,
)

extensions_api_next_url = environment.EXTENSIONS_API_NEXT_URL or "http://{}/{}".format(
    environment.AWS_LAMBDA_RUNTIME_API,
    constants.EXTENSIONS_API_EVENT_NEXT_PATH,
)

logs_api_register_url = environment.LOGS_API_REGISTER_URL or "http://{}/{}".format(
    environment.AWS_LAMBDA_RUNTIME_API,
    constants.LOGS_API_PATH,
)

sls_otel_resource_attributes = (
    environment.SLS_OTEL_RESOURCE_ATTRIBUTES
    if environment.SLS_OTEL_RESOURCE_ATTRIBUTES is not None
    else defaults.SLS_OTEL_RESOURCE_ATTRIBUTES
)

test_dry_log = environment.TEST_DRY_LOG in constants.TRUTHY

cloud_region = environment.AWS_REGION or defaults.AWS_REGION

faas_name = environment.AWS_LAMBDA_FUNCTION_NAME or defaults.AWS_LAMBDA_FUNCTION_NAME
faas_version = environment.AWS_LAMBDA_FUNCTION_VERSION or defaults.AWS_LAMBDA_FUNCTION_VERSION
faas_max_memory = environment.AWS_LAMBDA_FUNCTION_MEMORY_SIZE or defaults.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
