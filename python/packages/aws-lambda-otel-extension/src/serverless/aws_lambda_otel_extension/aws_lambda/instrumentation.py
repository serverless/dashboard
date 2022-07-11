import logging
import os
import platform
import sys
from importlib import import_module
from traceback import TracebackException
from typing import Any, Callable, Collection, Dict, Optional, Tuple, cast

import psutil
from opentelemetry.attributes import BoundedAttributes  # type: ignore
from opentelemetry.context.context import Context
from opentelemetry.instrumentation.instrumentor import BaseInstrumentor  # type: ignore
from opentelemetry.instrumentation.utils import unwrap
from opentelemetry.propagate import get_global_textmap
from opentelemetry.propagators.aws.aws_xray_propagator import TRACE_HEADER_KEY
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
from serverless.aws_lambda_otel_extension.shared.settings import SETTINGS_SLS_EXTENSION_FLUSH_TIMEOUT
from serverless.aws_lambda_otel_extension.shared.store import store
from serverless.aws_lambda_otel_extension.shared.utilities import (
    extract_account_id_from_invoked_function_arn,
    filter_dict_values_is_not_none,
)
from serverless.aws_lambda_otel_extension.span_attributes.extension import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.span_attributes.overloaded import OverloadedSpanAttributes
from serverless.aws_lambda_otel_extension.workers.http import http_client_worker_pool

_InstrumentorHookT = Optional[Callable[[Span, Dict, Any], None]]
_RequestHookT = Optional[Callable[[Span, Dict, Any], None]]
_ResponseHookT = Optional[Callable[[Span, Dict, Any, Dict], None]]

logger = logging.getLogger(__name__)

CLOUD_ACCOUNT_ID = ResourceAttributes.CLOUD_ACCOUNT_ID
FAAS_ID = ResourceAttributes.FAAS_ID

FAAS_EXECUTION = SpanAttributes.FAAS_EXECUTION
AWS_LAMBDA_INVOKED_ARN = SpanAttributes.AWS_LAMBDA_INVOKED_ARN
CODE_NAMESPACE = SpanAttributes.CODE_NAMESPACE
CODE_FUNCTION = SpanAttributes.CODE_FUNCTION
HTTP_ROUTE = SpanAttributes.HTTP_ROUTE
HTTP_STATUS_CODE = SpanAttributes.HTTP_STATUS_CODE

SLS_EVENT_TYPE = SlsExtensionSpanAttributes.SLS_EVENT_TYPE
SLS_HANDLER_EXTRACTED = SlsExtensionSpanAttributes.SLS_HANDLER_EXTRACTED
SLS_HANDLER_FINAL = SlsExtensionSpanAttributes.SLS_HANDLER_FINAL
SLS_HANDLER_INITIAL = SlsExtensionSpanAttributes.SLS_HANDLER_INITIAL
SLS_SPAN_TYPE = SlsExtensionSpanAttributes.SLS_SPAN_TYPE

HTTP_PATH = OverloadedSpanAttributes.HTTP_PATH


def _filtered_attributes(attributes: Dict) -> Dict:
    attributes = filter_dict_values_is_not_none(attributes)
    return attributes


def _extract_handler_span_parent_context(
    event: Dict,
    context: Any,
    event_type: Optional[LambdaEventType] = None,
) -> Tuple[Optional[Context], BoundedAttributes]:

    parent_context = None
    parent_attributes = BoundedAttributes()

    _x_amzn_trace_id = os.environ.get(_X_AMZN_TRACE_ID_ENV_VAR)

    if _x_amzn_trace_id:
        parent_context = get_global_textmap().extract({TRACE_HEADER_KEY: _x_amzn_trace_id})

        parent_attributes = BoundedAttributes()

        if get_current_span(parent_context).get_span_context().trace_flags.sampled:
            for kv in _x_amzn_trace_id.split(";"):
                try:
                    k, v = kv.split("=", 1)
                    parent_attributes = BoundedAttributes(
                        attributes=_filtered_attributes(
                            {
                                **parent_attributes,
                                f"remote.{k}".lower(): v,
                            }
                        )
                    )
                except Exception:  # noqa: S110 (if this doesn't work then we can safely ignore it)
                    pass

            return parent_context, parent_attributes

    if event_type in [LambdaEventType.APIGateway, LambdaEventType.APIGatewayV2]:
        headers = event.get("headers")
        if isinstance(headers, dict):
            for k, v in headers.items():
                if isinstance(k, str):
                    if k.lower() == "x-amzn-trace-id":
                        if isinstance(v, str):
                            x_amzn_trace_id = v

                            parent_context = get_global_textmap().extract({TRACE_HEADER_KEY: x_amzn_trace_id})

                            for kv in x_amzn_trace_id.split(";"):
                                try:
                                    k, v = kv.split("=", 1)
                                    parent_attributes = BoundedAttributes(
                                        attributes=_filtered_attributes(
                                            {
                                                **parent_attributes,
                                                f"remote.{k}".lower(): v,
                                            }
                                        )
                                    )
                                except Exception:  # noqa: S110 (if this doesn't work then we can safely ignore it)
                                    pass

                            return parent_context, parent_attributes

    return parent_context, parent_attributes


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
        initial_lambda_handler = ENV_ORIG_HANDLER or ENV__HANDLER
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

        try:
            with temporary_tracer.start_as_current_span(
                name="__detect__",
                attributes={
                    SLS_SPAN_TYPE: "detect",
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
                    SLS_SPAN_TYPE: "extract",
                },
            ) as extract_span:
                parent_context, parent_attributes = _extract_handler_span_parent_context(event, context, event_type)
            store.append_pre_instrumentation_span(extract_span)
        except Exception:
            logger.exception("Exception while processing extract span")

        pre_instrumentation_spans = []

        is_cold_start = store.is_cold_start_for_optional_execution_id(context_execution_id)
        logger.debug({"is_cold_start": is_cold_start})

        if is_cold_start:
            pre_instrumentation_spans = list(store.pre_instrumentation_spans)
            store.clear_pre_instrumentation_spans()

        min_start_time = min([*[s.start_time for s in pre_instrumentation_spans], _time_ns()])

        # This is the outermost span that will be used to trace the entire instrumentation process.
        with package_tracer.start_as_current_span(
            name=context_or_env_function_name or "__instrumentation__",
            context=parent_context,
            kind=span_kind,
            attributes={
                **parent_attributes,
                SLS_SPAN_TYPE: "instrumentation",
            },
            start_time=min_start_time,  # Rewind the start time to the earliest span.
        ) as instrumentation_span:
            with tracer.start_as_current_span(
                name="__pre__",
                attributes={
                    SLS_SPAN_TYPE: "pre",
                },
                start_time=min_start_time,  # Rewind the start time to the earliest span.
            ) as start_span:
                if instrumentation_span.is_recording():
                    if context_invoked_function_arn:
                        if context_extracted_account_id:
                            instrumentation_span.set_attribute(CLOUD_ACCOUNT_ID, context_extracted_account_id)
                        instrumentation_span.set_attribute(FAAS_ID, context_invoked_function_arn)
                        instrumentation_span.set_attribute(AWS_LAMBDA_INVOKED_ARN, context_invoked_function_arn)
                    if context_execution_id:
                        instrumentation_span.set_attribute(FAAS_EXECUTION, context_execution_id)

                if callable(request_hook):
                    try:
                        with tracer.start_as_current_span(
                            name="__request_hook__",
                            attributes={
                                SLS_SPAN_TYPE: "request_hook",
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
                    instrumentation_span.set_attribute(SLS_EVENT_TYPE, event_type.value)

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
                            "computeIsColdStart": is_cold_start,
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

                event_http_path = None

                if event_type == LambdaEventType.APIGateway:
                    event_http_path = event["requestContext"]["resourcePath"]
                    http_attributes = BoundedAttributes(
                        attributes=_filtered_attributes(
                            {
                                **http_attributes,
                                "eventCustomHttpMethod": event["requestContext"]["httpMethod"],
                                "eventCustomRequestTimeEpoch": event["requestContext"]["requestTimeEpoch"],
                                "eventHttpPath": event_http_path,
                                "httpPath": event_http_path,
                                "rawHttpPath": event["path"],
                            }
                        )
                    )
                elif event_type == LambdaEventType.APIGatewayV2:
                    routeKey = cast(str, event["requestContext"]["routeKey"])
                    event_http_path = routeKey.split(" ")[1] if " " in routeKey else routeKey
                    http_attributes = BoundedAttributes(
                        attributes=_filtered_attributes(
                            {
                                **http_attributes,
                                "eventCustomHttpMethod": event["requestContext"]["http"]["method"],
                                "eventCustomRequestTimeEpoch": event["requestContext"]["timeEpoch"],
                                "eventCustomStage": event["requestContext"]["stage"],
                                "eventHttpPath": event_http_path,
                                "httpPath": event_http_path,
                                "rawHttpPath": event["rawPath"],
                            }
                        )
                    )

                try:
                    if event is not None:
                        if instrumentation_span.is_recording():
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
                            if isinstance(_pre_instrumentation_span, Span):
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

            extracted_http_path = None
            extracted_http_status_code = None

            extracted_lambda_handler = None
            final_lambda_handler = initial_lambda_handler

            try:
                extracted_lambda_handler = import_module("wsgi_handler").load_config().get("app")  # noqa
                final_lambda_handler = f"{initial_lambda_handler}::{extracted_lambda_handler}"
            except Exception:  # noqa: S110 (ignore missing module)
                pass

            try:
                with tracer.start_as_current_span(
                    name=final_lambda_handler,
                    attributes={
                        SLS_SPAN_TYPE: "handler",
                    },
                ) as handler_span:

                    handler_span = cast(Span, handler_span)

                    if handler_span.is_recording():
                        handler_span.set_attribute(CODE_NAMESPACE, wrapped_module_name)
                        handler_span.set_attribute(CODE_FUNCTION, wrapped_function_name)
                        handler_span.set_attribute(SLS_HANDLER_INITIAL, initial_lambda_handler)
                        handler_span.set_attribute(SLS_HANDLER_FINAL, final_lambda_handler)
                        if extracted_lambda_handler:
                            handler_span.set_attribute(SLS_HANDLER_EXTRACTED, extracted_lambda_handler)

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
                            if instrumentation_span.is_recording():
                                store.set_response_data_for_trace_id(instrumentation_span.context.trace_id, result)
                    except Exception:
                        logger.exception("Exception while setting response data for trace id")

            except Exception:
                logger.exception("Exception during handler span")

            for finished_span in in_memory_span_exporter.get_finished_spans():
                finished_span = cast(ReadableSpan, finished_span)
                if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                    if finished_span.attributes:
                        extracted_http_path = finished_span.attributes.get(HTTP_ROUTE)
                        extracted_http_status_code = finished_span.attributes.get(HTTP_STATUS_CODE)

            in_memory_span_exporter.clear()

            if instrumentation_span.is_recording():
                if extracted_http_path:
                    instrumentation_span.set_attribute(HTTP_PATH, extracted_http_path)
                else:
                    if event_http_path:
                        instrumentation_span.set_attribute(HTTP_PATH, event_http_path)
                    else:
                        instrumentation_span.set_attribute(HTTP_PATH, "")
                if extracted_http_status_code:
                    instrumentation_span.set_attribute(HTTP_STATUS_CODE, extracted_http_status_code)
                if not isinstance(result, Exception):
                    instrumentation_span.set_status(Status(StatusCode.OK))

            # TODO: Revisit this to see if we should pass the exception as well.
            if not isinstance(result, Exception):
                if callable(response_hook):
                    try:
                        with tracer.start_as_current_span(
                            name="__response_hook__",
                            attributes={
                                SLS_SPAN_TYPE: "response_hook",
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

            if extracted_http_path:
                http_attributes = BoundedAttributes(
                    attributes=_filtered_attributes(
                        {
                            **http_attributes,
                            "httpPath": extracted_http_path,
                        }
                    )
                )

            if extracted_http_status_code:
                http_attributes = BoundedAttributes(
                    attributes=_filtered_attributes(
                        {
                            **http_attributes,
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
                    SLS_SPAN_TYPE: "post",
                },
            ) as finish_span:
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

        try:
            http_client_worker_pool.force_flush()
        except Exception:
            logger.exception("Exception while flushing http client worker pool")

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
            flush_timeout=kwargs.get("flush_timeout", SETTINGS_SLS_EXTENSION_FLUSH_TIMEOUT),
            tracer_provider=kwargs.get("tracer_provider"),
        )

    def _uninstrument(self, **kwargs):
        unwrap(
            import_module(self._wrapped_module_name),
            self._wrapped_function_name,
        )
