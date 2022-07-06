import logging

from serverless.aws_lambda_otel_extension.shared.constants import PACKAGE_NAMESPACE
from serverless.aws_lambda_otel_extension.shared.settings import SETTINGS_SLS_EXTENSION_LOG_LEVEL


def setup_logging() -> None:
    # Set logging level for the entire package namespace.
    logging.getLogger(PACKAGE_NAMESPACE).setLevel(SETTINGS_SLS_EXTENSION_LOG_LEVEL)
