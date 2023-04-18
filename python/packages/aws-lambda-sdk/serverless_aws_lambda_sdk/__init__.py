from __future__ import annotations
import os
import logging
from typing import Optional
from importlib_metadata import version
from typing_extensions import Final
from sls_sdk import serverlessSdk as baseSdk
from .trace_spans.aws_lambda import aws_lambda_span
from sls_sdk import ServerlessSdk, TraceSpans
from sls_sdk.lib.trace import TraceSpan
from .instrumentation import aws_sdk

# module metadata
__name__: Final[str] = "serverless-aws-lambda-sdk"
__version__: Final[str] = version(__name__)

logger = logging.getLogger(__name__)

if os.environ.get("SLS_SDK_DEBUG", None):
    logger.setLevel(logging.DEBUG)


__all__ = [
    "serverlessSdk",
]

baseSdk.name = __name__
baseSdk.version = __version__
TraceSpans.aws_lambda = aws_lambda_span
TraceSpans.aws_lambda_initialization = next(
    (
        x
        for x in baseSdk.trace_spans.root.sub_spans
        if x.name == "aws.lambda.initialization"
    ),
    None,
)


baseSdk._is_dev_mode = bool(os.environ.get("SLS_DEV_MODE_ORG_ID"))
baseSdk.instrumentation.aws_sdk = aws_sdk


def _initialize_extension(self, disable_aws_sdk_monitoring=False):
    try:
        settings = self._settings
        self._settings.disable_aws_sdk_monitoring = bool(
            os.environ.get("SLS_DISABLE_AWS_SDK_MONITORING", disable_aws_sdk_monitoring)
        )
        if not settings.disable_aws_sdk_monitoring:
            baseSdk.instrumentation.aws_sdk.install()
    except Exception as error:
        self._report_error(error)


ServerlessSdk._initialize_extension = _initialize_extension


class AwsLambdaTraceSpans(TraceSpans):
    aws_lambda: TraceSpan
    aws_lambda_initialization: TraceSpan
    aws_lambda_invocation: Optional[TraceSpan]


class AwsLambdaSdk(ServerlessSdk):
    trace_spans: AwsLambdaTraceSpans
    _is_dev_mode: bool


serverlessSdk: AwsLambdaSdk = baseSdk
