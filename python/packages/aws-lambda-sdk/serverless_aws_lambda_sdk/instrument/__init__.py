from __future__ import annotations
import os
from timeit import default_timer
from functools import wraps
from typing import List
import logging
from typing_extensions import Final
from .. import serverlessSdk
from ..base import Handler
from ..trace_spans.aws_lambda import reset as reset_aws_lambda_span
from serverless_sdk_schema import TracePayload
import base64


logger = logging.getLogger(__name__)


__all__: Final[List[str]] = [
    "instrument",
]


def timer():
    return int(default_timer() * 1000000000)


def _resolve_outcome_enum_value(outcome: str) -> int:
    if outcome == "success":
        return 1
    if outcome == "error:handled":
        return 5
    if outcome == "error:unhandled":
        return 3
    raise Exception(f"Unexpected outcome value: {outcome}")


def _get_payload(payload_dct: dict) -> TracePayload:
    payload = TracePayload()
    payload.from_dict(payload_dct)
    spans = payload_dct["spans"]
    for index, span in enumerate(payload.spans):
        span.id = str.encode(spans[index]["id"])
        span.trace_id = str.encode(spans[index]["traceId"])
        span.parent_span_id = (
            str.encode(spans[index]["parentSpanId"])
            if spans[index]["parentSpanId"]
            else None
        )
    return payload


class Instrumenter:
    """This class is instantiated once per AWS Lambda Runtime environment.

    The instance is reused through subsequent requests, if any.
    """

    def __init__(self):
        self.current_invocation_id = 0
        serverlessSdk._initialize()
        self.aws_lambda = serverlessSdk.trace_spans.aws_lambda
        if not serverlessSdk.org_id:
            raise Exception(
                "Serverless SDK Error: Cannot instrument function: "
                + '"orgId" not provided. '
                + 'Ensure "SLS_ORG_ID" environment variable is set, '
                + "or pass it with the options\n"
            )
        serverlessSdk.trace_spans.aws_lambda_initialization.close()

    def _report_trace(self):
        payload_dct = {
            "slsTags": {
                "orgId": serverlessSdk.org_id,
                "service": os.environ.get("AWS_LAMBDA_FUNCTION_NAME", None),
                "sdk": {
                    "name": serverlessSdk.name,
                    "version": serverlessSdk.version,
                },
            },
            "spans": [s.to_protobuf_dict() for s in self.aws_lambda.spans],
        }
        payload = _get_payload(payload_dct)
        print(
            f"SERVERLESS_TELEMETRY.T.{base64.b64encode(payload.SerializeToString()).decode('utf-8')}"
        )

    def _close_trace(self, outcome: str):
        self.isRootSpanReset = False
        try:
            end_time = timer()
            self.aws_lambda.tags["aws.lambda.outcome"] = _resolve_outcome_enum_value(
                outcome
            )

            if not serverlessSdk.trace_spans.aws_lambda_initialization.end_time:
                serverlessSdk.trace_spans.aws_lambda_initialization.close(
                    end_time=end_time
                )

            if serverlessSdk.trace_spans.aws_lambda_invocation:
                serverlessSdk.trace_spans.aws_lambda_invocation.close(end_time=end_time)

            self.aws_lambda.close(end_time=end_time)

            self._report_trace()
            self._clear_root_span()
            logger.debug(
                "Overhead duration: Internal response:"
                + f"{int((timer() - end_time) / 1000_000)}ms"
            )

        except Exception:
            logging.exception("Error while closing the trace.")

    def _clear_root_span(self):
        reset_aws_lambda_span()
        del self.aws_lambda.id
        del self.aws_lambda.trace_id
        del self.aws_lambda.end_time
        self.isRootSpanReset = True

    def instrument(self, user_handler: Handler) -> Handler:
        @wraps(user_handler)
        def stub(event, context):
            request_start_time = timer()
            self.current_invocation_id += 1
            try:
                logger.debug("Invocation: start")
                if self.current_invocation_id > 1:
                    self.aws_lambda.start_time = request_start_time

                self.aws_lambda.tags["aws.lambda.request_id"] = context.aws_request_id
                serverlessSdk.trace_spans.aws_lambda_invocation = (
                    serverlessSdk._create_trace_span(
                        "aws.lambda.invocation", start_time=request_start_time
                    )
                )

                logger.debug(
                    "Overhead duration: Internal request:"
                    + f"{int((timer() - request_start_time) / 1000_000)}ms"
                )

            except Exception:
                logger.exception("Unhandled exception during instrumentation.")
                return user_handler(event, context)

            try:
                result = user_handler(event, context)
                self._close_trace("success")
                return result
            except Exception:
                self._close_trace("error:handled")
                raise

        return stub
