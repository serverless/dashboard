import http.client
import json
import logging
import os
import platform
import sys
import typing
import urllib.request
from contextlib import contextmanager
from importlib import import_module
from threading import Lock
from traceback import TracebackException

from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.context import attach as context_attach
from opentelemetry.context import detach as context_detach
from opentelemetry.context import set_value as set_context_value
from opentelemetry.distro import OpenTelemetryDistro
from opentelemetry.instrumentation.aws_lambda import AwsLambdaInstrumentor
from opentelemetry.instrumentation.dependencies import get_dist_dependency_conflicts
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.aws import AwsXRayPropagator
from opentelemetry.sdk.extension.aws.resource import AwsLambdaResourceDetector
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ReadableSpan, Span, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.util import BoundedList
from opentelemetry.sdk.util.instrumentation import InstrumentationScope
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import (
    SpanContext,
    format_span_id,
    format_trace_id,
    get_current_span,
    get_tracer_provider,
    set_tracer_provider,
)
from pkg_resources import iter_entry_points

from serverless.aws_lambda_otel_extension import constants, defaults, environment, settings, types
from serverless.aws_lambda_otel_extension.enums import LambdaEventType
from serverless.aws_lambda_otel_extension.event import detect_lambda_event_type
from serverless.aws_lambda_otel_extension.resource import SlsResourceDetector
from serverless.aws_lambda_otel_extension.semconv.trace import OverloadedSpanAttributes, SlsSpanAttributes
from serverless.aws_lambda_otel_extension.trace.export import LoggingSpanExporter

logger = logging.getLogger(__name__)


aws_request_ids = []
aws_request_ids_append_lock = Lock()


def append_aws_request_id(aws_request_id: str) -> None:
    with aws_request_ids_append_lock:
        global aws_request_ids
        logger.debug({"aws_request_id": aws_request_id})
        aws_request_ids.append(aws_request_id)
        logger.debug({"aws_request_ids": aws_request_ids})


@contextmanager
def suppress_instrumentation() -> typing.Generator:
    token = context_attach(set_context_value(_SUPPRESS_INSTRUMENTATION_KEY, True))
    try:
        yield
    finally:
        context_detach(token)


def extract_account_id_from_invoked_function_arn(invoked_arn: str) -> typing.Optional[str]:
    if not invoked_arn:
        return None

    invoked_arn_parts = invoked_arn.split(":")

    if len(invoked_arn_parts) < 6:
        return None

    return invoked_arn_parts[4]


def perform_automatic_instrumentation() -> None:

    distro = OpenTelemetryDistro()

    for entry_point in iter_entry_points("opentelemetry_pre_instrument"):
        entry_point.load()()

    for entry_point in iter_entry_points("opentelemetry_instrumentor"):

        if entry_point.name not in settings.otel_python_enabled_instrumentations:
            logger.debug({"skipping": entry_point.name, "reason": "not enabled"})
            continue

        if entry_point.name in settings.otel_python_disabled_instrumentations:
            logger.debug({"skipping": entry_point.name, "reason": "disabled"})
            continue

        if entry_point.dist:
            try:
                conflict = get_dist_dependency_conflicts(entry_point.dist)
                if conflict:
                    logger.debug({"skipping": entry_point.name, "conflict": conflict})
                    continue

                distro.load_instrumentor(entry_point, skip_dep_check=True)
                logger.debug({"instrumented": entry_point.name})

            except Exception as exc:
                logger.exception("Instrumenting of %s failed", entry_point.name)
                raise exc

    for entry_point in iter_entry_points("opentelemetry_post_instrument"):
        entry_point.load()()


def format_span_compatible(span: Span) -> typing.Dict:

    parent_id = None

    if span.parent is not None:
        if isinstance(span.parent, Span):
            parent_id = format_span_id(span.parent.get_span_context().span_id)
        if isinstance(span.parent, SpanContext):
            parent_id = format_span_id(span.parent.span_id)

    events = []

    for event in span.events:
        events.append(
            {
                "name": event.name,
                "timeUnixNano": event.timestamp,
                "attributes": {
                    **span._format_attributes(event.attributes),
                    SlsSpanAttributes.SLS_ORIGINAL_PROPERTIES: ",".join(
                        span._format_attributes(event.attributes).keys()
                    ),
                },
            }
        )

    links = []

    for link in span.links:
        links.append(
            {
                "traceId": format_trace_id(link.context.trace_id),
                "spanId": format_span_id(link.context.span_id),
                "attributes": {
                    **span._format_attributes(link.attributes),
                    SlsSpanAttributes.SLS_ORIGINAL_PROPERTIES: ",".join(
                        span._format_attributes(link.attributes).keys()
                    ),
                },
            }
        )

    data: typing.Dict = {
        "name": span._name,
        "traceId": format_trace_id(span.context.trace_id),
        "spanId": format_span_id(span.context.span_id),
        "parentSpanId": parent_id,
        "kind": f"SPAN_KIND_{span.kind.name}",
        "startTimeUnixNano": str(span._start_time),
        "endTimeUnixNano": str(span._end_time),
        "attributes": {
            **span._format_attributes(span._attributes),
            SlsSpanAttributes.SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(span._attributes).keys()),
        },
        "events": events,
        "links": links,
        "status": {},
    }

    if environment.EXEC_WRAPPER_START_UNIX_NANO:
        data["execWrapperStartTimeNano"] = environment.EXEC_WRAPPER_START_UNIX_NANO

    return data


def instrumented_handler(
    event: typing.Dict,
    context: types.LambdaContext,
    actual_handler_function: typing.Callable,
    in_memory_span_exporter: InMemorySpanExporter,
    base_attributes: typing.Dict,
    http_attributes: typing.Dict,
    resource_attributes: typing.Dict,
    span_links: typing.List[Span],
) -> typing.Union[typing.Dict, Exception]:

    span = typing.cast(Span, get_current_span())
    span_context = span.get_span_context()

    trace_id = format_trace_id(span_context.trace_id)
    span_id = format_span_id(span_context.span_id)

    invoked_function_arn = getattr(context, "invoked_function_arn", "unknown")
    invoked_function_account_id = extract_account_id_from_invoked_function_arn(invoked_function_arn)
    actual_handler_module_name = getattr(actual_handler_function, "__module__", None)
    actual_handler_function_name = getattr(actual_handler_function, "__name__", None)

    aws_request_id = context.aws_request_id

    event_data_record = {
        "record": {
            "eventData": {
                context.aws_request_id: {
                    **base_attributes,
                    **http_attributes,
                    **resource_attributes,
                },
            },
            "requestEventPayload": {
                "executionId": context.aws_request_id,
                "requestData": event,
                "spanId": span_id,
                "traceId": trace_id,
            },
            "span": {
                "spanId": span_id,
                "traceId": trace_id,
            },
        },
        "recordType": "eventData",
    }

    event_data_record_body = json.dumps(event_data_record)
    event_data_record = json.loads(event_data_record_body)

    if not settings.test_dry_log:
        with suppress_instrumentation():
            try:
                extension_otel_http_request = urllib.request.Request(
                    settings.extension_otel_http_url,
                    method=constants.HTTP_METHOD_POST,
                    headers={
                        constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
                    },
                    data=bytes(json.dumps(event_data_record), "utf-8"),
                )
                extension_otel_http_response = urllib.request.urlopen(extension_otel_http_request)
                extension_otel_http_response.read()
            except Exception:
                logger.exception("Failed to send handler eventData")
            logger.debug({"event_data_record": event_data_record})
    else:
        if settings.test_dry_log_pretty:
            logger.info(json.dumps({"event_data_record": event_data_record}, indent=4, sort_keys=True))
        else:
            logger.info({"event_data_record": event_data_record})

    handler_response_or_exception: typing.Union[typing.Dict, Exception]

    logger.debug({"invoking": repr(actual_handler_function)})
    try:
        handler_response_or_exception = actual_handler_function(event, context)
    except Exception as exception:
        handler_response_or_exception = exception

    logger.debug({"invoked": repr(actual_handler_function), "type": repr(type(handler_response_or_exception))})

    overloaded_http_path = None

    # Fetch the HTTP request path in order to add the non-standard `http.path` attribute.
    for finished_span in in_memory_span_exporter.get_finished_spans():
        if isinstance(finished_span, ReadableSpan):
            if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                if finished_span.attributes:
                    if SpanAttributes.HTTP_ROUTE in finished_span.attributes:
                        overloaded_http_path = finished_span.attributes[SpanAttributes.HTTP_ROUTE]

    if span.is_recording():

        name = f"{actual_handler_module_name}.{actual_handler_function_name}"
        span.update_name(name)

        if name == "wsgi_handler.handler":
            try:
                wsgi_handler = import_module("wsgi_handler")
                wsgi_handler_config = wsgi_handler.load_config()
                app = wsgi_handler_config["app"]
                span.update_name(app)
                span.set_attribute(SlsSpanAttributes.SLS_HANDLER_RENAMED, True)
                span.set_attribute(SlsSpanAttributes.SLS_HANDLER_ACTUAL, app)
            except Exception:
                span.set_attribute(SlsSpanAttributes.SLS_HANDLER_RENAMED, False)
        else:
            if environment.ORIG_HANDLER:
                span.set_attribute(SlsSpanAttributes.SLS_HANDLER_ACTUAL, environment.ORIG_HANDLER)
            if environment._HANDLER:
                span.set_attribute(SlsSpanAttributes.SLS_HANDLER_ENTRYPOINT, environment._HANDLER)

        span.set_attributes(
            {
                ResourceAttributes.FAAS_ID: invoked_function_arn,
                SpanAttributes.FAAS_EXECUTION: aws_request_id,
                SpanAttributes.AWS_LAMBDA_INVOKED_ARN: invoked_function_arn,
                SlsSpanAttributes.SLS_AWS_REQUEST_IDS: aws_request_ids,
                SlsSpanAttributes.SLS_AWS_REQUEST_IDS_COUNT: len(aws_request_ids),
            }
        )

        if invoked_function_account_id:
            span.set_attribute(ResourceAttributes.CLOUD_ACCOUNT_ID, invoked_function_account_id)
        if actual_handler_module_name:
            span.set_attribute(SpanAttributes.CODE_NAMESPACE, actual_handler_module_name)
        if actual_handler_function_name:
            span.set_attribute(SpanAttributes.CODE_FUNCTION, actual_handler_function_name)

        # TODO: Find out how important this is.. possible waste of time scanning through finished spans in order to
        # attribute here vs in telemetryData.
        if overloaded_http_path:
            span.set_attribute(OverloadedSpanAttributes.HTTP_PATH, overloaded_http_path)

        if isinstance(span._links, BoundedList):
            span._links.extend(span_links)

    if isinstance(handler_response_or_exception, Exception):
        raise handler_response_or_exception

    return handler_response_or_exception


def auto_instrumenting_handler(event: typing.Dict, context: types.LambdaContext) -> typing.Dict:

    # Set logging level for the entire package namespace.
    logging.getLogger(constants.PACKAGE_NAMESPACE).setLevel(settings.sls_aws_lambda_otel_extension_log_level)

    # This gets passed around a lot and contains all the finished spans needed to build out event payloads for the
    # collector.
    in_memory_span_exporter = InMemorySpanExporter()

    # We should always attempt to make sure _HANDLER is defined from the ORIG_HANDLER if it is missing.
    os.environ.setdefault(constants._HANDLER_ENV_VAR, constants.PACKAGE_COMPATIBLE_WRAPPER_MODULE)
    os.environ.setdefault(
        constants.OTEL_INSTRUMENTATION_AWS_LAMBDA_FLUSH_TIMEOUT_ENV_VAR,
        str(defaults.OTEL_INSTRUMENTATION_AWS_LAMBDA_FLUSH_TIMEOUT),
    )

    invoked_function_arn = context.invoked_function_arn
    aws_request_id = context.aws_request_id

    is_cold_start = not aws_request_ids
    append_aws_request_id(aws_request_id)

    # If there are no invocations (cold start) then configure the environment and set up the tracer provider.
    if is_cold_start:
        resource = get_aggregated_resources(
            detectors=[
                ProcessResourceDetector(),
                AwsLambdaResourceDetector(),
                SlsResourceDetector(),
                # This comes last because we want it to override `service.name` if it is present.
                OTELResourceDetector(),
            ]
        )

        tracer_provider = TracerProvider(id_generator=AwsXRayIdGenerator(), resource=resource)

        # Extra information is logged to the console.
        if settings.test_dry_log:
            tracer_provider.add_span_processor(
                SimpleSpanProcessor(LoggingSpanExporter(pretty_print=settings.test_dry_log_pretty))
            )

        set_tracer_provider(tracer_provider)

        set_global_textmap(AwsXRayPropagator())

    else:
        tracer_provider = typing.cast(TracerProvider, get_tracer_provider())

    tracer_provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))

    tracer = tracer_provider.get_tracer(__name__, constants.PACKAGE_VERSION)

    # Store this for later without if suddenly changing later.
    orig_handler = os.environ.get("ORIG_HANDLER", os.environ["_HANDLER"])

    resource_attributes: typing.Dict

    if isinstance(tracer_provider, TracerProvider):
        resource_attributes = {**tracer_provider.resource.attributes}
    else:
        resource_attributes = {}

    span_links = []

    if is_cold_start:
        with tracer.start_as_current_span(name="perform_automatic_instrumentation()") as _span:
            if isinstance(_span, Span):
                span_links.append(_span)
            perform_automatic_instrumentation()

    event_type = detect_lambda_event_type(event, context)

    base_attributes = {
        "computeCustomArn": invoked_function_arn,
        "computeCustomEnvArch": platform.machine(),
        "computeCustomFunctionVersion": environment.AWS_LAMBDA_FUNCTION_VERSION,
        "computeCustomLogGroupName": environment.AWS_LAMBDA_LOG_GROUP_NAME,
        "computeCustomLogStreamName": environment.AWS_LAMBDA_LOG_STREAM_NAME,
        "computeIsColdStart": is_cold_start,
        "computeMemorySize": environment.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
        "computeRegion": environment.AWS_REGION,
        "computeRuntime": "aws.lambda.python.{}.{}.{}".format(
            sys.version_info.major,
            sys.version_info.minor,
            sys.version_info.micro,
        ),
        "eventCustomDomain": None,
        "eventCustomRequestId": aws_request_id,
        "eventCustomRequestTimeEpoch": None,
        "eventCustomXTraceId": os.getenv(constants._X_AMZN_TRACE_ID_ENV_VAR),
        "eventType": event_type.value if event_type else None,
        "functionName": environment.AWS_LAMBDA_FUNCTION_NAME,
    }

    wrapper_attributes: typing.Dict = {}
    http_attributes: typing.Dict = {}

    http_path = None
    http_status_code = None

    if event_type in [LambdaEventType.APIGateway, LambdaEventType.APIGatewayV2]:

        http_attributes = {
            "eventCustomAccountId": event["requestContext"]["accountId"],
            "eventCustomApiId": event["requestContext"]["apiId"],
            "eventCustomDomain": event["requestContext"]["domainName"],
            "_eventCustomRequestId": event["requestContext"]["requestId"],
            "eventSource": "aws.apigateway",
        }

    if event_type == LambdaEventType.APIGateway:

        http_path = event["requestContext"]["resourcePath"]

        http_attributes = {
            **http_attributes,
            "eventCustomHttpMethod": event["requestContext"]["httpMethod"],
            "eventCustomRequestTimeEpoch": event["requestContext"]["requestTimeEpoch"],
            "httpPath": http_path,
            "rawHttpPath": event["path"],
        }

    if event_type == LambdaEventType.APIGatewayV2:

        routeKey = event["requestContext"]["routeKey"]

        if " " in routeKey:
            http_path = routeKey.split(" ")[1]
        else:
            http_path = routeKey

        http_attributes = {
            **http_attributes,
            "eventCustomHttpMethod": event["requestContext"]["http"]["method"],
            "eventCustomRequestTimeEpoch": event["requestContext"]["timeEpoch"],
            "eventCustomStage": event["requestContext"]["stage"],
            "httpPath": http_path,
            "rawHttpPath": event["rawPath"],
        }

    extension_otel_http_request: urllib.request.Request
    extension_otel_http_response: http.client.HTTPResponse

    handler_response_or_exception: typing.Union[typing.Dict, Exception]

    handler_module_name, handler_function_name = os.getenv("ORIG_HANDLER", os.environ["_HANDLER"]).rsplit(".", 1)
    handler_module = import_module(handler_module_name)

    actual_handler_function = getattr(handler_module, handler_function_name)

    # Hack way of utilizing the standard AwsLambdaInstrumentor since it doesn't support request or response hooks which
    # would have worked beautifully as function defined functions.
    # See: https://github.com/open-telemetry/opentelemetry-python-contrib/issues/1140
    os.environ["ORIG_HANDLER"] = f"{instrumented_handler.__module__}.{instrumented_handler.__name__}"

    if is_cold_start:
        with tracer.start_as_current_span(name="AwsLambdaInstrumentor().instrument()") as _span:
            if isinstance(_span, Span):
                span_links.append(_span)
            AwsLambdaInstrumentor().instrument()

    os.environ["ORIG_HANDLER"] = orig_handler

    # Call instrumented_handler which will in turn send an event to the collector and then call the
    # actual_handler_function.

    try:
        handler_response_or_exception = instrumented_handler(
            event,
            context,
            actual_handler_function,
            in_memory_span_exporter,
            base_attributes,
            http_attributes,
            resource_attributes,
            span_links,
        )
    except Exception as exception:
        handler_response_or_exception = exception

    finished_spans_by_instrumentation: typing.Dict[InstrumentationScope, typing.List[ReadableSpan]] = {}

    tracer_provider.force_flush()
    finished_spans = in_memory_span_exporter.get_finished_spans()

    aws_lambda_instrumentation_span = None

    for finished_span in finished_spans:
        try:
            logger.debug({"finished_span": {"instrumentation_scope": finished_span.instrumentation_scope}})
        except Exception:
            logger.exception({"error": "Failed to log finished span scope"})

        if isinstance(finished_span, ReadableSpan):

            finished_spans_by_instrumentation.setdefault(finished_span.instrumentation_scope, []).append(finished_span)
            if finished_span.instrumentation_scope.name == "opentelemetry.instrumentation.aws_lambda":
                # There should be only one span for this instrumentation.
                aws_lambda_instrumentation_span = finished_span

            if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                if finished_span.attributes:
                    if "http.status_code" in finished_span.attributes:
                        http_status_code = finished_span.attributes["http.status_code"]

    instrumented_spans = []

    for instrumentation_info, finished_spans in finished_spans_by_instrumentation.items():
        instrumented_spans.append(
            {
                "instrumentationLibrary": {
                    "name": instrumentation_info.name,
                    "version": instrumentation_info.version,
                },
                "spans": [format_span_compatible(s) for s in finished_spans],
            }
        )

    # Prepare HTTP attributes.
    http_attributes = {
        "httpStatusCode": http_status_code,
        **http_attributes,
    }

    # Prepare wrapper attributes.
    wrapper_attributes = {
        **wrapper_attributes,
        "error": isinstance(handler_response_or_exception, Exception),
    }

    if aws_lambda_instrumentation_span:
        if aws_lambda_instrumentation_span.start_time:
            wrapper_attributes = {
                **wrapper_attributes,
                "startTime": int(aws_lambda_instrumentation_span.start_time / 1000000),
            }

        if aws_lambda_instrumentation_span.end_time:
            wrapper_attributes = {
                **wrapper_attributes,
                "endTime": int(aws_lambda_instrumentation_span.end_time / 1000000),
            }

    # If there was an exception, add it to the wrapper attributes.
    if isinstance(handler_response_or_exception, Exception):
        wrapper_attributes = {
            **wrapper_attributes,
            "errorCulprit": str(handler_response_or_exception),
            "errorExceptionMessage": str(handler_response_or_exception),
            "errorExceptionType": "handled",  # FIXME: Verify this is normal
            "errorExceptionStacktrace": "".join(
                TracebackException.from_exception(handler_response_or_exception).format()
            ),
        }

    # TODO: We are making an assumption here that there is only ever one resource.. that's not always going to be the
    # case.  All the spans/metrics/logs need to be organized by the resource objects they are associated with.. which is
    # why traces/metrics below are lists.

    logger.debug({"aws_lambda_instrumentation_span": repr(aws_lambda_instrumentation_span)})

    if aws_lambda_instrumentation_span:

        span_context = aws_lambda_instrumentation_span.get_span_context()
        span_id = format_span_id(span_context.span_id)
        trace_id = format_trace_id(span_context.trace_id)

        telemetry_data_record = {
            "record": {
                "function": {
                    **base_attributes,
                    **http_attributes,
                    **wrapper_attributes,
                    **resource_attributes,
                },
                "responseEventPayload": {
                    "errorData": None,
                    "executionId": context.aws_request_id,
                    "responseData": handler_response_or_exception
                    if isinstance(handler_response_or_exception, dict)
                    else None,
                    "spanId": span_id,
                    "traceId": trace_id,
                },
                "span": {
                    "spanId": span_id,
                    "traceId": trace_id,
                },
                "traces": {
                    "resourceSpans": [
                        {
                            "instrumentationLibrarySpans": instrumented_spans,
                            "resource": resource_attributes,
                        }
                    ]
                },
            },
            "recordType": "telemetryData",
            "requestId": context.aws_request_id,
        }

        telemetry_data_record_body = json.dumps(telemetry_data_record)
        telemetry_data_record = json.loads(telemetry_data_record_body)

        if not settings.test_dry_log:
            with suppress_instrumentation():
                try:
                    extension_otel_http_request = urllib.request.Request(
                        settings.extension_otel_http_url,
                        method=constants.HTTP_METHOD_POST,
                        headers={
                            constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
                        },
                        data=bytes(telemetry_data_record_body, "utf-8"),
                    )
                    extension_otel_http_response = urllib.request.urlopen(extension_otel_http_request)
                    extension_otel_http_response.read()
                except Exception:
                    logger.exception("Failed to send handler telemetryData")
                logger.debug({"telemetry_data_record": telemetry_data_record_body})
        else:
            if settings.test_dry_log_pretty:
                logger.info(json.dumps({"telemetry_data_record": telemetry_data_record}, indent=4, sort_keys=True))
            else:
                logger.info({"telemetry_data_record": telemetry_data_record_body})

    if isinstance(handler_response_or_exception, Exception):
        raise handler_response_or_exception

    return handler_response_or_exception
