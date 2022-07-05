import logging
import os
import platform
import sys
from importlib import import_module
from traceback import TracebackException
from typing import Any, Callable, Collection, Dict, Optional, cast

import psutil
from opentelemetry.attributes import BoundedAttributes  # type: ignore
from opentelemetry.context.context import Context
from opentelemetry.instrumentation.instrumentor import BaseInstrumentor  # type: ignore
from opentelemetry.instrumentation.utils import unwrap
from opentelemetry.propagators.aws.aws_xray_propagator import TRACE_HEADER_KEY, AwsXRayPropagator
from opentelemetry.sdk.trace import ReadableSpan, Span, Tracer, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import SpanKind, Status, StatusCode, get_current_span, get_tracer, get_tracer_provider
from opentelemetry.util._time import _time_ns
from wrapt import wrap_function_wrapper  # type: ignore

from serverless.aws_lambda_otel_extension.aws_lambda.event_detectors import detect_lambda_event_type
from serverless.aws_lambda_otel_extension.shared.constants import (
    _X_AMZN_TRACE_ID_ENV_VAR,
    PACKAGE_NAMESPACE,
    PACKAGE_VERSION,
)
from serverless.aws_lambda_otel_extension.shared.enums import LambdaEventType
from serverless.aws_lambda_otel_extension.shared.environment import (
    ENV__HANDLER,
    ENV_AWS_DEFAULT_REGION,
    ENV_AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    ENV_AWS_LAMBDA_FUNCTION_NAME,
    ENV_AWS_LAMBDA_FUNCTION_VERSION,
    ENV_AWS_LAMBDA_LOG_GROUP_NAME,
    ENV_AWS_LAMBDA_LOG_STREAM_NAME,
    ENV_AWS_REGION,
    ENV_ORIG_HANDLER,
)
from serverless.aws_lambda_otel_extension.shared.settings import sls_otel_extension_flush_timeout
from serverless.aws_lambda_otel_extension.shared.store import store
from serverless.aws_lambda_otel_extension.shared.utilities import (
    extract_account_id_from_invoked_function_arn,
    filter_dict_values_is_not_none,
)
from serverless.aws_lambda_otel_extension.span_attributes.extension import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.span_attributes.overloaded import OverloadedSpanAttributes

_InstrumentorHookT = Optional[Callable[[Span, Dict, Any], None]]
_RequestHookT = Optional[Callable[[Span, Dict, Any], None]]
_ResponseHookT = Optional[Callable[[Span, Dict, Any, Dict], None]]

logger = logging.getLogger(__name__)


def _filtered_attributes(attributes: Dict) -> Dict:
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


def _instrument(
    wrapped_module_name: str,
    wrapped_function_name: str,
    flush_timeout: int,
    request_hook: _RequestHookT = None,
    response_hook: _ResponseHookT = None,
    tracer_provider: Optional[TracerProvider] = None,
):

    # TODO: Talk to OpenTelemetry devs about generic types... ugh...
    if not tracer_provider:
        tracer_provider = cast(TracerProvider, get_tracer_provider())

    package_tracer = cast(Tracer, get_tracer(PACKAGE_NAMESPACE, PACKAGE_VERSION, tracer_provider))
    tracer = cast(Tracer, get_tracer(__name__, PACKAGE_VERSION, tracer_provider))

    temporary_tracer_provider = cast(TracerProvider, TracerProvider())
    temporary_tracer = cast(Tracer, get_tracer(__name__, PACKAGE_VERSION, temporary_tracer_provider))

    # Due to a chicken/egg issue with how we currently send telemetry - we need to rely on temporarily adding a span
    # processor to the tracer provider that will cache all spans in memory for the duration of the handler call.
    in_memory_span_exporter = InMemorySpanExporter()
    simple_span_processor = SimpleSpanProcessor(in_memory_span_exporter)

    tracer_provider.add_span_processor(simple_span_processor)

    def _force_flush():
        if flush_timeout is not None:
            tracer_provider.force_flush(flush_timeout)
        else:
            tracer_provider.force_flush()

    def _instrumented_lambda_handler_call(call_wrapped, instance, args, kwargs):

        lambda_handler = ENV_ORIG_HANDLER or ENV__HANDLER
        span_kind = None

        # Handle this early on so that we can be a bit more accurate.
        wrapper_start_time = _time_ns()
        process_start_time = int(psutil.Process().create_time() * 1e9)
        boot_time = int(psutil.boot_time() * 1e9)

        # Extract event and context arguments from args list.
        event = args[0]
        context = args[1]

        # Worry less about if context exists and is valid.
        context_invoked_function_arn = getattr(context, "invoked_function_arn", None)
        context_extracted_account_id = extract_account_id_from_invoked_function_arn(context_invoked_function_arn)
        context_or_env_memory_limit_in_mb = getattr(context, "memory_limit_in_mb", ENV_AWS_LAMBDA_FUNCTION_MEMORY_SIZE)
        context_or_env_function_name = getattr(context, "function_name", ENV_AWS_LAMBDA_FUNCTION_NAME)
        context_execution_id = getattr(context, "aws_request_id", None)

        # Store cold start information and make sure we dump the request ID into the store.
        store.add_execution_id(context_execution_id)

        try:
            with temporary_tracer.start_as_current_span(
                name="__detect__",
                attributes={
                    SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "detect",
                },
            ) as detect_span:
                event_type = detect_lambda_event_type(event, context)
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
                    ]
                ):
                    span_kind = SpanKind.CONSUMER
                else:
                    span_kind = SpanKind.SERVER
            store.append_pre_instrumentation_span(detect_span)
        except Exception:
            logger.exception("Exception while processing detect span")

        try:
            with temporary_tracer.start_as_current_span(
                name="__extract__",
                attributes={
                    SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "extract",
                },
            ) as extract_span:
                parent_context = _extract_handler_span_parent_context(event, context)
            store.append_pre_instrumentation_span(extract_span)
        except Exception:
            logger.exception("Exception while processing extract span")

        pre_instrumentation_spans = []

        if store.is_cold_start:
            pre_instrumentation_spans = list(store.pre_instrumentation_spans)
            store.clear_pre_instrumentation_spans()

        min_start_time = min([*[s.start_time for s in pre_instrumentation_spans], _time_ns()])

        # This is the outermost span that will be used to trace the entire instrumentation process.
        with package_tracer.start_as_current_span(
            name=context_or_env_function_name or "__instrumentation__",
            context=parent_context,
            kind=span_kind,
            attributes={
                SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "instrumentation",
            },
            start_time=min_start_time,  # Rewind the start time to the earliest span.
        ) as instrumentation_span:

            # TODO: Again... Talk to OpenTelemetry devs about generic types... super ugh...
            instrumentation_span = cast(Span, instrumentation_span)

            with tracer.start_as_current_span(
                name="__pre__",
                attributes={
                    SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "pre",
                },
                start_time=min_start_time,  # Rewind the start time to the earliest span.
            ) as start_span:
                start_span = cast(Span, start_span)

                if instrumentation_span.is_recording():
                    if context_invoked_function_arn:
                        if context_extracted_account_id:
                            instrumentation_span.set_attribute(
                                ResourceAttributes.CLOUD_ACCOUNT_ID, context_extracted_account_id
                            )
                        instrumentation_span.set_attribute(ResourceAttributes.FAAS_ID, context_invoked_function_arn)
                        instrumentation_span.set_attribute(
                            SpanAttributes.AWS_LAMBDA_INVOKED_ARN, context_invoked_function_arn
                        )
                    if context_execution_id:
                        instrumentation_span.set_attribute(SpanAttributes.FAAS_EXECUTION, context_execution_id)

                if callable(request_hook):
                    try:
                        with tracer.start_as_current_span(
                            name="__request_hook__",
                            attributes={
                                SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "request_hook",
                            },
                        ) as request_hook_span:
                            try:
                                request_hook(request_hook_span, event, context)
                            except Exception:
                                logger.exception("Exception while executing request_hook callable")
                                raise
                    except Exception:
                        logger.exception("Exception during request_hook span")

                if event_type:
                    instrumentation_span.set_attribute(SlsExtensionSpanAttributes.SLS_EVENT_TYPE, event_type.value)

                # This is just here to be pretty.
                resource_attributes = tracer_provider.resource.attributes

                # Initialize wrapper attributes.
                wrapper_attributes = BoundedAttributes()

                compute_runtime = "aws.lambda.python.{}.{}.{}".format(
                    sys.version_info.major, sys.version_info.minor, sys.version_info.micro
                )

                # Initialize base attributes.
                base_attributes = BoundedAttributes(
                    attributes=_filtered_attributes(
                        attributes={
                            # Compute/FAAS
                            "computeBootTime": int(boot_time / 1e6),
                            "computeBootTimeUnixNano": boot_time,
                            "computeCustomArn": context_invoked_function_arn,
                            "computeCustomEnvArch": platform.machine(),
                            "computeCustomFunctionVersion": ENV_AWS_LAMBDA_FUNCTION_VERSION,
                            "computeCustomLogGroupName": ENV_AWS_LAMBDA_LOG_GROUP_NAME,
                            "computeCustomLogStreamName": ENV_AWS_LAMBDA_LOG_STREAM_NAME,
                            "computeExecutionId": context_execution_id,
                            "computeIsColdStart": store.is_cold_start,
                            "computeMemorySize": context_or_env_memory_limit_in_mb,
                            "computeProcessTime": int(process_start_time / 1e6),
                            "computeProcessTimeUnixNano": process_start_time,
                            "computeRegion": ENV_AWS_REGION or ENV_AWS_DEFAULT_REGION,
                            "computeRuntime": compute_runtime,
                            "computeWrapperTime": int(wrapper_start_time / 1e6),
                            "computeWrapperTimeUnixNano": wrapper_start_time,
                            # Event Custom
                            "eventCustomAccountId": context_extracted_account_id,
                            "eventCustomDomain": None,
                            "eventCustomRequestId": context_execution_id,
                            "eventCustomRequestTimeEpoch": None,
                            "eventCustomXTraceId": os.getenv(_X_AMZN_TRACE_ID_ENV_VAR),
                            "eventType": event_type.value if event_type else None,
                            # Function
                            "functionName": context_or_env_function_name,
                        }
                    )
                )

                http_attributes = BoundedAttributes()

                if event_type in [LambdaEventType.APIGateway, LambdaEventType.APIGatewayV2]:
                    http_attributes = BoundedAttributes(
                        attributes=_filtered_attributes(
                            {
                                **http_attributes,
                                "_eventCustomRequestId": event["requestContext"]["requestId"],
                                "eventCustomAccountId": event["requestContext"]["accountId"],
                                "eventCustomApiId": event["requestContext"]["apiId"],
                                "eventCustomDomain": event["requestContext"]["domainName"],
                                "eventSource": "aws.apigateway",
                            }
                        )
                    )

                if event_type == LambdaEventType.APIGateway:
                    http_attributes = BoundedAttributes(
                        attributes=_filtered_attributes(
                            {
                                **http_attributes,
                                "eventCustomHttpMethod": event["requestContext"]["httpMethod"],
                                "eventCustomRequestTimeEpoch": event["requestContext"]["requestTimeEpoch"],
                                "eventHttpPath": event["requestContext"]["resourcePath"],
                                "httpPath": event["requestContext"]["resourcePath"],
                                "rawHttpPath": event["path"],
                            }
                        )
                    )
                elif event_type == LambdaEventType.APIGatewayV2:
                    routeKey = cast(str, event["requestContext"]["routeKey"])
                    http_attributes = BoundedAttributes(
                        attributes=_filtered_attributes(
                            {
                                **http_attributes,
                                "eventCustomHttpMethod": event["requestContext"]["http"]["method"],
                                "eventCustomRequestTimeEpoch": event["requestContext"]["timeEpoch"],
                                "eventCustomStage": event["requestContext"]["stage"],
                                "eventHttpPath": routeKey.split(" ")[1] if " " in routeKey else routeKey,
                                "httpPath": routeKey.split(" ")[1] if " " in routeKey else routeKey,
                                "rawHttpPath": event["rawPath"],
                            }
                        )
                    )

                try:
                    if event is not None:
                        store.set_request_data_for_trace_id(instrumentation_span.context.trace_id, event)
                except Exception:
                    logger.exception("Exception while setting request data for trace id")

                # Transplant pre_instrumentation_spans into the instrumentation_span.
                for pre_instrumentation_span in pre_instrumentation_spans:
                    if pre_instrumentation_span.parent is None:
                        with tracer.start_as_current_span(
                            name=pre_instrumentation_span.name,
                            kind=pre_instrumentation_span.kind,
                            attributes=_filtered_attributes(
                                {
                                    **pre_instrumentation_span.attributes,
                                }
                            ),
                            start_time=pre_instrumentation_span.start_time,
                            end_on_exit=False,
                        ) as _pre_instrumentation_span:
                            # TODO: Add in children here (by iterating over pre_instrumentation_spans for spans that match
                            # this parent.  This could get horribly recursive real fast.  There may be an easier way to
                            # transplant these spans over to this context without a bunch of hackery.
                            _pre_instrumentation_span = cast(Span, _pre_instrumentation_span)
                            _pre_instrumentation_span._events = pre_instrumentation_span.events
                        _pre_instrumentation_span.end(end_time=pre_instrumentation_span.end_time)

                if start_span.is_recording():
                    start_span.add_event(
                        name="event",
                        attributes=BoundedAttributes(
                            attributes=_filtered_attributes(
                                {
                                    **base_attributes,
                                    **http_attributes,
                                    **resource_attributes,
                                }
                            )
                        ),
                    )
            # Flush to make sure the event data is transmitted as soon as possible.
            try:
                _force_flush()
            except Exception:
                logger.exception("Exception while flushing event data")

            extracted_http_path = None
            extracted_http_status_code = None

            try:
                with tracer.start_as_current_span(
                    name=lambda_handler or "__handler__",
                    attributes={
                        SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "handler",
                    },
                ) as handler_span:

                    handler_span = cast(Span, handler_span)

                    if handler_span.is_recording():
                        handler_span.set_attribute(SpanAttributes.CODE_NAMESPACE, wrapped_module_name)
                        handler_span.set_attribute(SpanAttributes.CODE_FUNCTION, wrapped_function_name)

                    # Call the original function.
                    try:
                        result = call_wrapped(*args, **kwargs)
                    except Exception as exception:
                        # Do not raise the exception here.  The span will capture it properly and we are catching the
                        # span.
                        result = exception
                        logger.exception("Exception while calling handler function")

                    try:
                        if not isinstance(result, Exception):
                            store.set_response_data_for_trace_id(instrumentation_span.context.trace_id, result)
                    except Exception:
                        logger.exception("Exception while setting response data for trace id")

            except Exception:
                logger.exception("Exception during handler span")

            for finished_span in in_memory_span_exporter.get_finished_spans():
                finished_span = cast(ReadableSpan, finished_span)
                if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                    if finished_span.attributes:
                        extracted_http_path = finished_span.attributes.get(SpanAttributes.HTTP_ROUTE)
                        extracted_http_status_code = finished_span.attributes.get(SpanAttributes.HTTP_STATUS_CODE)

            in_memory_span_exporter.clear()

            if instrumentation_span.is_recording():
                instrumentation_span.set_attribute(SpanAttributes.HTTP_STATUS_CODE, extracted_http_status_code)
                if extracted_http_path:
                    instrumentation_span.set_attribute(OverloadedSpanAttributes.HTTP_PATH, extracted_http_path)
                if not isinstance(result, Exception):
                    instrumentation_span.set_status(Status(StatusCode.OK))

            # TODO: Revisit this to see if we should pass the exception as well.
            if not isinstance(result, Exception):
                if callable(response_hook):
                    try:
                        with tracer.start_as_current_span(
                            name="__response_hook__",
                            attributes={
                                SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "response_hook",
                            },
                        ) as response_hook_span:
                            try:
                                response_hook(response_hook_span, event, context, result)
                            except Exception:
                                logger.exception("Exception while executing response_hook callable")
                                raise
                    except Exception:
                        logger.exception("Exception during response_hook span")

            http_attributes = BoundedAttributes(
                attributes=_filtered_attributes(
                    {
                        **http_attributes,
                        "extractedHttpPath": extracted_http_path,
                        "extractedHttpStatusCode": extracted_http_status_code,
                        "httpPath": extracted_http_path,
                        "httpStatusCode": extracted_http_status_code,
                    }
                )
            )

            wrapper_attributes = BoundedAttributes(
                attributes=_filtered_attributes(
                    {
                        **wrapper_attributes,
                        "error": isinstance(result, Exception),
                        # Javascript timestamps are in milliseconds (convert from nanoseconds).
                        "startTime": int(getattr(handler_span, "start_time", 0) / 1e6) or None,
                        "endTime": int(getattr(handler_span, "end_time", 0) / 1e6) or None,
                    }
                )
            )

            if isinstance(result, Exception):
                wrapper_attributes = BoundedAttributes(
                    attributes=_filtered_attributes(
                        {
                            **wrapper_attributes,
                            "errorCulprit": str(result),
                            "errorExceptionMessage": str(result),
                            "errorExceptionType": "handled",  # FIXME: Verify this is normal
                            "errorExceptionStacktrace": "".join(TracebackException.from_exception(result).format()),
                        }
                    )
                )

            with tracer.start_as_current_span(
                name="__post__",
                attributes={
                    SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "post",
                },
            ) as finish_span:
                finish_span = cast(Span, finish_span)

                if finish_span.is_recording():
                    finish_span.add_event(
                        name="telemetry",
                        attributes=BoundedAttributes(
                            attributes=_filtered_attributes(
                                {
                                    **base_attributes,
                                    **http_attributes,
                                    **wrapper_attributes,
                                    **resource_attributes,
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
        self._wrapped_module_name, self._wrapped_function_name = lambda_handler.rsplit(".", 1)

        _instrument(
            self._wrapped_module_name,
            self._wrapped_function_name,
            flush_timeout=kwargs.get("flush_timeout", sls_otel_extension_flush_timeout),
            tracer_provider=kwargs.get("tracer_provider"),
        )

    def _uninstrument(self, **kwargs):
        unwrap(
            import_module(self._wrapped_module_name),
            self._wrapped_function_name,
        )
