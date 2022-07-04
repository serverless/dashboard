import json

from serverless.aws_lambda_otel_extension.shared.constants import INSTRUMENTATION_TILDE_MAP, LOG_LEVEL_MAP, TRUTHY
from serverless.aws_lambda_otel_extension.shared.defaults import (
    DEF_OTEL_PYTHON_DISABLED_INSTRUMENTATIONS,
    DEF_OTEL_PYTHON_ENABLED_INSTRUMENTATIONS,
    DEF_SLS_OPENTELEMETRY_SERVER_URL,
    DEF_SLS_OTEL_METRICS_ENABLED,
    DEF_SLS_WRAPPER_LOG_LEVEL,
)
from serverless.aws_lambda_otel_extension.shared.environment import (
    ENV_OTEL_PYTHON_DISABLED_INSTRUMENTATIONS,
    ENV_OTEL_PYTHON_ENABLED_INSTRUMENTATIONS,
    ENV_OTEL_PYTHON_LOG_CORRELATION,
    ENV_SLS_OTEL_EXTENSION_FLUSH_TIMEOUT,
    ENV_SLS_OTEL_EXTENSION_LOG_LEVEL,
    ENV_SLS_OTEL_USER_SETTINGS,
    ENV_TEST_DRY_LOG,
    ENV_TEST_DRY_LOG_PRETTY,
)
from serverless.aws_lambda_otel_extension.shared.utilities import default_if_none, split_string_on_commas_or_none

# Merge in settings from JSON packed environment variables.
sls_otel_user_settings = {
    # TODO: Add support for file or realtime configuration.
    # **(
    #     json.load(open("/var/task/.serverless-otel-user-settings"))
    #     if os.path.exists("/var/task/.serverless-otel-user-settings")
    #     else {}
    # ),
    **(json.loads(ENV_SLS_OTEL_USER_SETTINGS) if ENV_SLS_OTEL_USER_SETTINGS else {}),
}

# Used by wrapper to send events.
extension_otel_http_url = DEF_SLS_OPENTELEMETRY_SERVER_URL

# Used by SLS Resource Detector.
sls_otel_resource_attributes = {}

# Flag for enabling/disabling OpenTelemetry metrics collection
sls_otel_metrics_enabled = DEF_SLS_OTEL_METRICS_ENABLED

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


# Process enabled/disabled instrumentation list
otel_python_enabled_instrumentations = default_if_none(
    split_string_on_commas_or_none(ENV_OTEL_PYTHON_ENABLED_INSTRUMENTATIONS),
    DEF_OTEL_PYTHON_ENABLED_INSTRUMENTATIONS,
)

otel_python_disabled_instrumentations = default_if_none(
    split_string_on_commas_or_none(ENV_OTEL_PYTHON_DISABLED_INSTRUMENTATIONS),
    DEF_OTEL_PYTHON_DISABLED_INSTRUMENTATIONS,
)

# Iterate through a copy of the list and expand the tidle strings.
for otel_python_enabled_instrumentation in otel_python_enabled_instrumentations[:]:
    expanded_otel_python_enabled_instrumentations = INSTRUMENTATION_TILDE_MAP.get(otel_python_enabled_instrumentation)
    if expanded_otel_python_enabled_instrumentations:
        otel_python_enabled_instrumentations.remove(otel_python_enabled_instrumentation)
        otel_python_enabled_instrumentations.extend(expanded_otel_python_enabled_instrumentations)

for otel_python_disabled_instrumentation in otel_python_disabled_instrumentations[:]:
    expanded_otel_python_disabled_instrumentations = INSTRUMENTATION_TILDE_MAP.get(otel_python_disabled_instrumentation)
    if expanded_otel_python_disabled_instrumentations:
        otel_python_disabled_instrumentations.remove(otel_python_disabled_instrumentation)
        otel_python_disabled_instrumentations.extend(expanded_otel_python_disabled_instrumentations)

# Reduce the set size and make it pretty for no functional reason.
otel_python_enabled_instrumentations = sorted(set(otel_python_enabled_instrumentations))
otel_python_disabled_instrumentations = sorted(set(otel_python_disabled_instrumentations))

# TODO: This may no longer be needed.
otel_python_log_correlation = ENV_OTEL_PYTHON_LOG_CORRELATION in TRUTHY

sls_aws_lambda_otel_extension_log_level = (
    LOG_LEVEL_MAP.get(ENV_SLS_OTEL_EXTENSION_LOG_LEVEL.lower(), DEF_SLS_WRAPPER_LOG_LEVEL)
    if ENV_SLS_OTEL_EXTENSION_LOG_LEVEL
    else DEF_SLS_WRAPPER_LOG_LEVEL
)

test_dry_log = ENV_TEST_DRY_LOG in TRUTHY
test_dry_log_pretty = ENV_TEST_DRY_LOG_PRETTY in TRUTHY


sls_otel_extension_flush_timeout = (
    int(ENV_SLS_OTEL_EXTENSION_FLUSH_TIMEOUT) if ENV_SLS_OTEL_EXTENSION_FLUSH_TIMEOUT else 30000
)
