from __future__ import annotations
import os
import time
import json
from functools import wraps
from typing import List, Optional, Any
import logging
from typing_extensions import Final

from .. import serverlessSdk
from ..base import Handler
from ..trace_spans.aws_lambda import reset as reset_aws_lambda_span
from serverless_sdk_schema import TracePayload
import base64


logger = logging.getLogger(__name__)


def debug_log(msg):
    return logger.debug(f"⚡ SDK: {msg}")


__all__: Final[List[str]] = [
    "instrument",
]


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
    events = payload_dct["events"]
    for index, span in enumerate(payload.spans):
        span.id = str.encode(spans[index]["id"])
        span.trace_id = str.encode(spans[index]["traceId"])
        span.parent_span_id = (
            str.encode(spans[index]["parentSpanId"])
            if spans[index]["parentSpanId"]
            else None
        )
    for index, event in enumerate(payload.events):
        event.id = str.encode(events[index]["id"])
        event.span_id = (
            str.encode(events[index]["spanId"]) if events[index]["spanId"] else None
        )
        event.trace_id = (
            str.encode(events[index]["traceId"]) if events[index]["traceId"] else None
        )
    return payload


class Instrumenter:
    """This class is instantiated once per AWS Lambda Runtime environment.

    The instance is reused through subsequent requests, if any.
    """

    def __init__(self):
        self.current_invocation_id = 0
        serverlessSdk._captured_events = []
        serverlessSdk._event_emitter.on("captured-event", self._captured_event_handler)
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

    def _captured_event_handler(self, captured_event):
        serverlessSdk._captured_events.append(captured_event)

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
            "events": [e.to_protobuf_dict() for e in serverlessSdk._captured_events],
            "customTags": json.dumps(serverlessSdk._custom_tags),
        }
        payload = _get_payload(payload_dct)
        print(
            f"SERVERLESS_TELEMETRY.T.{base64.b64encode(payload.SerializeToString()).decode('utf-8')}"
        )

    def _close_trace(self, outcome: str, outcomeResult: Optional[Any] = None):
        self.isRootSpanReset = False
        try:
            end_time = time.perf_counter_ns()
            is_error_outcome = outcome.startswith("error:")

            self.aws_lambda.tags["aws.lambda.outcome"] = _resolve_outcome_enum_value(
                outcome
            )
            if is_error_outcome:
                serverlessSdk.capture_error(
                    outcomeResult, type="unhandled", timestamp=end_time
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
            debug_log(
                "Overhead duration: Internal response:"
                + f"{int((time.perf_counter_ns() - end_time) / 1000_000)}ms"
            )

        except Exception:
            logging.exception("Error while closing the trace.")

    def _clear_root_span(self):
        reset_aws_lambda_span()
        del self.aws_lambda.id
        del self.aws_lambda.trace_id
        del self.aws_lambda.end_time
        serverlessSdk._captured_events = []
        serverlessSdk._custom_tags.clear()
        self.isRootSpanReset = True

    def instrument(self, user_handler: Handler) -> Handler:
        @wraps(user_handler)
        def stub(event, context):
            request_start_time = time.perf_counter_ns()
            self.current_invocation_id += 1
            try:
                debug_log("Invocation: start")
                if self.current_invocation_id > 1:
                    self.aws_lambda.start_time = request_start_time

                self.aws_lambda.tags["aws.lambda.request_id"] = context.aws_request_id
                serverlessSdk.trace_spans.aws_lambda_invocation = (
                    serverlessSdk._create_trace_span(
                        "aws.lambda.invocation", start_time=request_start_time
                    )
                )

                diff = int((time.perf_counter_ns() - request_start_time) / 1000_000)
                debug_log("Overhead duration: Internal request:" + f"{diff}ms")

            except Exception:
                logger.exception("Unhandled exception during instrumentation.")
                return user_handler(event, context)

            # Invocation of customer code
            try:
                result = user_handler(event, context)
                self._close_trace("success", result)
                return result
            except BaseException as ex:  # catches all exceptions, including SystemExit.
                if isinstance(ex, Exception):
                    self._close_trace("error:handled", ex)
                else:
                    self._close_trace("error:unhandled", ex)
                raise

        return stub
