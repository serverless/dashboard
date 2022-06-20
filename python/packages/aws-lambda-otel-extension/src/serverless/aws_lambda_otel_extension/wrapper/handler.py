import http.client
import json
import logging
import os
import platform
import sys
import time
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
from opentelemetry.sdk.extension.aws.resource import AwsLambdaResourceDetector
from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.util.instrumentation import InstrumentationScope
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import (
    Span,
    SpanContext,
    format_span_id,
    format_trace_id,
    get_current_span,
    get_tracer_provider,
    set_tracer_provider,
)
from pkg_resources import iter_entry_points

from serverless.aws_lambda_otel_extension import constants, environment, settings, types
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


def perform_module_instrumentation() -> None:

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


def format_span_compatible(span: ReadableSpan) -> typing.Dict:

    parent_id = None

    if span.parent is not None:
        if isinstance(span.parent, Span):
            ctx = span.parent.context
            parent_id = format_span_id(ctx.span_id)
        elif isinstance(span.parent, SpanContext):
            parent_id = format_span_id(span.parent.span_id)

    events = []

    for event in span._events:
        events.append(
            {
                "name": event.name,
                "timeUnixNano": event.timestamp,
                "attributes": span._format_attributes(event.attributes),
            }
        )

    links = []

    for link in span._links:
        links.append(
            {
                "traceId": format_trace_id(link.context.trace_id),
                "spanId": format_span_id(link.context.span_id),
                "attributes": span._format_attributes(link.attributes),
            }
        )

    return {
        "name": span._name,
        "traceId": format_trace_id(span.context.trace_id),
        "spanId": format_span_id(span.context.span_id),
        "parentTraceId": parent_id,
        "kind": f"SPAN_KIND_{span.kind.name}",
        # "execWrapperStartTimeNano": environment.EXEC_WRAPPER_START_UNIX_NANO,
        "startTimeUnixNano": span._start_time,
        "endTimeUnixNano": span._end_time,
        "attributes": span._format_attributes(span._attributes),
        "events": events,
        "links": span._format_links(span._links),
        "status": {},
    }


def instrumented_handler(
    event: typing.Dict,
    context: types.LambdaContext,
    actual_handler_function,
    actual_handler_filepath,
    in_memory_span_exporter: InMemorySpanExporter,
    base_attributes,
    http_attributes,
    resource_attributes,
    execution_id,
) -> typing.Union[typing.Dict, Exception]:

    span = get_current_span()
    span_context = span.get_span_context()

    trace_id = format_trace_id(span_context.trace_id)
    span_id = format_span_id(span_context.span_id)

    invoked_function_arn = getattr(context, "invoked_function_arn", "unknown")
    invoked_function_account_id = extract_account_id_from_invoked_function_arn(invoked_function_arn)
    actual_handler_module_name = getattr(actual_handler_function, "__module__", None)
    actual_handler_function_name = getattr(actual_handler_function, "__name__", None)

    aws_request_id = getattr(context, "aws_request_id", "unknown")

    event_data_record = {
        "record": {
            "eventData": {
                execution_id: {
                    **base_attributes,
                    **http_attributes,
                    **resource_attributes,
                },
            },
            "requestEventPayload": {
                "executionId": execution_id,
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
    else:
        if settings.test_dry_log_pretty:
            logger.info(json.dumps({"event_data_record": event_data_record}, indent=4, sort_keys=True))
        else:
            logger.info({"event_data_record": event_data_record})

    actual_response_or_exception: typing.Union[typing.Dict, Exception]

    try:
        actual_response_or_exception = actual_handler_function(event, context)
    except Exception as exception:
        actual_response_or_exception = exception

    http_request_path = None

    # Fetch the HTTP request path in order to add the non-standard `http.path` attribute.
    for finished_span in in_memory_span_exporter.get_finished_spans():
        if isinstance(finished_span, ReadableSpan):
            if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                if finished_span.attributes:
                    if "http.route" in finished_span.attributes:
                        http_request_path = finished_span.attributes["http.route"]
                    # if "http.status_code" in finished_span.attributes:
                    #     http_response_status_code = finished_span.attributes["http.status_code"]

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
                if environment.ORIG_HANDLER:
                    span.set_attribute(SlsSpanAttributes.SLS_HANDLER_MIDDLEWARE, environment.ORIG_HANDLER)
                if environment._HANDLER:
                    span.set_attribute(SlsSpanAttributes.SLS_HANDLER_ENTRYPOINT, environment._HANDLER or "unknown")
            except Exception:
                pass

        span.set_attributes(
            {
                ResourceAttributes.FAAS_ID: invoked_function_arn,
                SpanAttributes.FAAS_EXECUTION: aws_request_id,
                SpanAttributes.AWS_LAMBDA_INVOKED_ARN: invoked_function_arn,
            }
        )

        if invoked_function_account_id:
            span.set_attribute(ResourceAttributes.CLOUD_ACCOUNT_ID, invoked_function_account_id)
        if actual_handler_module_name:
            span.set_attribute(SpanAttributes.CODE_NAMESPACE, actual_handler_module_name)
        if actual_handler_function_name:
            span.set_attribute(SpanAttributes.CODE_FUNCTION, actual_handler_function_name)
        if actual_handler_filepath:
            span.set_attribute(SpanAttributes.CODE_FILEPATH, actual_handler_filepath)

        # TODO: Find out how important this is.. possible waste of time scanning through finished spans in order to
        # attribute here vs in telemetryData.
        if http_request_path:
            span.set_attribute(OverloadedSpanAttributes.HTTP_PATH, http_request_path)

    return actual_response_or_exception


def auto_instrumenting_handler(event: typing.Dict, context: types.LambdaContext) -> typing.Dict:

    # Set logging level for the entire package namespace.
    logging.getLogger(constants.PACKAGE_NAMESPACE).setLevel(settings.sls_aws_lambda_otel_extension_log_level)

    # This gets passed around a lot and contains all the finished spans needed to build out event payloads for the
    # collector.
    in_memory_span_exporter = InMemorySpanExporter()

    # We should always attempt to make sure _HANDLER is defined from the ORIG_HANDLER if it is missing.
    os.environ.setdefault("_HANDLER", constants.PACKAGE_COMPATIBLE_WRAPPER_MODULE)

    # If there are no invocations (cold start) then configure the environment and set up the tracer provider.
    if not aws_request_ids:
        resource = get_aggregated_resources(
            detectors=[
                ProcessResourceDetector(),
                AwsLambdaResourceDetector(),
                SlsResourceDetector(),
                # This comes last because we want it to override `service.name` if it is present.
                OTELResourceDetector(),
            ]
        )

        tracer_provider = TracerProvider(resource=resource)

        # This is always required regarless of settings.test_dry_log.
        tracer_provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))

        # Extra information is logged to the console.
        if settings.test_dry_log:
            tracer_provider.add_span_processor(
                SimpleSpanProcessor(LoggingSpanExporter(pretty_print=settings.test_dry_log_pretty))
            )

        set_tracer_provider(tracer_provider)
    else:
        tracer_provider = typing.cast(TracerProvider, get_tracer_provider())

    tracer = tracer_provider.get_tracer(__name__, constants.PACKAGE_VERSION)

    # Store this for later without if suddenly changing later.
    orig_handler = os.environ.get("ORIG_HANDLER", os.environ["_HANDLER"])

    invoked_function_arn = getattr(context, "invoked_function_arn", "unknown")

    aws_request_id = getattr(context, "aws_request_id", "unknown")

    if isinstance(tracer_provider, TracerProvider):
        resource_attributes = {**tracer_provider.resource.attributes}
    else:
        resource_attributes = {}

    if not aws_request_ids:
        with tracer.start_as_current_span(name="serverless_instrumentation_init"):
            perform_module_instrumentation()

    append_aws_request_id(aws_request_id)

    event_type = detect_lambda_event_type(event, context)

    base_attributes = {
        "computeCustomArn": invoked_function_arn,
        "computeCustomEnvArch": platform.machine(),
        "computeCustomFunctionVersion": environment.AWS_LAMBDA_FUNCTION_VERSION,
        "computeCustomLogGroupName": environment.AWS_LAMBDA_LOG_GROUP_NAME,
        "computeCustomLogStreamName": environment.AWS_LAMBDA_LOG_STREAM_NAME,
        "computeIsColdStart": not aws_request_ids,  # Quick and dirty
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

    http_request_path = None
    http_response_status_code = None

    if event_type in [LambdaEventType.APIGateway, LambdaEventType.APIGatewayV2]:

        http_attributes = {
            "_eventCustomRequestId": event["requestContext"]["requestId"],
            "eventCustomAccountId": event["requestContext"]["accountId"],
            "eventCustomApiId": event["requestContext"]["apiId"],
            "eventCustomDomain": event["requestContext"]["domainName"],
            "eventSource": "aws.apigateway",
        }

    if event_type == LambdaEventType.APIGateway:

        http_request_path = event["requestContext"]["resourcePath"]

        http_attributes = {
            **http_attributes,
            "eventCustomHttpMethod": event["requestContext"]["httpMethod"],
            "eventCustomRequestTimeEpoch": event["requestContext"]["requestTimeEpoch"],
            "httpPath": http_request_path,
            "rawHttpPath": event["path"],
        }

    if event_type == LambdaEventType.APIGatewayV2:

        routeKey = event["requestContext"]["routeKey"]

        if " " in routeKey:
            http_request_path = routeKey.split(" ")[1]
        else:
            http_request_path = routeKey

        http_attributes = {
            **http_attributes,
            "eventCustomHttpMethod": event["requestContext"]["http"]["method"],
            "eventCustomRequestTimeEpoch": event["requestContext"]["timeEpoch"],
            "eventCustomStage": event["requestContext"]["stage"],
            "httpPath": http_request_path,
            "rawHttpPath": event["rawPath"],
        }

    extension_otel_http_request: urllib.request.Request
    extension_otel_http_response: http.client.HTTPResponse

    actual_response_or_exception: typing.Union[typing.Dict, Exception]

    handler_module_name, handler_function_name = os.getenv("ORIG_HANDLER", os.environ["_HANDLER"]).rsplit(".", 1)
    handler_module = import_module(handler_module_name)

    actual_handler_filepath = getattr(handler_module, "__file__", None)
    actual_handler_function = getattr(handler_module, handler_function_name)

    execution_id = context.aws_request_id

    # Hack way of utilizing the standard AwsLambdaInstrumentor since it doesn't support request or response hooks which
    # would have worked beautifully as function defined functions.
    # See: https://github.com/open-telemetry/opentelemetry-python-contrib/issues/1140
    os.environ["ORIG_HANDLER"] = f"{instrumented_handler.__module__}.{instrumented_handler.__name__}"
    AwsLambdaInstrumentor().instrument()
    os.environ["ORIG_HANDLER"] = orig_handler

    # Call instrumented_handler which will in turn send an event to the collector and then call the
    # actual_handler_function.
    actual_response_or_exception = instrumented_handler(
        event,
        context,
        actual_handler_function,
        actual_handler_filepath,
        in_memory_span_exporter,
        base_attributes,
        http_attributes,
        resource_attributes,
        execution_id,
    )

    if isinstance(tracer_provider, TracerProvider):
        tracer_provider.force_flush()
        tracer_provider.shutdown()

    # TODO: Add a timeout to this.
    while not in_memory_span_exporter._stopped:
        time.sleep(0.05)

    finished_spans_by_instrumentation: typing.Dict[InstrumentationScope, typing.List[ReadableSpan]] = {}

    finished_spans = in_memory_span_exporter.get_finished_spans()

    aws_lambda_instrumentation_span = None

    for finished_span in finished_spans:
        if isinstance(finished_span, ReadableSpan):
            if finished_span.instrumentation_scope.name == "opentelemetry.instrumentation.aws_lambda":
                # There should be only one span for this instrumentation.
                aws_lambda_instrumentation_span = finished_span
            finished_spans_by_instrumentation.setdefault(finished_span.instrumentation_scope, []).append(finished_span)

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
        "httpStatusCode": http_response_status_code,
        **http_attributes,
    }

    # Prepare wrapper attributes.
    wrapper_attributes = {
        **wrapper_attributes,
        "error": isinstance(actual_response_or_exception, Exception),
    }

    if aws_lambda_instrumentation_span:
        if aws_lambda_instrumentation_span.start_time:
            wrapper_attributes = {
                **wrapper_attributes,
                "startTime": (aws_lambda_instrumentation_span.start_time / 1000000),
            }

        if aws_lambda_instrumentation_span.end_time:
            wrapper_attributes = {
                **wrapper_attributes,
                "endTime": (aws_lambda_instrumentation_span.end_time / 1000000),
            }

    # If there was an exception, add it to the wrapper attributes.
    if isinstance(actual_response_or_exception, Exception):
        wrapper_attributes = {
            **wrapper_attributes,
            "errorCulprit": str(actual_response_or_exception),
            "errorMessage": str(actual_response_or_exception),
            "errorType": "handled",  # FIXME: Verify this is normal
            "errorStackTrace": "".join(TracebackException.from_exception(actual_response_or_exception).format()),
        }

    # TODO: We are making an assumption here that there is only ever one resource.. that's not always going to be the
    # case.  All the spans/metrics/logs need to be organized by the resource objects they are associated with.. which is
    # why traces/metrics below are lists.

    if aws_lambda_instrumentation_span:

        span_context = aws_lambda_instrumentation_span.get_span_context()
        span_id = span_context.span_id
        trace_id = span_context.trace_id

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
                    "executionId": execution_id,
                    "responseData": actual_response_or_exception
                    if isinstance(actual_response_or_exception, dict)
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
        }

        if not settings.test_dry_log:
            with suppress_instrumentation():
                try:
                    extension_otel_http_request = urllib.request.Request(
                        settings.extension_otel_http_url,
                        method=constants.HTTP_METHOD_POST,
                        headers={
                            constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
                        },
                        data=bytes(json.dumps(telemetry_data_record), "utf-8"),
                    )
                    extension_otel_http_response = urllib.request.urlopen(extension_otel_http_request)
                    extension_otel_http_response.read()
                except Exception:
                    logger.exception("Failed to send handler telemetryData")
        else:
            if settings.test_dry_log_pretty:
                logger.info(json.dumps({"telemetry_data_record": telemetry_data_record}, indent=4, sort_keys=True))
            else:
                logger.info({"telemetry_data_record": telemetry_data_record})

    # ...

    if isinstance(actual_response_or_exception, Exception):
        raise actual_response_or_exception

    return actual_response_or_exception
