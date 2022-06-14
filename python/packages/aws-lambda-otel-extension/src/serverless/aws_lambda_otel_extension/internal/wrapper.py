import http.client
import json
import logging
import os
import platform
import sys
import time
import urllib.request
from functools import lru_cache
from importlib import import_module
from typing import TYPE_CHECKING, Callable, Dict

from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import (
    SpanKind,
    format_span_id,
    format_trace_id,
    get_tracer,
    get_tracer_provider,
    set_tracer_provider,
)

from serverless.aws_lambda_otel_extension.internal.resources import (
    AWSLambdaResourceDetector,
    ServerlessResourceDetector,
)
from serverless.aws_lambda_otel_extension.internal.trace.export import (
    serverless_in_memory_span_exporter,
    serverless_simple_span_processor,
)
from serverless.aws_lambda_otel_extension.shared import constants, enums, environment, settings, sniffers, variables
from serverless.aws_lambda_otel_extension.shared.types import LambdaContext


if TYPE_CHECKING:
    from opentelemetry.sdk.trace import Span


@lru_cache(maxsize=1)
def configure_tracer_provider() -> None:

    resource = get_aggregated_resources(
        detectors=[
            OTELResourceDetector(),
            ProcessResourceDetector(),
            AWSLambdaResourceDetector(),
            ServerlessResourceDetector(),
        ]
    )

    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(serverless_simple_span_processor)

    set_tracer_provider(tracer_provider)


def get_actual_handler_function() -> Callable:

    handler_module_name, handler_function_name = os.environ["ORIG_HANDLER"].rsplit(".", 1)
    handler_module = import_module(handler_module_name)

    return getattr(handler_module, handler_function_name)


@lru_cache(maxsize=1)
def perform_module_instrumentation() -> None:

    try:
        from opentelemetry.instrumentation.botocore import BotocoreInstrumentor

        BotocoreInstrumentor().instrument()
    except Exception:
        pass

    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.instrumentation.urllib import URLLibInstrumentor

    RequestsInstrumentor().instrument()
    URLLibInstrumentor().instrument()

    for handler in list(logging.root.handlers):
        logging.root.removeHandler(handler)

    LoggingInstrumentor().instrument(set_logging_format=True, log_level=logging.DEBUG)


def get_finished_spans_as_json():

    for finished_span in serverless_in_memory_span_exporter.get_finished_spans():
        if isinstance(finished_span, ReadableSpan):
            yield json.loads(finished_span.to_json())


def clear_finished_spans():
    serverless_in_memory_span_exporter.clear()


def auto_instrumenting_handler(event: Dict, context: LambdaContext) -> Dict:

    configure_tracer_provider()
    perform_module_instrumentation()

    tracer_provider = get_tracer_provider()
    tracer = get_tracer(__name__, "0.0.1", tracer_provider)

    orig_handler = os.environ.get("ORIG_HANDLER", os.environ.get("_HANDLER"))

    invoked_function_arn = getattr(context, "invoked_function_arn", None)
    invoked_function_name = environment.AWS_LAMBDA_FUNCTION_NAME
    invoked_function_version = environment.AWS_LAMBDA_FUNCTION_VERSION

    aws_request_id = getattr(context, "aws_request_id", None)

    variables.append_invocation(aws_request_id)

    event_type = sniffers.detect_lambda_event_type(event, context)

    if event_type in [
        enums.LambdaEventType.S3,
        enums.LambdaEventType.SNS,
        enums.LambdaEventType.SQS,
        enums.LambdaEventType.DynamoDB,
    ]:
        span_kind = SpanKind.CONSUMER
    else:
        span_kind = SpanKind.SERVER

    span: "Span"

    with tracer.start_as_current_span(name=orig_handler, kind=span_kind) as span:
        if span.is_recording():

            span.set_attribute(
                ResourceAttributes.FAAS_ID,
                invoked_function_arn,
            )

            span.set_attribute(
                SpanAttributes.FAAS_EXECUTION,
                aws_request_id,
            )

        span_context = span.get_span_context()

        faas_execution_id = context.aws_request_id

        formatted_trace_id = format_trace_id(span_context.trace_id)
        formatted_span_id = format_span_id(span_context.span_id)

        http_request: urllib.request.Request
        http_response: http.client.HTTPResponse

        base_event_data = {
            "computeCustomArn": invoked_function_arn,
            "computeCustomEnvArch": platform.machine(),
            "computeCustomFunctionVersion": invoked_function_version,
            "computeCustomLogGroupName": environment.AWS_LAMBDA_LOG_GROUP_NAME,
            "computeCustomLogStreamName": environment.AWS_LAMBDA_LOG_STREAM_NAME,
            "computeIsColdStart": not any(variables.invocations),
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
            "eventCustomXTraceId": environment._X_AMZN_TRACE_ID,
            "eventType": event_type.value,
            "functionName": invoked_function_name,
        }

        handler_event_data = {
            "recordType": "eventData",
            "record": {
                "eventData": {
                    faas_execution_id: {
                        **base_event_data,
                        **tracer_provider.resource.attributes,
                    },
                },
            },
            "span": {
                "traceId": formatted_trace_id,
                "spanId": formatted_span_id,
            },
            "requestEventPayload": {
                "traceId": formatted_trace_id,
                "spanId": formatted_span_id,
                "requestData": event,
                "executionId": faas_execution_id,
            },
        }

        http_request = urllib.request.Request(
            settings.otel_server_url,
            method=constants.HTTP_METHOD_POST,
            headers={
                constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
            },
            data=bytes(json.dumps(handler_event_data), "utf-8"),
        )

        http_response = urllib.request.urlopen(http_request)
        http_response.read()

        actual_response = get_actual_handler_function()(event, context)

    serverless_simple_span_processor.force_flush()
    serverless_simple_span_processor.shutdown()

    # FIXME: Add a timeout to this
    while not serverless_in_memory_span_exporter._stopped:
        time.sleep(0.05)

    handler_telemetry_data = {
        "recordType": "telemetryData",
        "record": {
            faas_execution_id: {
                "span": {
                    "traceId": formatted_trace_id,
                    "spanId": formatted_span_id,
                },
                "spans": list(get_finished_spans_as_json()),
            },
        },
        "executionId": faas_execution_id,
    }

    http_request = urllib.request.Request(
        settings.otel_server_url,
        method=constants.HTTP_METHOD_POST,
        headers={
            constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
        },
        data=bytes(json.dumps(handler_telemetry_data), "utf-8"),
    )

    http_response = urllib.request.urlopen(http_request)
    http_response.read()

    return actual_response
