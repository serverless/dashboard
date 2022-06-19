# NOTE: Do not involve defaults here and defer those decisions to the Settings class in the settings module

import os

from serverless.aws_lambda_otel_extension import constants

AWS_LAMBDA_FUNCTION_NAME = os.getenv(constants.AWS_LAMBDA_FUNCTION_NAME_ENV_VAR)
AWS_LAMBDA_FUNCTION_MEMORY_SIZE = os.getenv(constants.AWS_LAMBDA_FUNCTION_MEMORY_SIZE_ENV_VAR)
AWS_LAMBDA_FUNCTION_VERSION = os.getenv(constants.AWS_LAMBDA_FUNCTION_VERSION_ENV_VAR)
AWS_LAMBDA_LOG_GROUP_NAME = os.getenv(constants.AWS_LAMBDA_LOG_GROUP_NAME_ENV_VAR)
AWS_LAMBDA_LOG_STREAM_NAME = os.getenv(constants.AWS_LAMBDA_LOG_STREAM_NAME_ENV_VAR)
AWS_LAMBDA_RUNTIME_API = os.getenv(constants.AWS_LAMBDA_RUNTIME_API_ENV_VAR)

# We may want to alter this to fetch from a boto3.Session instance instead of environment variables to enable better
# local testing.
AWS_REGION = os.getenv(constants.AWS_REGION_ENV_VAR)
AWS_DEFAULT_REGION = os.getenv(constants.AWS_DEFAULT_REGION_ENV_VAR)

TEST_DRY_LOG = os.getenv(constants.TEST_DRY_LOG_ENV_VAR)
TEST_DRY_LOG_PRETTY = os.getenv(constants.TEST_DRY_LOG_PRETTY_ENV_VAR)

SLS_OTEL_SERVER_URL = os.getenv(constants.SLS_OTEL_SERVER_URL_ENV_VAR)
SLS_OTEL_USER_SETTINGS = os.getenv(constants.SLS_OTEL_USER_SETTINGS_ENV_VAR)

SLS_AWS_LAMBDA_OTEL_EXTENSION_LOG_LEVEL = os.getenv(constants.SLS_AWS_LAMBDA_OTEL_EXTENSION_LOG_LEVEL_ENV_VAR)

OTEL_PYTHON_ENABLED_INSTRUMENTATIONS = os.getenv(constants.OTEL_PYTHON_ENABLED_INSTRUMENTATIONS_ENV_VAR)
OTEL_PYTHON_DISABLED_INSTRUMENTATIONS = os.getenv(constants.OTEL_PYTHON_DISABLED_INSTRUMENTATIONS_ENV_VAR)

OTEL_PYTHON_LOG_CORRELATION = os.getenv(constants.OTEL_PYTHON_LOG_CORRELATION_ENV_VAR)

_X_AMZN_TRACE_ID = os.getenv(constants._X_AMZN_TRACE_ID_ENV_VAR)

EXEC_WRAPPER_START_TIME_NS = os.getenv(constants.EXEC_WRAPPER_START_TIME_NS_ENV_VAR)
