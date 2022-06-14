# NOTE: Do not involve defaults here and defer those decisions to the Settings class in the settings module

import os

from serverless.aws_lambda_otel_extension.shared import constants

AWS_LAMBDA_FUNCTION_NAME = os.getenv(constants.AWS_LAMBDA_FUNCTION_NAME_ENV_VAR)
AWS_LAMBDA_FUNCTION_MEMORY_SIZE = os.getenv(constants.AWS_LAMBDA_FUNCTION_MEMORY_SIZE_ENV_VAR)
AWS_LAMBDA_FUNCTION_VERSION = os.getenv(constants.AWS_LAMBDA_FUNCTION_VERSION_ENV_VAR)
AWS_LAMBDA_LOG_GROUP_NAME = os.getenv(constants.AWS_LAMBDA_LOG_GROUP_NAME_ENV_VAR)
AWS_LAMBDA_LOG_STREAM_NAME = os.getenv(constants.AWS_LAMBDA_LOG_STREAM_NAME_ENV_VAR)
AWS_LAMBDA_RUNTIME_API = os.getenv(constants.AWS_LAMBDA_RUNTIME_API_ENV_VAR)

# We may want to alter this to fetch from a boto3.Session instance instead of environment variables to enable better
# local testing.
AWS_REGION = os.getenv(constants.AWS_REGION_ENV_VAR, os.getenv(constants.AWS_DEFAULT_REGION_ENV_VAR))

_X_AMZN_TRACE_ID = os.getenv(constants._X_AMZN_TRACE_ID_ENV_VAR)

EXTENSIONS_API_REGISTER_URL = os.getenv(constants.EXTENSIONS_API_REGISTER_URL_ENV_VAR)
EXTENSIONS_API_NEXT_URL = os.getenv(constants.EXTENSIONS_API_NEXT_URL_ENV_VAR)
LOGS_API_REGISTER_URL = os.getenv(constants.LOGS_API_REGISTER_URL_ENV_VAR)

TEST_DRY_LOG = os.getenv(constants.TEST_DRY_LOG_ENV_VAR)

SLS_OTEL_SERVER_HOST = os.getenv(constants.SLS_OTEL_SERVER_HOST_ENV_VAR)
SLS_OTEL_SERVER_PORT = os.getenv(constants.SLS_OTEL_SERVER_PORT_ENV_VAR)
SLS_OTEL_SERVER_URL = os.getenv(constants.SLS_OTEL_SERVER_URL_ENV_VAR)

SLS_LOG_SERVER_HOST = os.getenv(constants.SLS_LOG_SERVER_HOST_ENV_VAR)
SLS_LOG_SERVER_PORT = os.getenv(constants.SLS_LOG_SERVER_PORT_ENV_VAR)
SLS_LOG_SERVER_URL = os.getenv(constants.SLS_LOG_SERVER_URL_ENV_VAR)

SLS_OTEL_RESOURCE_ATTRIBUTES = os.getenv(constants.SLS_OTEL_RESOURCE_ATTRIBUTES_ENV_VAR)
