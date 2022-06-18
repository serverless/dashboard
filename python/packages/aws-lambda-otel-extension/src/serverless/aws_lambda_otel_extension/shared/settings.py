# Simple properties as module variables to avoid having a redundant settings variable and Settings class.

import json

from serverless.aws_lambda_otel_extension.shared import constants, defaults, environment

# Load settings from JSON packed environment variable.
# Example:
# {
#     "common": {"http": {"request": {"headers": [{"serverless_token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}]}}},
#     "extension": {
#         "opentelemetry": {"http": {"url": "http://example.com"}},
#         "logs": {"http": {"url": "http://localhost:4269"}},
#     },
#     "opentelemetry": {
#         "resource": {
#             "attributes": {
#                 "sls_service_name": "${self:service}",
#                 "sls_stage": "${sls.stage}",
#                 "sls_org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
#             }
#         }
#     },
#     "logs": {"http": {"request": {"url": "https://example.com/ingestion/kinesis/v1/logs"}}},
#     "metrics": {"http": {"request": {"url": "https://example.com/ingestion/kinesis/v1/metrics"}}},
#     "request": {"http": {"request": {"url": "https://example.com/ingestion/kinesis/v1/request-response"}}},
#     "response": {"http": {"request": {"url": "https://example.com/ingestion/kinesis/v1/request-response"}}},
#     "traces": {"http": {"request": {"url": "https://example.com/ingestion/kinesis/v1/traces"}}},
# }

sls_otel_user_settings = json.loads(environment.SLS_OTEL_USER_SETTINGS) if environment.SLS_OTEL_USER_SETTINGS else {}

# Used by wrapper to send events.
extension_otel_http_url = defaults.SLS_OPENTELEMETRY_SERVER_URL

# Used by SLS Resource Detector.
sls_otel_resource_attributes = {}

# A walrus operator would be nice here... but we want to support < 3.8...
if "extension" in sls_otel_user_settings:
    if "opentelemetry" in sls_otel_user_settings["extension"]:
        if "http" in sls_otel_user_settings["extension"]["opentelemetry"]:
            if "url" in sls_otel_user_settings["extension"]["opentelemetry"]["http"]:
                extension_otel_http_url = sls_otel_user_settings["extension"]["opentelemetry"]["http"]["url"]

# And here...
if "opentelemetry" in sls_otel_user_settings:
    if "resource" in sls_otel_user_settings["opentelemetry"]:
        if "attributes" in sls_otel_user_settings["opentelemetry"]["resource"]:
            sls_otel_resource_attributes = sls_otel_user_settings["opentelemetry"]["resource"]["attributes"]

# Used by the AWS Lambda Resource Director we brought in.
aws_region = environment.AWS_REGION or environment.AWS_DEFAULT_REGION or defaults.AWS_REGION
aws_lambda_function_name = environment.AWS_LAMBDA_FUNCTION_NAME or defaults.AWS_LAMBDA_FUNCTION_NAME
aws_lambda_function_version = environment.AWS_LAMBDA_FUNCTION_VERSION or defaults.AWS_LAMBDA_FUNCTION_VERSION
aws_lambda_function_memory_size = (
    environment.AWS_LAMBDA_FUNCTION_MEMORY_SIZE or defaults.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
)

test_dry_log = environment.TEST_DRY_LOG in constants.TRUTHY

otel_python_disabled_instrumentations = (
    [x.strip() for x in environment.OTEL_PYTHON_DISABLED_INSTRUMENTATIONS.split(",")]
    if environment.OTEL_PYTHON_DISABLED_INSTRUMENTATIONS
    else defaults.OTEL_PYTHON_DISABLED_INSTRUMENTATIONS
)

otel_python_log_correlation = environment.OTEL_PYTHON_LOG_CORRELATION in constants.TRUTHY
