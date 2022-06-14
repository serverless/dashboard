from __future__ import annotations

import http.client
import http.server
import json
import logging
import sys
import threading
import time
import urllib.request
from typing import Any

from serverless.aws_lambda_otel_extension.shared import constants, enums, settings, synchronization, variables

logger = logging.getLogger(__name__)


class OtelHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_GET(self) -> None:
        self.send_response(200)
        self.end_headers()

    def do_POST(self) -> None:

        http_request: urllib.request.Request
        # http_response: http.client.HTTPResponse

        try:
            payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        except Exception:
            logger.exception("Failed to parse payload")
            payload = {}

        record_type = payload.get("recordType")

        if record_type == "eventData":

            http_request = urllib.request.Request(
                "http://144.126.223.126:8000",
                method=constants.HTTP_METHOD_POST,
                headers={
                    constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
                    constants.LAMBDA_EXTENSION_IDENTIFIER_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
                    constants.LAMBDA_EXTENSION_NAME_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
                },
                data=bytes(json.dumps(payload), "utf-8"),
            )

            logger.debug("Putting eventData...")
            t = threading.Thread(
                target=urllib.request.urlopen, args=(http_request,), kwargs={"timeout": 3600}, daemon=True
            )
            t.start()
            logger.debug("Put eventData...")

        elif record_type == "telemetryData":

            http_request = urllib.request.Request(
                "http://144.126.223.126:8000",
                method=constants.HTTP_METHOD_POST,
                headers={
                    constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
                    constants.LAMBDA_EXTENSION_IDENTIFIER_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
                    constants.LAMBDA_EXTENSION_NAME_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
                },
                data=bytes(json.dumps(payload), "utf-8"),
            )

            logger.debug("Putting telemetryData...")
            t = threading.Thread(
                target=urllib.request.urlopen, args=(http_request,), kwargs={"timeout": 3600}, daemon=True
            )
            t.start()
            logger.debug("Put telemetryData...")

        self.send_response(200)
        self.end_headers()


class LogHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_POST(self) -> None:
        self.send_response(200)
        self.end_headers()

    # Documentation is unclear on if certian runtimes will prefer PUT over POST.
    do_PUT = do_POST


class OtelThreadingHTTPServer(http.server.ThreadingHTTPServer):

    request_queue_size: int = 20

    def service_actions(self) -> None:
        return super().service_actions()

    def server_activate(self) -> None:
        synchronization.otel_server_active_event.set()
        return super().server_activate()


class LogThreadingHTTPServer(http.server.ThreadingHTTPServer):

    request_queue_size: int = 20

    def service_actions(self) -> None:
        return super().service_actions()

    def server_activate(self) -> None:
        synchronization.log_server_active_event.set()
        return super().server_activate()


def extensions_api_register_once() -> None:

    # We want to wait for this to be up before we register and attempt to process an event.
    synchronization.otel_server_active_event.wait()

    http_request: urllib.request.Request
    http_response: http.client.HTTPResponse

    http_request = urllib.request.Request(
        settings.extensions_api_register_url,
        method=constants.HTTP_METHOD_POST,
        headers={
            constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
            constants.LAMBDA_EXTENSION_NAME_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
        },
        data=bytes(
            json.dumps(
                {
                    "events": [
                        enums.ExtensionEventType.Invoke.value,
                        enums.ExtensionEventType.Shutdown.value,
                    ]
                }
            ),
            "utf-8",
        ),
    )

    http_response = urllib.request.urlopen(http_request)
    http_response.read()

    variables.set_extension_id(http_response.getheader("Lambda-Extension-Identifier"))

    synchronization.extension_registered_event.set()


def logs_api_register_once() -> None:

    synchronization.log_server_active_event.wait()

    http_request: urllib.request.Request
    http_response: http.client.HTTPResponse

    http_request = urllib.request.Request(
        settings.logs_api_register_url,
        method=constants.HTTP_METHOD_PUT,
        headers={
            constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
            constants.LAMBDA_EXTENSION_IDENTIFIER_HEADER: variables.extension_id,
        },
        data=bytes(
            json.dumps(
                {
                    "schemaVersion": "2021-03-18",
                    "types": ["platform", "extension", "function"],
                    "buffering": {
                        "maxItems": 1000,
                        "maxBytes": 262144,
                        "timeoutMs": 100,
                    },
                    "destination": {
                        "protocol": "HTTP",
                        "URI": settings.log_server_url,
                    },
                }
            ),
            "utf-8",
        ),
    )

    logger.debug("logs_api_register_once:request:%s", http_request)

    http_response = urllib.request.urlopen(http_request)
    http_response.read()

    synchronization.log_registered_event.set()


def extensions_api_next_loop() -> None:

    synchronization.extension_registered_event.wait()
    synchronization.log_registered_event.wait()

    http_request: urllib.request.Request
    http_response: http.client.HTTPResponse

    while True:

        http_request = urllib.request.Request(
            settings.extensions_api_next_url,
            headers={
                constants.LAMBDA_EXTENSION_IDENTIFIER_HEADER: variables.extension_id,
            },
        )

        http_response = urllib.request.urlopen(http_request, timeout=9999)
        response_body = http_response.read()

        payload = json.loads(response_body)

        if payload.get("eventType") == "SHUTDOWN":
            sys.exit(0)

        time.sleep(2)


def heartbeat_loop() -> None:

    http_request: urllib.request.Request
    http_response: http.client.HTTPResponse

    while True:
        try:
            http_request = urllib.request.Request(
                "http://144.126.223.126:8000",
                method=constants.HTTP_METHOD_POST,
                headers={
                    constants.HTTP_CONTENT_TYPE_HEADER: constants.HTTP_CONTENT_TYPE_APPLICATION_JSON,
                    constants.LAMBDA_EXTENSION_IDENTIFIER_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
                    constants.LAMBDA_EXTENSION_NAME_HEADER: constants.SERVERLESS_AWS_LAMBDA_OTEL_EXTENSION_NAME,
                },
                data=bytes(json.dumps({"time": time.time()}), "utf-8"),
            )

            http_response = urllib.request.urlopen(http_request, timeout=10)
            http_response.read()
        except Exception:
            logger.exception("Exception in heartbeat_loop")

        time.sleep(1)


def otel_http_server_serve(addr, port):

    with OtelThreadingHTTPServer((addr, port), OtelHTTPRequestHandler) as server:
        server.serve_forever(poll_interval=None)


def log_http_server_serve(addr, port):

    synchronization.extension_registered_event.wait()

    with LogThreadingHTTPServer((addr, port), LogHTTPRequestHandler) as server:
        server.serve_forever(poll_interval=None)


def start():

    serverless_runtime_server_thread = threading.Thread(
        target=otel_http_server_serve,
        args=(settings.otel_server_host, settings.otel_server_port),
        daemon=True,
    )

    serverless_runtime_server_thread.start()

    serverless_runtime_log_server_thread = threading.Thread(
        target=log_http_server_serve,
        args=(settings.log_server_host, settings.log_server_port),
        daemon=True,
    )

    serverless_runtime_log_server_thread.start()

    extension_client_register_thread = threading.Thread(target=extensions_api_register_once, daemon=True)
    extension_client_register_thread.start()

    log_register_thread = threading.Thread(target=logs_api_register_once, daemon=True)
    log_register_thread.start()

    extension_client_next_loop_thread = threading.Thread(target=extensions_api_next_loop, daemon=True)
    extension_client_next_loop_thread.start()

    heartbeat_loop_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_loop_thread.start()

    try:
        while True:
            # add more here to check for shutdown
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass

    sys.exit(0)


if __name__ == "__main__":
    start()


# {
#     "eventType": "INVOKE",
#     "deadlineMs": 1654468766618,
#     "requestId": "dbdb0d38-24e5-45eb-ad4f-3234faaa30d5",
#     "invokedFunctionArn": "arn:aws:lambda:us-east-1:377024778620:function:runtime-python-example-dev-hello",
#     "tracing": {
#         "type": "X-Amzn-Trace-Id",
#         "value": "Root=1-629d3097-1edcadf06b4c097a50faa7a1;Parent=2a68d66d2a726db8;Sampled=0",
#     },
# }

# {
#     "eventType": "SHUTDOWN",
#     "deadlineMs": 1654469121614,
#     "shutdownReason": "spindown",
# }

# {
#     "eventType": "SHUTDOWN",
#     "deadlineMs": 1654470414327,
#     "shutdownReason": "timeout",
# }

# SPINDOWN, TIMEOUT, FAILURE

# {
#     "name": "handler.hello",
#     "context": {
#         "trace_id": "0xb33bfbd55d86873c64136e22832f82d6",
#         "span_id": "0x773584354928d957",
#         "trace_state": "[]",
#     },
#     "kind": "SpanKind.SERVER",
#     "parent_id": null,
#     "start_time": "2022-06-05T22:39:20.622887Z",
#     "end_time": "2022-06-05T22:39:20.625299Z",
#     "status": {"status_code": "UNSET"},
#     "attributes": {
#         "faas.id": "arn:aws:lambda:us-east-1:377024778620:function:runtime-python-example-dev-hello",
#         "faas.execution": "dbdb0d38-24e5-45eb-ad4f-3234faaa30d5",
#     },
#     "events": [],
#     "links": [],
#     "resource": {"service.name": "your-service-name"},
# }

# [
#     {
#         "time": "2022-06-05T23:53:22.289Z",
#         "type": "platform.start",
#         "record": {"requestId": "00bbcc13-f812-41d1-a9ef-8486fbc0b99c", "version": "$LATEST"},
#     },
#     {
#         "time": "2022-06-05T23:53:22.289Z",
#         "type": "platform.extension",
#         "record": {
#             "name": "serverless_aws_lambda_otel_extension.py",
#             "state": "Ready",
#             "events": ["INVOKE", "SHUTDOWN"],
#         },
#     },
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": "{\n"},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"name": "handler.hello",\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"context": {\n'},
#     {
#         "time": "2022-06-05T23:53:22.296Z",
#         "type": "function",
#         "record": '"trace_id": "0x77986fa86dac783f1cf430b7b7cc19dd",\n',
#     },
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"span_id": "0xe03ba74521ddce35",\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"trace_state": "[]"\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": "},\n"},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"kind": "SpanKind.SERVER",\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"parent_id": null,\n'},
#     {
#         "time": "2022-06-05T23:53:22.296Z",
#         "type": "function",
#         "record": '"start_time": "2022-06-05T23:53:22.293726Z",\n',
#     },
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"end_time": "2022-06-05...
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"status": {\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"status_code": "UNSET"\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": "},\n"},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"attributes": {\n'},
#     {
#         "time": "2022-06-05T23:53:22.296Z",
#         "type": "function",
#         "record": '"faas.id": "arn:aws:lambda:us-east-1:377024778620:function:runtime-python-example-dev-hello",\n',
#     },
#     {
#         "time": "2022-06-05T23:53:22.296Z",
#         "type": "function",
#         "record": '"faas.execution": "00bbcc13-f812-41d1-a9ef-8486fbc0b99c"\n',
#     },
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": "},\n"},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"events": [],\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"links": [],\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"resource": {\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": '"service.name": "your-service-name"\n'},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": "}\n"},
#     {"time": "2022-06-05T23:53:22.296Z", "type": "function", "record": "}\n"},
#     {
#         "time": "2022-06-05T23:53:22.309Z",
#         "type": "platform.runtimeDone",
#         "record": {"requestId": "00bbcc13-f812-41d1-a9ef-8486fbc0b99c", "status": "success"},
#     },
# ]
