import http.client
import json
import logging
import os
import platform
import sys
import time
import urllib.request
from contextlib import contextmanager
from functools import lru_cache
from importlib import import_module
from typing import Callable, Dict, Generator, List

from opentelemetry import context as context_api
from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ReadableSpan, Span, Tracer, TracerProvider
from opentelemetry.sdk.util import instrumentation
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


@contextmanager
def suppress_instrumentation() -> Generator:
    token = context_api.attach(context_api.set_value(context_api._SUPPRESS_INSTRUMENTATION_KEY, True))
    try:
        yield
    finally:
        context_api.detach(token)


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


def clear_finished_spans():
    serverless_in_memory_span_exporter.clear()


def auto_instrumenting_handler(event: Dict, context: LambdaContext) -> Dict:

    configure_tracer_provider()
    perform_module_instrumentation()

    tracer_provider: TracerProvider = get_tracer_provider()
    tracer: Tracer = get_tracer(__name__, "0.0.1", tracer_provider)

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

    span: Span

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
            "environment": dict(sorted(dict(os.environ).items())),
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

        with suppress_instrumentation():

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

    instrumentedSpansByInstrumentation: Dict[instrumentation.InstrumentationInfo, List[ReadableSpan]] = {}

    for finished_span in serverless_in_memory_span_exporter.get_finished_spans():
        if isinstance(finished_span, ReadableSpan):
            instrumentedSpansByInstrumentation.setdefault(finished_span.instrumentation_info, []).append(finished_span)

    instrumentedSpans = []

    for instrumentation_info, finished_spans in instrumentedSpansByInstrumentation.items():
        instrumentedSpans.append(
            {
                "instrumentationLibrary": {
                    "name": instrumentation_info.name,
                    "version": instrumentation_info.version,
                },
                "spans": [json.loads(s.to_json()) for s in finished_spans],
            }
        )

    handler_telemetry_data = {
        "recordType": "telemetryData",
        "record": {
            "function": {
                **base_event_data,
                **tracer_provider.resource.attributes,
            },
            "traces": {
                "resourceSpans": {
                    **tracer_provider.resource.attributes,
                },
                "instrumentedSpans": instrumentedSpans,
            },
        },
    }

    with suppress_instrumentation():

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


# {
#   "recordType": "eventData",
#   "record": {
#     "eventData": {
#       "882193a5-0cda-4652-aa1a-af6be269fb9d": {
#         "service.name": "unknown_service:/var/lang/bin/node",
#         "telemetry.sdk.language": "nodejs",
#         "telemetry.sdk.name": "opentelemetry",
#         "telemetry.sdk.version": "1.3.0",
#         "cloud.provider": "aws",
#         "cloud.platform": "aws_lambda",
#         "cloud.region": "us-east-1",
#         "faas.name": "aws-node-http-api-project-shanestmp-hello",
#         "faas.version": "$LATEST",
#         "sls_service_name": "aws-node-http-api-project-stt001",
#         "sls_stage": "dev",
#         "sls_org_id": "2e2884fa-f767-42a9-867c-937a7f7f912e",
#         "process.pid": 17,
#         "process.executable.name": "/var/lang/bin/node",
#         "process.command": "/var/runtime/index.js",
#         "process.command_line": "/var/lang/bin/node /var/runtime/index.js",
#         "process.runtime.version": "14.19.1",
#         "process.runtime.name": "nodejs",
#         "process.runtime.description": "Node.js",
#         "computeCustomArn": "arn:aws:lambda:us-east-1:377024778620:function:aws-node-http-api-project-shanestmp-hello",
#         "functionName": "aws-node-http-api-project-shanestmp-hello",
#         "computeRegion": "us-east-1",
#         "computeRuntime": "aws.lambda.nodejs.14.19.1",
#         "computeCustomFunctionVersion": "$LATEST",
#         "computeMemorySize": "1024",
#         "eventCustomXTraceId": "Root=1-62a81349-493118367291d0b912ed88ec;Parent=2c44788f47ec7e4e;Sampled=0",
#         "computeCustomLogGroupName": "/aws/lambda/aws-node-http-api-project-shanestmp-hello",
#         "computeCustomLogStreamName": "2022/06/14/[$LATEST]2c683548710f493b85e032c1324e394b",
#         "computeCustomEnvArch": "x64",
#         "eventType": "aws.apigatewayv2.http",
#         "eventCustomRequestId": "882193a5-0cda-4652-aa1a-af6be269fb9d",
#         "computeIsColdStart": true,
#         "eventCustomDomain": "b23yilmb4a.execute-api.us-east-1.amazonaws.com",
#         "eventCustomRequestTimeEpoch": 1655182153238,
#         "eventCustomApiId": "b23yilmb4a",
#         "eventSource": "aws.apigateway",
#         "eventCustomAccountId": "377024778620",
#         "httpPath": "/",
#         "rawHttpPath": "/",
#         "eventCustomHttpMethod": "GET"
#       }
#     },
#     "span": {
#       "traceId": "b7daa3c960b8f9aebc9f14d77cacc741",
#       "spanId": "5334c25300421356"
#     },
#     "requestEventPayload": {
#       "traceId": "b7daa3c960b8f9aebc9f14d77cacc741",
#       "spanId": "5334c25300421356",
#       "requestData": {
#         "version": "2.0",
#         "routeKey": "GET /",
#         "rawPath": "/",
#         "rawQueryString": "",
#         "headers": {
#           "accept": "*/*",
#           "content-length": "0",
#           "host": "b23yilmb4a.execute-api.us-east-1.amazonaws.com",
#           "user-agent": "curl/7.68.0",
#           "x-amzn-trace-id": "Root=1-62a81349-6fd19a8d0800e7e54517dfb9",
#           "x-forwarded-for": "206.174.34.16",
#           "x-forwarded-port": "443",
#           "x-forwarded-proto": "https"
#         },
#         "requestContext": {
#           "accountId": "377024778620",
#           "apiId": "b23yilmb4a",
#           "domainName": "b23yilmb4a.execute-api.us-east-1.amazonaws.com",
#           "domainPrefix": "b23yilmb4a",
#           "http": {
#             "method": "GET",
#             "path": "/",
#             "protocol": "HTTP/1.1",
#             "sourceIp": "206.174.34.16",
#             "userAgent": "curl/7.68.0"
#           },
#           "requestId": "TsfzeivVIAMEM1Q=",
#           "routeKey": "GET /",
#           "stage": "$default",
#           "time": "14/Jun/2022:04:49:13 +0000",
#           "timeEpoch": 1655182153238
#         },
#         "isBase64Encoded": false
#       },
#       "executionId": "882193a5-0cda-4652-aa1a-af6be269fb9d"
#     }
#   }
# }

# {
#   "recordType": "telemetryData",
#   "requestId": "882193a5-0cda-4652-aa1a-af6be269fb9d",
#   "record": {
#     "function": {
#       "service.name": "unknown_service:/var/lang/bin/node",
#       "telemetry.sdk.language": "nodejs",
#       "telemetry.sdk.name": "opentelemetry",
#       "telemetry.sdk.version": "1.3.0",
#       "cloud.provider": "aws",
#       "cloud.platform": "aws_lambda",
#       "cloud.region": "us-east-1",
#       "faas.name": "aws-node-http-api-project-shanestmp-hello",
#       "faas.version": "$LATEST",
#       "sls_service_name": "aws-node-http-api-project-stt001",
#       "sls_stage": "dev",
#       "sls_org_id": "2e2884fa-f767-42a9-867c-937a7f7f912e",
#       "process.pid": 17,
#       "process.executable.name": "/var/lang/bin/node",
#       "process.command": "/var/runtime/index.js",
#       "process.command_line": "/var/lang/bin/node /var/runtime/index.js",
#       "process.runtime.version": "14.19.1",
#       "process.runtime.name": "nodejs",
#       "process.runtime.description": "Node.js",
#       "computeCustomArn": "arn:aws:lambda:us-east-1:377024778620:function:aws-node-http-api-project-shanestmp-hello",
#       "functionName": "aws-node-http-api-project-shanestmp-hello",
#       "computeRegion": "us-east-1",
#       "computeRuntime": "aws.lambda.nodejs.14.19.1",
#       "computeCustomFunctionVersion": "$LATEST",
#       "computeMemorySize": "1024",
#       "eventCustomXTraceId": "Root=1-62a81349-493118367291d0b912ed88ec;Parent=2c44788f47ec7e4e;Sampled=0",
#       "computeCustomLogGroupName": "/aws/lambda/aws-node-http-api-project-shanestmp-hello",
#       "computeCustomLogStreamName": "2022/06/14/[$LATEST]2c683548710f493b85e032c1324e394b",
#       "computeCustomEnvArch": "x64",
#       "eventType": "aws.apigatewayv2.http",
#       "eventCustomRequestId": "882193a5-0cda-4652-aa1a-af6be269fb9d",
#       "computeIsColdStart": true,
#       "eventCustomDomain": "b23yilmb4a.execute-api.us-east-1.amazonaws.com",
#       "eventCustomRequestTimeEpoch": 1655182153238,
#       "eventCustomApiId": "b23yilmb4a",
#       "eventSource": "aws.apigateway",
#       "eventCustomAccountId": "377024778620",
#       "httpPath": "/",
#       "rawHttpPath": "/",
#       "eventCustomHttpMethod": "GET",
#       "startTime": 1655182153808,
#       "endTime": 1655182153900,
#       "error": false,
#       "httpStatusCode": 200
#     },
#     "traces": {
#       "resourceSpans": [
#         {
#           "resource": {
#             "service.name": "unknown_service:/var/lang/bin/node",
#             "telemetry.sdk.language": "nodejs",
#             "telemetry.sdk.name": "opentelemetry",
#             "telemetry.sdk.version": "1.3.0",
#             "cloud.provider": "aws",
#             "cloud.platform": "aws_lambda",
#             "cloud.region": "us-east-1",
#             "faas.name": "aws-node-http-api-project-shanestmp-hello",
#             "faas.version": "$LATEST",
#             "sls_service_name": "aws-node-http-api-project-stt001",
#             "sls_stage": "dev",
#             "sls_org_id": "2e2884fa-f767-42a9-867c-937a7f7f912e",
#             "process.pid": 17,
#             "process.executable.name": "/var/lang/bin/node",
#             "process.command": "/var/runtime/index.js",
#             "process.command_line": "/var/lang/bin/node /var/runtime/index.js",
#             "process.runtime.version": "14.19.1",
#             "process.runtime.name": "nodejs",
#             "process.runtime.description": "Node.js"
#           },
#           "instrumentationLibrarySpans": [
#             {
#               "instrumentationLibrary": {
#                 "name": "@opentelemetry/instrumentation-http",
#                 "version": "0.27.0"
#               },
#               "spans": [
#                 {
#                   "traceId": "b7daa3c960b8f9aebc9f14d77cacc741",
#                   "spanId": "388cd45a63d7b556",
#                   "parentSpanId": "5334c25300421356",
#                   "name": "HTTPS GET",
#                   "kind": "SPAN_KIND_SERVER",
#                   "startTimeUnixNano": "1655182153827565000",
#                   "endTimeUnixNano": "1655182153897848800",
#                   "attributes": {
#                     "http.url": "https://www.google.com/",
#                     "http.method": "GET",
#                     "http.target": "/",
#                     "net.peer.name": "www.google.com",
#                     "net.peer.ip": "142.251.111.105",
#                     "net.peer.port": 443,
#                     "http.host": "www.google.com:443",
#                     "http.status_code": 200,
#                     "http.status_text": "OK",
#                     "http.flavor": "1.1",
#                     "net.transport": "ip_tcp",
#                     "sls.original_properties": "http.url,http.method,http.target,net.peer.name,net.peer.ip,net.peer.port,http.host,http.status_code,http.status_text,http.flavor,net.transport"
#                   },
#                   "status": {}
#                 },
#                 {
#                   "traceId": "0fabcdf634aaca7de58919bdf04fbe42",
#                   "spanId": "f125ee6205e17d10",
#                   "name": "HTTP POST",
#                   "kind": "SPAN_KIND_SERVER",
#                   "startTimeUnixNano": "1655182153814311200",
#                   "endTimeUnixNano": "1655182153901119700",
#                   "attributes": {
#                     "http.url": "http://webhook.site/1bf33ef8-1840-4877-98f9-82e2ac8e60d4",
#                     "http.method": "POST",
#                     "http.target": "/1bf33ef8-1840-4877-98f9-82e2ac8e60d4",
#                     "net.peer.name": "webhook.site",
#                     "sls.original_properties": "http.url,http.method,http.target,net.peer.name"
#                   },
#                   "status": {}
#                 }
#               ]
#             },
#             {
#               "instrumentationLibrary": {
#                 "name": "@opentelemetry/instrumentation-aws-lambda",
#                 "version": "0.28.1"
#               },
#               "spans": [
#                 {
#                   "traceId": "b7daa3c960b8f9aebc9f14d77cacc741",
#                   "spanId": "5334c25300421356",
#                   "name": "aws-node-http-api-project-shanestmp-hello",
#                   "kind": "SPAN_KIND_SERVER",
#                   "startTimeUnixNano": "1655182153808751400",
#                   "endTimeUnixNano": "1655182153900369700",
#                   "attributes": {
#                     "faas.execution": "882193a5-0cda-4652-aa1a-af6be269fb9d",
#                     "faas.id": "arn:aws:lambda:us-east-1:377024778620:function:aws-node-http-api-project-shanestmp-hello",
#                     "cloud.account.id": "377024778620",
#                     "sls.original_properties": "faas.execution,faas.id,cloud.account.id",
#                     "http.path": "/",
#                     "http.status_code": 200
#                   },
#                   "status": {}
#                 }
#               ]
#             }
#           ]
#         }
#       ]
#     },
#     "responseEventPayload": {
#       "responseData": {
#         "statusCode": 200,
#         "body": "{\n  \"message\": \"Go Serverless v3.0! Your function executed successfully!\",\n  \"input\": {\n    \"version\": \"2.0\",\n    \"routeKey\": \"GET /\",\n    \"rawPath\": \"/\",\n    \"rawQueryString\": \"\",\n    \"headers\": {\n      \"accept\": \"*/*\",\n      \"content-length\": \"0\",\n      \"host\": \"b23yilmb4a.execute-api.us-east-1.amazonaws.com\",\n      \"user-agent\": \"curl/7.68.0\",\n      \"x-amzn-trace-id\": \"Root=1-62a81349-6fd19a8d0800e7e54517dfb9\",\n      \"x-forwarded-for\": \"206.174.34.16\",\n      \"x-forwarded-port\": \"443\",\n      \"x-forwarded-proto\": \"https\"\n    },\n    \"requestContext\": {\n      \"accountId\": \"377024778620\",\n      \"apiId\": \"b23yilmb4a\",\n      \"domainName\": \"b23yilmb4a.execute-api.us-east-1.amazonaws.com\",\n      \"domainPrefix\": \"b23yilmb4a\",\n      \"http\": {\n        \"method\": \"GET\",\n        \"path\": \"/\",\n        \"protocol\": \"HTTP/1.1\",\n        \"sourceIp\": \"206.174.34.16\",\n        \"userAgent\": \"curl/7.68.0\"\n      },\n      \"requestId\": \"TsfzeivVIAMEM1Q=\",\n      \"routeKey\": \"GET /\",\n      \"stage\": \"$default\",\n      \"time\": \"14/Jun/2022:04:49:13 +0000\",\n      \"timeEpoch\": 1655182153238\n    },\n    \"isBase64Encoded\": false\n  },\n  \"context\": {\n    \"awsRequestId\": \"882193a5-0cda-4652-aa1a-af6be269fb9d\"\n  }\n}"
#       },
#       "errorData": null,
#       "executionId": "882193a5-0cda-4652-aa1a-af6be269fb9d",
#       "traceId": "b7daa3c960b8f9aebc9f14d77cacc741",
#       "spanId": "5334c25300421356"
#     }
#   }
# }
