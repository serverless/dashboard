from __future__ import annotations

import sys
import inspect
from pathlib import Path

# If the Lambda SDK is imported from the layer make sure
# to import the base SDK also from the Lambda Layer.
_is_loaded_from_layer = inspect.getfile(sys.modules[__name__]).startswith("/opt/python")
_path_modified = False
try:
    if "sls_sdk" not in sys.modules and _is_loaded_from_layer:
        sys.path.insert(0, "/opt/python")
        _path_modified = True
    from sls_sdk import serverlessSdk as baseSdk
finally:
    if _path_modified:
        sys.path.pop(0)

from .instrumentation import aws_sdk  # noqa E402
from .trace_spans.aws_lambda import aws_lambda_span  # noqa E402

from sls_sdk import ServerlessSdk, TraceSpans  # noqa E402
from sls_sdk.lib.trace import TraceSpan  # noqa E402
from sls_sdk.lib.captured_event import CapturedEvent  # noqa E402

from sls_sdk.lib.imports import internally_imported  # noqa E402

with internally_imported():
    from typing import Optional
    import logging
    import os

# module metadata
__name__ = "serverless-aws-lambda-sdk"

with open(Path(__file__).parent / "VERSION") as version_file:
    __version__ = version_file.read().strip()

logger = logging.getLogger(__name__)

if os.environ.get("SLS_SDK_DEBUG", None):
    logger.setLevel(logging.DEBUG)


__all__ = [
    "serverlessSdk",
]

baseSdk.name = __name__
baseSdk.version = __version__
baseSdk.trace_spans.aws_lambda = aws_lambda_span
baseSdk.trace_spans.aws_lambda_initialization = next(
    (
        x
        for x in baseSdk.trace_spans.root.sub_spans
        if x.name == "aws.lambda.initialization"
    ),
    None,
)


baseSdk._is_dev_mode = bool(os.environ.get("SLS_DEV_MODE_ORG_ID"))
baseSdk.instrumentation.aws_sdk = aws_sdk


def _initialize_extension(
    self, disable_aws_sdk_monitoring=False, disable_trace_sampling=False
):
    try:
        settings = self._settings
        self._settings.disable_aws_sdk_monitoring = bool(
            os.environ.get("SLS_DISABLE_AWS_SDK_MONITORING", disable_aws_sdk_monitoring)
        )
        self._settings.disable_sampling = bool(
            os.environ.get("SLS_DISABLE_TRACE_SAMPLING", disable_trace_sampling)
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
    _captured_events: list[CapturedEvent]


serverlessSdk: AwsLambdaSdk = baseSdk
