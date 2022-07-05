import logging

from serverless.aws_lambda_otel_extension.shared import settings
from serverless.aws_lambda_otel_extension.shared.constants import PACKAGE_NAMESPACE


def setup_logging() -> None:

    # Set logging level for the entire package namespace.
    logging.getLogger(PACKAGE_NAMESPACE).setLevel(settings.sls_aws_lambda_otel_extension_log_level)
