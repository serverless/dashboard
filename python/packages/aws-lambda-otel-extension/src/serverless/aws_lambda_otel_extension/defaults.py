import logging
import typing

from serverless.aws_lambda_otel_extension import constants

SLS_OPENTELEMETRY_SERVER_URL = "http://sandbox:2772"
SLS_LOG_SERVER_URL = "http://sandbox:4243"

SLS_OTEL_RESOURCE_ATTRIBUTES_ORG_ID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
SLS_OTEL_RESOURCE_ATTRIBUTES_SERVICE_NAME = "undefined"
SLS_OTEL_RESOURCE_ATTRIBUTES_STAGE = "undefined"

SLS_OTEL_RESOURCE_ATTRIBUTES = ""

SLS_OTEL_METRICS_ENABLED = False

AWS_REGION = "us-east-1"

AWS_LAMBDA_FUNCTION_NAME = "Fake"
AWS_LAMBDA_FUNCTION_VERSION = "LATEST"
AWS_LAMBDA_FUNCTION_TIMEOUT = 6
AWS_LAMBDA_FUNCTION_ARN = "arn:aws:lambda:serverless:Fake"
AWS_LAMBDA_FUNCTION_MEMORY_SIZE = 1024
AWS_LAMBDA_FUNCTION_REQUEST_ID = "1234567890"
AWS_LAMBDA_FUNCTION_LOG_GROUP_NAME = "/aws/lambda/Fake"

OTEL_PYTHON_ENABLED_INSTRUMENTATIONS: typing.List[str] = constants.INSTRUMENTATION_TILDE_MAP["~common"]
OTEL_PYTHON_DISABLED_INSTRUMENTATIONS: typing.List[str] = []

SLS_WRAPPER_LOG_LEVEL = logging.CRITICAL
