from __future__ import annotations

import logging
import base64
import traceback
from functools import wraps
from time import time_ns
from typing import Any, Dict, List

from serverless_sdk.span.trace import TraceSpan
from serverless_sdk_schema import TracePayload
from typing_extensions import Final

from ..base import Handler, Outcome, Tag
from ..trace_spans.aws_lambda import (
    aws_lambda_span,
    aws_lambda_initialization,
    aws_lambda_invocation,
)


__all__: Final[List[str]] = [
    "instrument",
]


TELEMETRY_PREFIX: Final[str] = "SERVERLESS_TELEMETRY.T"


def get_stacktrace(exception: Exception) -> str:
    trace = traceback.format_exception(
        type(exception), exception, exception.__traceback__
    )
    return "".join(trace)


def instrument(user_handler: Handler, *args, **kwargs) -> Handler:
    aws_lambda_initialization.close()

    @wraps(user_handler)
    def wrapper(event, context: Any = None):
        if context:
            aws_lambda_span.tags[Tag.request_id] = context.aws_request_id

        try:
            result = user_handler(event, context)
            close_trace(Outcome.success, result)
            return result

        except Exception as e:
            logging.error(f"Error executing handler: {e}")
            close_trace(Outcome.error_handled, e)

    return wrapper


def close_trace(outcome: str, outcome_result: Any):
    aws_lambda_span.tags[Tag.outcome] = outcome

    if outcome == Outcome.error_handled:
        aws_lambda_span.tags[Tag.error_message] = str(outcome_result)
        aws_lambda_span.tags[Tag.error_stacktrace] = get_stacktrace(outcome_result)

    end_time = time_ns()
    aws_lambda_span.close(end_time=end_time)
    report_trace()


def report_trace():
    payload = get_payload()
    as_base64 = to_base64_encoded_protobuf(payload)
    logging.debug(f"{TELEMETRY_PREFIX}.{as_base64}")


def convert_tracespan_protobuf_to_dict(span: TraceSpan) -> Dict[str, Any]:
    obj = span.to_protobuf_object()
    return obj.dict(by_alias=True)


def get_payload() -> Dict[str, Any]:
    span_buf = convert_tracespan_protobuf_to_dict(aws_lambda_span)

    payload = {
        "slsTags": {
            "orgId": aws_lambda_span.tags[Tag.org_id],
            "service": aws_lambda_span.tags[Tag.service],
            "sdk": {
                "name": aws_lambda_span.tags[Tag.sdk_name],
                "version": aws_lambda_span.tags[Tag.sdk_version],
            },
        },
        "spans": [span_buf],
        "events": [],
    }
    return payload


def to_base64_encoded_protobuf(payload: Dict[str, Any]) -> str:
    trace_payload = TracePayload()
    trace_payload.from_dict(payload)
    encoded: bytes = trace_payload.SerializeToString()
    as_base64: str = base64.b64encode(encoded).decode("utf-8")

    return as_base64
