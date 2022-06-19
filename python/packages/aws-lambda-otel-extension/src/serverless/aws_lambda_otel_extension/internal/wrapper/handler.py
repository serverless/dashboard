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
from opentelemetry.instrumentation.dependencies import get_dist_dependency_conflicts
from opentelemetry.metrics import set_meter_provider
from opentelemetry.sdk.extension.aws.resource import AwsLambdaResourceDetector
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader, Metric, MetricsData
from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.util.instrumentation import InstrumentationInfo, InstrumentationScope
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import (
    Span,
    SpanContext,
    SpanKind,
    format_span_id,
    format_trace_id,
    get_tracer_provider,
    set_tracer_provider,
)
from pkg_resources import iter_entry_points
from requests import JSONDecodeError

from serverless.aws_lambda_otel_extension import constants, environment, settings, types
from serverless.aws_lambda_otel_extension.enums import LambdaEventType
from serverless.aws_lambda_otel_extension.event import detect_lambda_event_type
from serverless.aws_lambda_otel_extension.resources import ServerlessResourceDetector
from serverless.aws_lambda_otel_extension.trace.export import (
    LoggingSpanExporter,
    serverless_in_memory_span_exporter,
    serverless_simple_span_processor,
)

logger = logging.getLogger(__name__)

in_memory_metric_reader = InMemoryMetricReader()

LOCK = Lock()

AWS_REQUEST_IDS = []


def _metrics_encoder_default(obj):
    if isinstance(obj, typing.FrozenSet):
        return list(obj)


_metrics_encoder = json.JSONEncoder(
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    separators=None,
    default=_metrics_encoder_default,
)


def append_aws_request_id(aws_request_id: str) -> None:
    with LOCK:
        global AWS_REQUEST_IDS
        logger.debug({"aws_request_id": aws_request_id})
        AWS_REQUEST_IDS.append(aws_request_id)


@contextmanager
def suppress_instrumentation() -> typing.Generator:
    token = context_attach(set_context_value(_SUPPRESS_INSTRUMENTATION_KEY, True))
    try:
        yield
    finally:
        context_detach(token)


def configure_environment() -> None:
    os.environ.setdefault("_HANDLER", os.environ["ORIG_HANDLER"])


def configure_tracer_provider() -> None:

    resource = get_aggregated_resources(
        detectors=[
            ProcessResourceDetector(),
            AwsLambdaResourceDetector(),
            ServerlessResourceDetector(),
            # This comes last because we want it to override `service.name` if it is present.
            OTELResourceDetector(),
        ]
    )

    tracer_provider = TracerProvider(resource=resource)

    tracer_provider.add_span_processor(serverless_simple_span_processor)

    if settings.test_dry_log:
        # Extra information is logged to the console.
        tracer_provider.add_span_processor(
            SimpleSpanProcessor(LoggingSpanExporter(pretty_print=settings.test_dry_log_pretty))
        )

    set_tracer_provider(tracer_provider)

    if settings.sls_otel_metrics_enabled:
        set_meter_provider(MeterProvider([in_memory_metric_reader]))


def extract_account_id_from_invoked_function_arn(invoked_arn: str) -> typing.Optional[str]:
    if not invoked_arn:
        return None

    invoked_arn_parts = invoked_arn.split(":")
    if len(invoked_arn_parts) < 6:
        return None

    return invoked_arn_parts[4]


def get_actual_handler_filepath() -> typing.Optional[str]:
    handler_module_name, _handler_function_name = os.getenv("ORIG_HANDLER", os.environ["_HANDLER"]).rsplit(".", 1)
    handler_module = import_module(handler_module_name)
    return getattr(handler_module, "__file__", None)


def get_actual_handler_function() -> typing.Callable:
    handler_module_name, handler_function_name = os.getenv("ORIG_HANDLER", os.environ["_HANDLER"]).rsplit(".", 1)
    handler_module = import_module(handler_module_name)
    return getattr(handler_module, handler_function_name)


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
        "startTimeUnixNano": span._start_time,
        "endTimeUnixNano": span._end_time,
        "attributes": span._format_attributes(span._attributes),
        "events": events,
        "links": span._format_links(span._links),
        "status": {},
    }


def format_metric_compatible(metric: Metric) -> typing.Dict:
    # This is temporary until we decide on how to proceed with metrics.

    metric_data = json.loads(metric.to_json())

    if "data" in metric_data:
        try:
            metric_data["data"] = json.loads(metric_data["data"])
        except JSONDecodeError:
            pass
        if "data_points" in metric_data["data"]:
            try:
                metric_data["data"]["data_points"] = json.loads(metric_data["data"]["data_points"])
            except JSONDecodeError:
                pass

    return metric_data


def auto_instrumenting_handler(event: typing.Dict, context: types.LambdaContext) -> typing.Dict:

    # Set logging level for the entire package namespace.
    logging.getLogger(constants.PACKAGE_NAMESPACE).setLevel(settings.sls_aws_lambda_otel_extension_log_level)

    # If there are no invocations (cold start) then configure the environment and set up the tracer provider.
    if not AWS_REQUEST_IDS:
        configure_environment()
        configure_tracer_provider()

    tracer_provider = get_tracer_provider()
    tracer = tracer_provider.get_tracer(__name__, constants.PACKAGE_VERSION)

    in_memory_metric_reader.collect()

    orig_handler = os.environ.get("ORIG_HANDLER", os.environ["_HANDLER"])

    invoked_function_arn = getattr(context, "invoked_function_arn", "unknown")
    invoked_function_name = environment.AWS_LAMBDA_FUNCTION_NAME
    invoked_function_version = environment.AWS_LAMBDA_FUNCTION_VERSION
    invoked_function_account_id = extract_account_id_from_invoked_function_arn(invoked_function_arn)

    aws_request_id = getattr(context, "aws_request_id", "unknown")

    if isinstance(tracer_provider, TracerProvider):
        resource_attributes = {**tracer_provider.resource.attributes}
    else:
        resource_attributes = {}

    if not AWS_REQUEST_IDS:
        with tracer.start_as_current_span(name="serverless_instrumentation_init"):
            perform_module_instrumentation()

    append_aws_request_id(aws_request_id)

    from opentelemetry.propagators.aws.aws_xray_propagator import TRACE_HEADER_KEY, AwsXRayPropagator

    parent_context = AwsXRayPropagator().extract({TRACE_HEADER_KEY: os.getenv(constants._X_AMZN_TRACE_ID_ENV_VAR)})

    event_type = detect_lambda_event_type(event, context)

    if event_type in [
        LambdaEventType.S3,
        LambdaEventType.SNS,
        LambdaEventType.SQS,
        LambdaEventType.DynamoDB,
    ]:
        span_kind = SpanKind.CONSUMER
    else:
        span_kind = SpanKind.SERVER

    span: Span

    actual_handler_function = get_actual_handler_function()
    actual_handler_filepath = get_actual_handler_filepath()
    actual_handler_module_name = getattr(actual_handler_function, "__module__", None)
    actual_handler_function_name = getattr(actual_handler_function, "__name__", None)

    base_attributes = {
        "computeCustomArn": invoked_function_arn,
        "computeCustomEnvArch": platform.machine(),
        "computeCustomFunctionVersion": invoked_function_version,
        "computeCustomLogGroupName": environment.AWS_LAMBDA_LOG_GROUP_NAME,
        "computeCustomLogStreamName": environment.AWS_LAMBDA_LOG_STREAM_NAME,
        "computeIsColdStart": not AWS_REQUEST_IDS,  # Quick and dirty
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
        "functionName": invoked_function_name,
    }

    http_attributes = {}

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

    try:
        with tracer.start_as_current_span(name=orig_handler, kind=span_kind, context=parent_context) as span:

            span_context = span.get_span_context()

            execution_id = context.aws_request_id
            trace_id = format_trace_id(span_context.trace_id)
            span_id = format_span_id(span_context.span_id)

            # TODO: Add in ALB support

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

            actual_response: typing.Union[typing.Dict, Exception]

            try:
                actual_response = get_actual_handler_function()(event, context)
            except Exception as exception:
                actual_response = exception

            for finished_span in serverless_in_memory_span_exporter.get_finished_spans():
                if isinstance(finished_span, ReadableSpan):
                    if finished_span.instrumentation_info.name == "opentelemetry.instrumentation.django":
                        if finished_span.attributes:
                            if "http.route" in finished_span.attributes:
                                http_request_path = finished_span.attributes["http.route"]
                            if "http.status_code" in finished_span.attributes:
                                http_response_status_code = finished_span.attributes["http.status_code"]
                    # TODO: Add in Flask and others.

            if span.is_recording():

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

                if http_request_path:
                    span.set_attribute("http.path", http_request_path)

            # Doing this allows the context to properly capture and add an exception event to the span.
            if isinstance(actual_response, Exception):
                raise actual_response

    except Exception:
        logger.exception({"error": "An error occured during handler execution"})

    serverless_simple_span_processor.force_flush()  # This is a NoOp when we are using the memory span exporter.
    serverless_simple_span_processor.shutdown()

    # FIXME: Add a timeout to this.
    while not serverless_in_memory_span_exporter._stopped:
        time.sleep(0.05)

    # Process Finished Spans.

    finished_wrapper_span = typing.cast(ReadableSpan, span)

    finished_spans_by_instrumentation: typing.Dict[InstrumentationInfo, typing.List[ReadableSpan]] = {}

    finished_spans = serverless_in_memory_span_exporter.get_finished_spans()

    for finished_span in finished_spans:
        if isinstance(finished_span, ReadableSpan):
            finished_spans_by_instrumentation.setdefault(finished_span.instrumentation_info, []).append(finished_span)

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

    serverless_in_memory_span_exporter.clear()

    # Process Collected Metrics.

    metrics_by_instrumentation: typing.Dict[InstrumentationScope, typing.List[Metric]] = {}

    metrics_data = in_memory_metric_reader.get_metrics_data()

    if isinstance(metrics_data, MetricsData):
        for resource_metrics in metrics_data.resource_metrics:
            for scope_metrics in resource_metrics.scope_metrics:
                metrics_by_instrumentation.setdefault(scope_metrics.scope, []).extend(scope_metrics.metrics)

    instrumented_metrics = []

    _default_encoder = getattr(json, "_default_encoder")
    setattr(json, "_default_encoder", _metrics_encoder)

    for instrumentation_scope, metrics in metrics_by_instrumentation.items():
        instrumented_metrics.append(
            {
                "instrumentationLibrary": {
                    "name": instrumentation_scope.name,
                    "version": instrumentation_scope.version,
                },
                "metrics": [format_metric_compatible(m) for m in metrics],
            }
        )

    setattr(json, "_default_encoder", _default_encoder)

    # Prepare HTTP attributes.
    http_attributes = {
        "httpStatusCode": http_response_status_code,
        **http_attributes,
    }

    # Prepare wrapper attributes.
    wrapper_attributes = {
        "execWrapperStartTimeNano": environment.EXEC_WRAPPER_START_TIME_NS,
        "startTime": (finished_wrapper_span.start_time / 1000000) if finished_wrapper_span.start_time else None,
        "endTime": (finished_wrapper_span.end_time / 1000000) if finished_wrapper_span.end_time else None,
        "error": isinstance(actual_response, Exception),
    }

    # If there was an exception, add it to the wrapper attributes.
    if isinstance(actual_response, Exception):
        wrapper_attributes = {
            **wrapper_attributes,
            "errorCulprit": str(actual_response),
            "errorMessage": str(actual_response),
            "errorType": "handled",  # FIXME: Verify this is normal
            "errorStackTrace": "".join(TracebackException.from_exception(actual_response).format()),
        }

    # TODO: We are making an assumption here that there is only ever one resource.. that's not always going to be the
    # case.  All the spans/metrics/logs need to be organized by the resource objects they are associated with.. which is
    # why traces/metrics below are lists.

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
                "responseData": actual_response if isinstance(actual_response, dict) else None,
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

    if isinstance(telemetry_data_record["record"], dict):
        if settings.sls_otel_metrics_enabled:
            telemetry_data_record["record"].update(
                {
                    "metrics": {
                        "resourceMetrics": [
                            {
                                "instrumentationLibraryMetrics": instrumented_metrics,
                                "resource": resource_attributes,
                            }
                        ]
                    }
                }
            )

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

    if isinstance(actual_response, Exception):
        raise actual_response

    return actual_response
