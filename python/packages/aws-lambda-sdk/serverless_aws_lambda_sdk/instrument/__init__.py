from __future__ import annotations

from sls_sdk.lib.imports import internally_imported

with internally_imported():
    import os
    import time
    import sys
    import copy
    import json
    from typing import List, Optional, Any, Set

    if sys.version_info >= (3, 8):
        from typing import Final
    else:
        from typing_extensions import Final
    import random

    import base64
    import gzip

from sls_sdk.lib.timing import to_protobuf_epoch_timestamp
from sls_sdk.lib.imports import internally_imported
from sls_sdk.lib.trace import TraceSpan
from sls_sdk.lib.captured_event import CapturedEvent
from .lib.sdk import serverlessSdk
from .lib.invocation_context import (
    set as set_invocation_context,
    get as get_invocation_context,
)
from .lib.payload_conversion import to_trace_payload, to_request_response_payload
from .lib.event_tags import resolve as resolve_event_tags
from .lib.response_tags import resolve as resolve_response_tags
from .lib.api_events import is_api_event
from .lib.captured_event import should_include as should_include_event_captured_event


MAX_LOG_LINE_LENGTH = 256 * 1024

CORE_TRACE_SPAN_NAMES = [
    "aws.lambda",
    "aws.lambda.initialization",
    "aws.lambda.invocation",
]


def debug_log(msg):
    if serverlessSdk._is_debug_mode:
        print(f"⚡ SDK: {msg}", file=sys.stderr)


__all__: Final[List[str]] = [
    "instrument",
]


def _get_result_log_text(
    spans: list[TraceSpan],
    captured_events: list[CapturedEvent],
    custom_tags: Optional[str],
    is_sampled_out: bool,
    is_truncated: bool,
) -> str:
    def _convert_span(span: TraceSpan) -> dict[str, Any]:
        span_payload = span.to_protobuf_dict()
        del span_payload["input"]
        del span_payload["output"]
        return span_payload

    payload_dct = {
        "isSampledOut": is_sampled_out or None,
        "isTruncated": is_truncated or None,
        "slsTags": {
            "orgId": serverlessSdk.org_id,
            "service": os.environ.get("AWS_LAMBDA_FUNCTION_NAME", None),
            "sdk": {
                "name": serverlessSdk.name,
                "version": serverlessSdk.version,
                "runtime": "python",
            },
        },
        "spans": [_convert_span(s) for s in spans],
        "events": [e.to_protobuf_dict() for e in captured_events],
        "customTags": custom_tags,
    }

    payload = to_trace_payload(payload_dct)
    compressed_payload = gzip.compress(payload.SerializeToString())
    serialized = base64.b64encode(compressed_payload).decode("utf-8")
    return f"SERVERLESS_TELEMETRY.TZ.{serialized}"


def _resolve_outcome_enum_value(outcome: str) -> int:
    if outcome == "success":
        return 1
    if outcome == "error:handled":
        return 5
    if outcome == "error:unhandled":
        return 3
    raise Exception(f"Unexpected outcome value: {outcome}")


def _resolve_body_string(data, prefix):
    if data is None:
        return None
    if (
        serverlessSdk.trace_spans.aws_lambda.tags.get("aws.lambda.event_source")
        == "aws.apigateway"
    ):
        if "body" in data and isinstance(data["body"], str):
            if "isBase64Encoded" in data and data["isBase64Encoded"]:
                data = copy.copy(data)
                del data["body"]
                serverlessSdk._report_notice(
                    "Binary body excluded",
                    f"{prefix}_BODY_BINARY",
                    serverlessSdk.trace_spans.aws_lambda,
                )
    stringified_body = json.dumps(data, default=str)
    if len(stringified_body) > 1024 * 127:
        serverlessSdk._report_notice(
            "Large body excluded",
            f"{prefix}_BODY_TOO_LARGE",
            serverlessSdk.trace_spans.aws_lambda,
        )
        return None
    return stringified_body


class Instrumenter:
    """This class is instantiated once per AWS Lambda Runtime environment.

    The instance is reused through subsequent requests, if any.
    """

    def __init__(self):
        self.previous_invocation_end_time = None
        self.gaps_between_invocations = []
        self.is_after_not_sampled_out_api_request = False
        self.current_invocation_id = 0
        serverlessSdk._captured_events = []
        self.dev_mode = None
        serverlessSdk._event_emitter.on("captured-event", self._captured_event_handler)
        serverlessSdk._event_emitter.on(
            "trace-span-close", self._trace_span_close_handler
        )
        serverlessSdk._initialize()

        self.aws_lambda = serverlessSdk.trace_spans.aws_lambda
        if not serverlessSdk.org_id:
            raise Exception(
                "Serverless SDK Error: Cannot instrument function: "
                + '"orgId" not provided. '
                + 'Ensure "SLS_ORG_ID" environment variable is set, '
                + "or pass it with the options\n"
            )

        if serverlessSdk._is_dev_mode:
            from .lib.dev_mode import get_dev_mode_thread

            self.dev_mode = get_dev_mode_thread()

        serverlessSdk.trace_spans.aws_lambda_initialization.close()

    def _captured_event_handler(self, captured_event: CapturedEvent):
        serverlessSdk._captured_events.append(captured_event)
        # Only report captured events, if dev mode is active and the event is not
        # a dev mode server issue, to prevent infinite loops.
        if self.dev_mode and not (
            captured_event.custom_fingerprint
            and captured_event.custom_fingerprint.startswith("DEV_MODE_SERVER")
        ):
            self.dev_mode.add_captured_event(captured_event)

    def _trace_span_close_handler(self, span):
        if self.dev_mode:
            self.dev_mode.add_span(span)

    def _report_request(self, event, context):
        payload_dct = serverlessSdk._last_request = {
            "slsTags": {
                "orgId": serverlessSdk.org_id,
                "service": os.environ.get("AWS_LAMBDA_FUNCTION_NAME", None),
                "sdk": {
                    "name": serverlessSdk.name,
                    "version": serverlessSdk.version,
                    "runtime": "python",
                },
            },
            "traceId": self.aws_lambda.trace_id,
            "spanId": self.aws_lambda.id,
            "requestId": context.aws_request_id,
            "timestamp": to_protobuf_epoch_timestamp(
                serverlessSdk.trace_spans.aws_lambda_invocation.start_time
            ),
            "body": _resolve_body_string(event, "INPUT"),
            "origin": 1,
        }
        payload_buffer = (
            serverlessSdk._last_request_buffer
        ) = to_request_response_payload(payload_dct)
        return self.dev_mode.add_request_response_payload(
            payload_buffer.SerializeToString(),
        )

    def _report_response(self, response, context, end_time):
        response_string = _resolve_body_string(response, "OUTPUT")
        payload_dct = serverlessSdk._last_response = {
            "slsTags": {
                "orgId": serverlessSdk.org_id,
                "service": os.environ.get("AWS_LAMBDA_FUNCTION_NAME", None),
                "sdk": {
                    "name": serverlessSdk.name,
                    "version": serverlessSdk.version,
                    "runtime": "python",
                },
            },
            "traceId": self.aws_lambda.trace_id,
            "spanId": self.aws_lambda.id,
            "requestId": context.aws_request_id,
            "timestamp": to_protobuf_epoch_timestamp(end_time),
            "body": response_string,
            "origin": 2,
        }
        payload_buffer = (
            serverlessSdk._last_response_buffer
        ) = to_request_response_payload(payload_dct)
        self.dev_mode.add_request_response_payload(payload_buffer.SerializeToString())

    def _report_trace(self, is_error_outcome: bool):
        should_set_is_after_not_sampled_out_api_request = False
        _is_api_event = is_api_event()

        def calculate_is_sampled_out():
            # This function determines if a trace should be sampled out or not
            nonlocal should_set_is_after_not_sampled_out_api_request
            if is_error_outcome:
                return False  # Do not sample out when invocation ends with error
            if serverlessSdk._is_debug_mode:
                return False  # Do not sample out when in debug mode
            if serverlessSdk._is_dev_mode:
                return False  # Do not sample out when in dev mode
            if [
                e
                for e in serverlessSdk._captured_events
                if e.name
                in [
                    "telemetry.error.generated.v1",
                ]
            ]:
                return False  # Do not sample out when any error event is captured
            if self.is_after_not_sampled_out_api_request:
                # Do not sample out two consecutive API requests
                # # (to handle OPTIONS + actual request)
                if _is_api_event:
                    return False

            # Do not sample out until we gather durations for
            # at least 5 between-invocation gaps
            if len(self.gaps_between_invocations) < 5:
                return False
            # Do not sample out if average gap between invocations
            # is greater than 1 second
            if (
                sum(self.gaps_between_invocations) / len(self.gaps_between_invocations)
                > 1_000_000
            ):
                return False

            # Set sampling rate at 20%
            # (for API we apply correction as requests are passed through in pairs)
            if random.random() > (0.1 if _is_api_event else 0.2):
                return True

            should_set_is_after_not_sampled_out_api_request = _is_api_event
            return False

        is_sampled_out = calculate_is_sampled_out()

        if self.is_after_not_sampled_out_api_request:
            self.is_after_not_sampled_out_api_request = False
        elif should_set_is_after_not_sampled_out_api_request:
            self.is_after_not_sampled_out_api_request = True

        def _filter_spans_if_sampled_out(span: TraceSpan) -> bool:
            nonlocal is_sampled_out
            if is_sampled_out and span.name not in CORE_TRACE_SPAN_NAMES:
                return False
            return True

        payload_spans = list(
            filter(_filter_spans_if_sampled_out, self.aws_lambda.spans)
        )
        payload_captured_events = (
            []
            if is_sampled_out
            else list(
                filter(
                    should_include_event_captured_event, serverlessSdk._captured_events
                )
            )
        )
        payload_custom_tags = (
            json.dumps(serverlessSdk._custom_tags) if not is_sampled_out else None
        )

        is_truncated = False

        result_log_text = _get_result_log_text(
            payload_spans,
            payload_captured_events,
            payload_custom_tags,
            is_sampled_out,
            is_truncated,
        )
        if len(result_log_text) <= MAX_LOG_LINE_LENGTH:
            return print(result_log_text)

        debug_log(
            f"Payload size ({len(result_log_text)}) "
            f"exceeds maximum size ({MAX_LOG_LINE_LENGTH}). "
            "Attempting truncation"
        )

        # 1st Truncation attempt
        # Strip all non-warning and non-error events
        # Strip all spans that are not parents of error or warning events
        spans_with_warnings: Set[TraceSpan] = set()
        spans_with_errors: Set[TraceSpan] = set()

        def _filter_warning_and_error_events(event: CapturedEvent) -> bool:
            nonlocal is_truncated
            target_set = None
            if event.name == "telemetry.error.generated.v1":
                target_set = spans_with_errors
            elif event.name == "telemetry.warning.generated.v1":
                target_set = spans_with_warnings
            else:
                is_truncated = True
                return False
            current_span = event.trace_span
            while current_span:
                target_set.add(current_span)
                current_span = current_span.parent_span
            return True

        payload_captured_events = list(
            filter(_filter_warning_and_error_events, payload_captured_events)
        )

        def _filter_spans_that_are_parents_of_warning_and_error_events(
            span: TraceSpan,
        ) -> bool:
            nonlocal is_truncated
            if span.name in CORE_TRACE_SPAN_NAMES:
                return True
            if span in spans_with_errors or span in spans_with_warnings:
                return True
            is_truncated = True
            return False

        payload_spans = list(
            filter(
                _filter_spans_that_are_parents_of_warning_and_error_events,
                payload_spans,
            )
        )

        if is_truncated:
            result_log_text = _get_result_log_text(
                payload_spans,
                payload_captured_events,
                payload_custom_tags,
                is_sampled_out,
                is_truncated,
            )
            if len(result_log_text) <= MAX_LOG_LINE_LENGTH:
                return print(result_log_text)

            debug_log(
                f"Payload size ({len(result_log_text)}) "
                f"exceeds maximum size ({MAX_LOG_LINE_LENGTH}). "
                "Attempting truncation #2"
            )

        # 2nd Truncation attempt
        # Strip all custom tags
        if payload_custom_tags:
            result_log_text = _get_result_log_text(
                payload_spans,
                payload_captured_events,
                None,
                is_sampled_out,
                is_truncated,
            )
            if len(result_log_text) <= MAX_LOG_LINE_LENGTH:
                return print(result_log_text)

            debug_log(
                f"Payload size ({len(result_log_text)}) "
                f"exceeds maximum size ({MAX_LOG_LINE_LENGTH}). "
                "Attempting truncation #3"
            )

        # 3rd Truncation attempt
        # Strip all warning events and related spans
        is_truncated = False

        def _filter_error_events_and_related_spans(event: CapturedEvent) -> bool:
            nonlocal is_truncated
            if event.name == "telemetry.error.generated.v1":
                return True
            else:
                is_truncated = True
                return False

        payload_captured_events = list(
            filter(_filter_error_events_and_related_spans, payload_captured_events)
        )
        if is_truncated:
            payload_spans = [
                s
                for s in payload_spans
                if s.name in CORE_TRACE_SPAN_NAMES or s in spans_with_errors
            ]
            result_log_text = _get_result_log_text(
                payload_spans,
                payload_captured_events,
                None,
                is_sampled_out,
                is_truncated,
            )
            if len(result_log_text) <= MAX_LOG_LINE_LENGTH:
                return print(result_log_text)

            debug_log(
                f"Payload size ({len(result_log_text)}) "
                f"exceeds maximum size ({MAX_LOG_LINE_LENGTH}). "
                "Attempting truncation #4"
            )

        # 4th Truncation attempt
        # Strip all error events
        # Strip all non-core spans
        payload_captured_events = [
            e for e in payload_captured_events if e.tags.get("error.type") == 1
        ]
        payload_spans = [s for s in payload_spans if s.name in CORE_TRACE_SPAN_NAMES]
        result_log_text = _get_result_log_text(
            payload_spans,
            payload_captured_events,
            None,
            is_sampled_out,
            is_truncated,
        )
        return print(result_log_text)

    def _flush_and_close_event_loop(self):
        if self.dev_mode:
            self.dev_mode.terminate()
            self.dev_mode = None

    @internally_imported()
    def _close_trace(self, outcome: str, outcome_result: Optional[Any] = None):
        self.is_root_span_reset = False
        try:
            end_time = time.perf_counter_ns()
            is_error_outcome = outcome.startswith("error:")

            self.aws_lambda.tags["aws.lambda.outcome"] = _resolve_outcome_enum_value(
                outcome
            )
            if is_error_outcome:
                serverlessSdk.capture_error(
                    outcome_result, type="unhandled", timestamp=end_time
                )
            else:
                resolve_response_tags(outcome_result)

            if (
                serverlessSdk._is_dev_mode
                and not serverlessSdk._settings.disable_request_response_monitoring
                and not is_error_outcome
            ):
                self._report_response(
                    outcome_result, get_invocation_context(), end_time
                )
            if not serverlessSdk.trace_spans.aws_lambda_initialization.end_time:
                serverlessSdk.trace_spans.aws_lambda_initialization.close(
                    end_time=end_time
                )

            if serverlessSdk.trace_spans.aws_lambda_invocation:
                serverlessSdk.trace_spans.aws_lambda_invocation.close(end_time=end_time)

            self.aws_lambda.close(end_time=end_time)
            self._flush_and_close_event_loop()

            if get_invocation_context():
                self._report_trace(is_error_outcome)
            self._clear_root_span()

            self.previous_invocation_end_time = time.time_ns()
            debug_log(
                "Overhead duration: Internal response:"
                + f"{int((time.perf_counter_ns() - end_time) / 1000_000)}ms"
            )

        except Exception as ex:
            serverlessSdk._report_error(ex)
            if not self.is_root_span_reset:
                self._clear_root_span()

    def _clear_root_span(self):
        self.aws_lambda.clear()
        del self.aws_lambda.id
        del self.aws_lambda.trace_id
        del self.aws_lambda.end_time
        serverlessSdk._captured_events = []
        serverlessSdk._custom_tags.clear()
        self.is_root_span_reset = True

    def _handler(self, user_handler, event, context):
        request_start_time = time.perf_counter_ns()
        self.current_invocation_id += 1
        with internally_imported():
            try:
                debug_log("Invocation: start")
                set_invocation_context(context)

                if self.previous_invocation_end_time:
                    self.gaps_between_invocations.append(
                        time.time_ns() - self.previous_invocation_end_time
                    )
                    self.previous_invocation_end_time = None
                    if len(self.gaps_between_invocations) > 5:
                        self.gaps_between_invocations.pop(0)

                if self.current_invocation_id > 1:
                    self.aws_lambda.start_time = request_start_time

                self.aws_lambda.tags["aws.lambda.request_id"] = context.aws_request_id

                # Event loop may already be active in case of a cold start
                # That's why we create it only if it's not already set
                if serverlessSdk._is_dev_mode and self.dev_mode is None:
                    from .lib.dev_mode import get_dev_mode_thread

                    self.dev_mode = get_dev_mode_thread()

                serverlessSdk.trace_spans.aws_lambda_invocation = (
                    serverlessSdk._create_trace_span(
                        "aws.lambda.invocation", start_time=request_start_time
                    )
                )
                resolve_event_tags(event)
                if (
                    serverlessSdk._is_dev_mode
                    and not serverlessSdk._settings.disable_request_response_monitoring
                ):
                    self._report_request(event, context)

                diff = int((time.perf_counter_ns() - request_start_time) / 1000_000)
                debug_log("Overhead duration: Internal request:" + f"{diff}ms")

            except Exception as ex:
                serverlessSdk._report_error(ex)
                return user_handler(event, context)

        # Invocation of customer code
        try:
            result = user_handler(event, context)
        except BaseException as ex:  # catches all exceptions, including SystemExit.
            if isinstance(ex, Exception):
                self._close_trace("error:handled", ex)
            else:
                self._close_trace("error:unhandled", ex)
            raise
        self._close_trace("success", result)
        return result

    def instrument(self, user_handler_generator):
        user_handler = None

        def stub(event, context):
            nonlocal user_handler
            try:
                if not user_handler:
                    user_handler = user_handler_generator()
                return self._handler(user_handler, event, context)
            finally:
                self._flush_and_close_event_loop()

        return stub
