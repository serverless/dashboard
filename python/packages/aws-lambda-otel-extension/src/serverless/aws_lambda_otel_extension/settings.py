import json

from serverless.aws_lambda_otel_extension import constants, defaults, environment
from serverless.aws_lambda_otel_extension.utilities import default_if_none, split_string_on_commas_or_none

# Merge in settings from JSON packed environment variables.
sls_otel_user_settings = {
    # TODO: Add support for file or realtime configuration.
    # **(
    #     json.load(open("/var/task/.serverless-otel-user-settings"))
    #     if os.path.exists("/var/task/.serverless-otel-user-settings")
    #     else {}
    # ),
    **(json.loads(environment.SLS_OTEL_USER_SETTINGS) if environment.SLS_OTEL_USER_SETTINGS else {}),
}

# Used by wrapper to send events.
extension_otel_http_url = defaults.SLS_OPENTELEMETRY_SERVER_URL

# Used by SLS Resource Detector.
sls_otel_resource_attributes = {}

# Flag for enabling/disabling OpenTelemetry metrics collection
sls_otel_metrics_enabled = defaults.SLS_OTEL_METRICS_ENABLED

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
    if "metrics" in sls_otel_user_settings["opentelemetry"]:
        if "enabled" in sls_otel_user_settings["opentelemetry"]["metrics"]:
            sls_otel_metrics_enabled = sls_otel_user_settings["opentelemetry"]["metrics"]["enabled"]

# Used by the AWS Lambda Resource Director we brought in.

aws_region = default_if_none(environment.AWS_REGION or environment.AWS_DEFAULT_REGION, defaults.AWS_REGION)

aws_lambda_function_name = default_if_none(environment.AWS_LAMBDA_FUNCTION_NAME, defaults.AWS_LAMBDA_FUNCTION_NAME)

aws_lambda_function_version = default_if_none(
    environment.AWS_LAMBDA_FUNCTION_VERSION, defaults.AWS_LAMBDA_FUNCTION_VERSION
)

aws_lambda_function_memory_size = default_if_none(
    environment.AWS_LAMBDA_FUNCTION_MEMORY_SIZE, defaults.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
)

# Process enabled/disabled instrumentation list
otel_python_enabled_instrumentations = default_if_none(
    split_string_on_commas_or_none(environment.OTEL_PYTHON_ENABLED_INSTRUMENTATIONS),
    defaults.OTEL_PYTHON_ENABLED_INSTRUMENTATIONS,
)

otel_python_disabled_instrumentations = default_if_none(
    split_string_on_commas_or_none(environment.OTEL_PYTHON_DISABLED_INSTRUMENTATIONS),
    defaults.OTEL_PYTHON_DISABLED_INSTRUMENTATIONS,
)

# Iterate through a copy of the list and expand the tidle strings.
for otel_python_enabled_instrumentation in otel_python_enabled_instrumentations[:]:
    expanded_otel_python_enabled_instrumentations = constants.INSTRUMENTATION_TILDE_MAP.get(
        otel_python_enabled_instrumentation
    )
    if expanded_otel_python_enabled_instrumentations:
        otel_python_enabled_instrumentations.remove(otel_python_enabled_instrumentation)
        otel_python_enabled_instrumentations.extend(expanded_otel_python_enabled_instrumentations)

for otel_python_disabled_instrumentation in otel_python_disabled_instrumentations[:]:
    expanded_otel_python_disabled_instrumentations = constants.INSTRUMENTATION_TILDE_MAP.get(
        otel_python_disabled_instrumentation
    )
    if expanded_otel_python_disabled_instrumentations:
        otel_python_disabled_instrumentations.remove(otel_python_disabled_instrumentation)
        otel_python_disabled_instrumentations.extend(expanded_otel_python_disabled_instrumentations)

# Reduce the set size and make it pretty for no functional reason.
otel_python_enabled_instrumentations = sorted(set(otel_python_enabled_instrumentations))
otel_python_disabled_instrumentations = sorted(set(otel_python_disabled_instrumentations))

# TODO: This may no longer be needed.
otel_python_log_correlation = environment.OTEL_PYTHON_LOG_CORRELATION in constants.TRUTHY

sls_aws_lambda_otel_extension_log_level = (
    constants.LOG_LEVEL_MAP.get(
        environment.SLS_AWS_LAMBDA_OTEL_EXTENSION_LOG_LEVEL.lower(), defaults.SLS_WRAPPER_LOG_LEVEL
    )
    if environment.SLS_AWS_LAMBDA_OTEL_EXTENSION_LOG_LEVEL
    else defaults.SLS_WRAPPER_LOG_LEVEL
)

test_dry_log = environment.TEST_DRY_LOG in constants.TRUTHY
test_dry_log_pretty = environment.TEST_DRY_LOG_PRETTY in constants.TRUTHY
