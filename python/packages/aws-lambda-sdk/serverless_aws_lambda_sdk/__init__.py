from __future__ import annotations
import os
import logging
from typing import Optional
from sls_sdk import serverlessSdk as baseSdk
from .trace_spans.aws_lambda import aws_lambda_span
from sls_sdk import ServerlessSdk, TraceSpans
from sls_sdk.lib.trace import TraceSpan
from .base import NAME, __version__


logger = logging.getLogger(__name__)

if os.environ.get("SLS_SDK_DEBUG", None):
    logger.setLevel(logging.DEBUG)


__all__ = [
    "serverlessSdk",
]

baseSdk.name = NAME
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


class AwsLambdaTraceSpans(TraceSpans):
    aws_lambda: TraceSpan
    aws_lambda_initialization: TraceSpan
    aws_lambda_invocation: Optional[TraceSpan]


class AwsLambdaSdk(ServerlessSdk):
    trace_spans: AwsLambdaTraceSpans
    _is_dev_mode: bool


serverlessSdk: AwsLambdaSdk = baseSdk
