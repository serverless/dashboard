from __future__ import annotations
import os
import logging
from typing import Optional
from serverless_sdk import serverlessSdk as baseSdk
from .trace_spans.aws_lambda import aws_lambda_span
from serverless_sdk.sdk.base import ServerlessSdk, TraceSpans
from serverless_sdk.span.trace import TraceSpan
from .base import NAME, __version__


def _initialize_logger():
    logger = logging.getLogger(__name__)
    logger.addHandler(logging.NullHandler())

    handler = logging.StreamHandler()
    formatter = logging.Formatter("⚡ SDK: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    if os.environ.get("SLS_SDK_DEBUG", None):
        logger.setLevel(logging.DEBUG)
    return logger


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

_initialize_logger()
