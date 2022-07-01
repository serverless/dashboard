# This is a now mostly unrecognizable module based on:
#
import json
import logging
import os
import platform
import sys
from importlib import import_module
from traceback import TracebackException
from typing import Any, Collection, Dict, List, Optional, cast

from opentelemetry.attributes import BoundedAttributes  # type: ignore
from opentelemetry.context.context import Context
from opentelemetry.instrumentation.instrumentor import BaseInstrumentor  # type: ignore
from opentelemetry.instrumentation.utils import unwrap
from opentelemetry.propagate import get_global_textmap
from opentelemetry.propagators.aws.aws_xray_propagator import TRACE_HEADER_KEY, AwsXRayPropagator
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace import TracerProvider as _TracerProvider
from opentelemetry.sdk.trace import _Span
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import SpanKind, Status, StatusCode, TracerProvider, get_tracer, get_tracer_provider
from opentelemetry.trace.propagation import get_current_span
from wrapt import wrap_function_wrapper  # type: ignore

from serverless.aws_lambda_otel_extension.aws_lambda.event_detectors import detect_lambda_event_type
from serverless.aws_lambda_otel_extension.shared.constants import (
    _X_AMZN_TRACE_ID_ENV_VAR,
    HANDLER_INSTRUMENTATION_NAME,
    PACKAGE_VERSION,
)
from serverless.aws_lambda_otel_extension.shared.enums import LambdaEventType
from serverless.aws_lambda_otel_extension.shared.environment import (
    ENV__HANDLER,
    ENV_AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    ENV_AWS_LAMBDA_FUNCTION_NAME,
    ENV_AWS_LAMBDA_FUNCTION_VERSION,
    ENV_AWS_LAMBDA_LOG_GROUP_NAME,
    ENV_AWS_LAMBDA_LOG_STREAM_NAME,
    ENV_AWS_REGION,
    ENV_ORIG_HANDLER,
)
from serverless.aws_lambda_otel_extension.shared.settings import sls_otel_extension_flush_timeout
from serverless.aws_lambda_otel_extension.span_attributes.extension import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.span_attributes.overloaded import OverloadedSpanAttributes

from serverless.aws_lambda_otel_extension.shared.utilities import filter_dict_values_is_not_none

logger = logging.getLogger(__name__)


def _filtered_attributes_dict(attributes: Dict) -> Dict:
    attributes = filter_dict_values_is_not_none(attributes)
    return attributes


def _extract_handler_span_parent_context(event: Dict, context: Any) -> Optional[Context]:

    handler_parent_context = None

    xray_env_var = os.environ.get(_X_AMZN_TRACE_ID_ENV_VAR)

    if xray_env_var:
        handler_parent_context = AwsXRayPropagator().extract({TRACE_HEADER_KEY: xray_env_var})

    if handler_parent_context and get_current_span(handler_parent_context).get_span_context().trace_flags.sampled:
        return handler_parent_context

    return handler_parent_context


def _create_base_attributes(
    event: Dict, context: Any, is_cold_start: bool, event_type: LambdaEventType
) -> BoundedAttributes:

    context_invoked_function_arn: Optional[str] = getattr(context, "invoked_function_arn", None)
    context_aws_request_id: Optional[str] = getattr(context, "aws_request_id")

    attributes = {
        "computeCustomArn": context_invoked_function_arn,
        "computeCustomEnvArch": platform.machine(),
        "computeCustomFunctionVersion": ENV_AWS_LAMBDA_FUNCTION_VERSION,
        "computeCustomLogGroupName": ENV_AWS_LAMBDA_LOG_GROUP_NAME,
        "computeCustomLogStreamName": ENV_AWS_LAMBDA_LOG_STREAM_NAME,
        "computeIsColdStart": is_cold_start,
        "computeMemorySize": ENV_AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
        "computeRequestId": context_aws_request_id,
        "computeRegion": ENV_AWS_REGION,
        "computeRuntime": "aws.lambda.python.{}.{}.{}".format(
            sys.version_info.major,
            sys.version_info.minor,
            sys.version_info.micro,
        ),
        "eventCustomDomain": None,
        "eventCustomRequestId": context_aws_request_id,
        "eventCustomRequestTimeEpoch": None,
        "eventCustomXTraceId": os.getenv(_X_AMZN_TRACE_ID_ENV_VAR),
        "eventType": event_type.value if event_type else None,
        "functionName": ENV_AWS_LAMBDA_FUNCTION_NAME,
    }
    return BoundedAttributes(attributes=_filtered_attributes_dict(attributes))


def _create_http_attributes(
    event: Dict, context: Any, is_cold_start: bool, event_type: LambdaEventType
) -> BoundedAttributes:

    http_path: Optional[str] = None

    if event_type in [LambdaEventType.APIGateway, LambdaEventType.APIGatewayV2]:
        attributes = {
            "eventCustomAccountId": event["requestContext"]["accountId"],
            "eventCustomApiId": event["requestContext"]["apiId"],
            "eventCustomDomain": event["requestContext"]["domainName"],
            "_eventCustomRequestId": event["requestContext"]["requestId"],
            "eventSource": "aws.apigateway",
        }
    else:
        attributes = {}

    if event_type == LambdaEventType.APIGateway:

        http_path = event["requestContext"]["resourcePath"]

        attributes = {
            **attributes,
            "eventCustomHttpMethod": event["requestContext"]["httpMethod"],
            "eventCustomRequestTimeEpoch": event["requestContext"]["requestTimeEpoch"],
            "httpPath": http_path,
            "rawHttpPath": event["path"],
        }
    elif event_type == LambdaEventType.APIGatewayV2:

        routeKey = cast(str, event["requestContext"]["routeKey"])

        if " " in routeKey:
            http_path = routeKey.split(" ")[1]
        else:
            http_path = routeKey

        attributes = {
            **attributes,
            "eventCustomHttpMethod": event["requestContext"]["http"]["method"],
            "eventCustomRequestTimeEpoch": event["requestContext"]["timeEpoch"],
            "eventCustomStage": event["requestContext"]["stage"],
            "httpPath": http_path,
            "rawHttpPath": event["rawPath"],
        }

    return BoundedAttributes(attributes=_filtered_attributes_dict(attributes))


def _create_wrapper_attributes(
    event: Dict, context: Any, is_cold_start: bool, event_type: LambdaEventType
) -> BoundedAttributes:
    # Right now this is all there is. We may want to this at a later point.
    return BoundedAttributes(attributes={})


def _instrument(
    wrapped_module_name: str,
    wrapped_function_name: str,
    handled_request_ids: List[str],
    flush_timeout: Optional[int],
    tracer_provider: Optional[TracerProvider] = None,
):
    def _instrumented_lambda_handler_call(call_wrapped, instance, args, kwargs):

        lambda_handler = ENV_ORIG_HANDLER or ENV__HANDLER

        empty_context = get_global_textmap().extract({})

        # Operate off of the following variable from now on when referencing the tracer provider.  This is a workaround
        # to deal with some typing related issues.
        _tracer_provider = cast(_TracerProvider, tracer_provider or get_tracer_provider())

        def _force_flush():
            if flush_timeout is not None:
                _tracer_provider.force_flush(flush_timeout)
            else:
                _tracer_provider.force_flush()

        # Snapshot the cold start value.  Empty aws_request_ids means no events have been handled yet and this
        # invocation should be considered a cold start.
        is_cold_start = len(handled_request_ids) == 0

        # Extract event and context arguments from args list.
        event = args[0]
        context = args[1]

        # Worry less about if context exists and is valid.
        context_invoked_function_arn: Optional[str] = getattr(context, "invoked_function_arn", None)
        context_aws_request_id: Optional[str] = getattr(context, "aws_request_id", None)

        # Append the request id to the global list of request ids.
        handled_request_ids.append(context_aws_request_id)

        span_kind = None

        resource_attributes = _tracer_provider.resource.attributes

        handler_tracer = get_tracer(HANDLER_INSTRUMENTATION_NAME, PACKAGE_VERSION, _tracer_provider)
        internal_tracer = get_tracer(__name__, PACKAGE_VERSION, _tracer_provider)

        # This is the outermost span that will be used to trace the entire instrumentation process.
        with internal_tracer.start_as_current_span(name="wrapper") as wrapper_span:  # noqa: F841
            wrapper_span = cast(_Span, wrapper_span)

            event_type: Optional[LambdaEventType] = None
            parent_context = None

            with internal_tracer.start_as_current_span(name="start") as start_span:
                start_span = cast(_Span, start_span)

                try:
                    with internal_tracer.start_as_current_span(name="detect") as detect_span:
                        detect_span = cast(_Span, detect_span)
                        event_type = detect_lambda_event_type(event, context)
                except Exception:
                    logger.exception("Exception while detecting event type")

                try:
                    with internal_tracer.start_as_current_span(name="extract") as extract_span:
                        extract_span = cast(_Span, extract_span)
                        parent_context = _extract_handler_span_parent_context(event, context) or empty_context

                except Exception:
                    logger.exception("Exception while extracting parent context")

                base_attributes = _create_base_attributes(event, context, is_cold_start, event_type)
                http_attributes = _create_http_attributes(event, context, is_cold_start, event_type)
                wrapper_attributes = _create_wrapper_attributes(event, context, is_cold_start, event_type)

                if start_span.is_recording():
                    start_span.add_event(
                        name="event",
                        attributes=BoundedAttributes(
                            attributes=_filtered_attributes_dict(
                                {
                                    **base_attributes,
                                    **http_attributes,
                                    **resource_attributes,
                                }
                            )
                        ),
                    )
                    start_span.add_event(
                        name="request",
                        attributes=BoundedAttributes(
                            attributes={
                                SlsExtensionSpanAttributes.SLS_HANDLER_REQUEST_JSON: bytes(json.dumps(event), "utf-8"),
                            }
                        ),
                    )

            # Flush the above finished span to make sure the event data is transmitted.
            try:
                _force_flush()
            except Exception:
                logger.exception("Exception while flushing event data")

            if event_type in set(
                [
                    LambdaEventType.CloudWatchEvent,
                    LambdaEventType.CloudWatchLog,
                    LambdaEventType.DynamoDB,
                    LambdaEventType.Kinesis,
                    LambdaEventType.S3,
                    LambdaEventType.Scheduled,
                    LambdaEventType.SES,
                    LambdaEventType.SNS,
                    LambdaEventType.SQS,
                    # TODO: Add more here.
                ]
            ):
                span_kind = SpanKind.CONSUMER
            else:
                span_kind = SpanKind.SERVER

            overloaded_http_path: Optional[str] = None
            http_status_code: Optional[str] = None

            if wrapper_span.is_recording():
                if event_type:
                    wrapper_span.set_attribute(SlsExtensionSpanAttributes.SLS_EVENT_TYPE, event_type.value)

            try:
                with handler_tracer.start_as_current_span(
                    name=lambda_handler, context=parent_context, kind=span_kind, links=[wrapper_span]
                ) as handler_span:

                    handler_span = cast(_Span, handler_span)

                    if handler_span.is_recording():
                        if context_invoked_function_arn:
                            handler_span.set_attribute(ResourceAttributes.FAAS_ID, context_invoked_function_arn)
                            handler_span.set_attribute(
                                SpanAttributes.AWS_LAMBDA_INVOKED_ARN, context_invoked_function_arn
                            )
                        if context_aws_request_id:
                            handler_span.set_attribute(SpanAttributes.FAAS_EXECUTION, context_aws_request_id)

                        handler_span.set_attribute(SpanAttributes.CODE_NAMESPACE, wrapped_module_name)
                        handler_span.set_attribute(SpanAttributes.CODE_FUNCTION, wrapped_function_name)

                    # Due to a chicken/egg issue with how we currently send telemetry - we need to rely on temporarily adding a span
                    # processor to the tracer provider that will cache all spans in memory for the duration of the handler call.
                    in_memory_span_exporter = InMemorySpanExporter()
                    simple_span_processor = SimpleSpanProcessor(in_memory_span_exporter)

                    _tracer_provider.add_span_processor(simple_span_processor)

                    # Call the original function.
                    result = call_wrapped(*args, **kwargs)

                    simple_span_processor.shutdown()

                    for finished_span in in_memory_span_exporter.get_finished_spans():
                        finished_span = cast(ReadableSpan, finished_span)
                        if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                            if finished_span.attributes:
                                overloaded_http_path = finished_span.attributes.get(SpanAttributes.HTTP_ROUTE)
                                http_status_code = finished_span.attributes.get(SpanAttributes.HTTP_STATUS_CODE)

                    in_memory_span_exporter.clear()

                    # TODO: Add in a check here for a status code return of 500 if we are an http specific handler and
                    # set the status to Error and set the description
                    if handler_span.is_recording():
                        # Attribute gleaned http path from nested spans.
                        if overloaded_http_path:
                            handler_span.set_attribute(OverloadedSpanAttributes.HTTP_PATH, overloaded_http_path)
                        handler_span.set_status(Status(StatusCode.OK))

            except Exception as exception:
                result = exception

            http_attributes = BoundedAttributes(
                attributes=_filtered_attributes_dict(
                    {
                        **http_attributes,
                        OverloadedSpanAttributes.HTTP_PATH: overloaded_http_path,
                        SpanAttributes.HTTP_STATUS_CODE: http_status_code,
                    }
                )
            )

            wrapper_attributes = BoundedAttributes(
                attributes=_filtered_attributes_dict(
                    {
                        **wrapper_attributes,
                        "error": isinstance(result, Exception),
                        # Javascript timestamps are in milliseconds (convert from nanoseconds).
                        "startTime": int(getattr(handler_span, "start_time", 0) / 1000000) or None,
                        "endTime": int(getattr(handler_span, "end_time", 0) / 1000000) or None,
                    }
                )
            )

            if isinstance(result, Exception):
                wrapper_attributes = BoundedAttributes(
                    attributes=_filtered_attributes_dict(
                        {
                            **wrapper_attributes,
                            "errorCulprit": str(result),
                            "errorExceptionMessage": str(result),
                            "errorExceptionType": "handled",  # FIXME: Verify this is normal
                            "errorExceptionStacktrace": "".join(TracebackException.from_exception(result).format()),
                        }
                    )
                )

            with internal_tracer.start_as_current_span(name="finish") as finish_span:
                finish_span = cast(_Span, finish_span)

                if finish_span.is_recording():
                    finish_span.add_event(
                        name="telemetry",
                        attributes=BoundedAttributes(
                            attributes=_filtered_attributes_dict(
                                {
                                    **base_attributes,
                                    **http_attributes,
                                    **wrapper_attributes,
                                    **resource_attributes,
                                }
                            )
                        ),
                    )

                    result_json: Optional[bytes] = None
                    result_representation: Optional[bytes] = None

                    try:
                        # Serialize the result to JSON to include into a telemetry event.  This will be loaded by the
                        # exporter and passed to the extension service.
                        result_json = bytes(json.dumps(result), "utf-8")
                    except Exception:
                        # If for any reason result_json can't be assigned then we should attempt to provide a
                        # representation in the event instead.
                        result_representation = bytes(repr(result), "utf-8")

                    finish_span.add_event(
                        name="response",
                        attributes=BoundedAttributes(
                            attributes=_filtered_attributes_dict(
                                {
                                    SlsExtensionSpanAttributes.SLS_HANDLER_RESPONSE_JSON: result_json,
                                    SlsExtensionSpanAttributes.SLS_HANDLER_RESPONSE_REPRESENTATION: result_representation,
                                }
                            )
                        ),
                    )

        try:
            _force_flush
        except Exception:
            logger.exception("Exception while flushing telemetry data")

        if isinstance(result, Exception):
            raise result
        else:
            return result

    wrap_function_wrapper(
        wrapped_module_name,
        wrapped_function_name,
        _instrumented_lambda_handler_call,
    )


class SlsAwsLambdaInstrumentor(BaseInstrumentor):
    def instrumentation_dependencies(self) -> Collection[str]:
        return tuple(())

    def _instrument(self, **kwargs):

        lambda_handler = ENV_ORIG_HANDLER or ENV__HANDLER
        handled_request_ids = []
        self._wrapped_module_name, self._wrapped_function_name = lambda_handler.rsplit(".", 1)

        _instrument(
            self._wrapped_module_name,
            self._wrapped_function_name,
            handled_request_ids,
            flush_timeout=kwargs.get("flush_timeout", sls_otel_extension_flush_timeout),
            tracer_provider=kwargs.get("tracer_provider"),
        )

    def _uninstrument(self, **kwargs):
        unwrap(
            import_module(self._wrapped_module_name),
            self._wrapped_function_name,
        )
