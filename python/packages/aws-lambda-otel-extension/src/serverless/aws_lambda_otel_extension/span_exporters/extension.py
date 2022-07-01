import http.client
import time
import urllib.request

import json
import logging
import threading
from json import JSONDecodeError
from typing import Any, Dict, List, Mapping, Optional, Sequence
from opentelemetry.attributes import BoundedAttributes  # type: ignore

from opentelemetry.sdk.util.instrumentation import InstrumentationScope
from opentelemetry.sdk.trace import ReadableSpan, Event, Resource
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.trace import format_span_id, format_trace_id

from serverless.aws_lambda_otel_extension.shared.settings import extension_otel_http_url
from serverless.aws_lambda_otel_extension.span_attributes.extension import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.shared.constants import (
    HTTP_CONTENT_TYPE_APPLICATION_JSON,
    HTTP_CONTENT_TYPE_HEADER,
    HTTP_METHOD_POST,
    WRAPPER_INSTRUMENTATION_NAME,
)
from serverless.aws_lambda_otel_extension.span_formatters.extension import telemetry_formatted_span

logger = logging.getLogger(__name__)


class SlsExtensionSpanExporter(SpanExporter):
    def __init__(self):
        self._stopped = False
        self._lock = threading.Lock()
        self._spans_by_trace_id: Dict[int, List[ReadableSpan]] = {}
        self._event_span_event_by_trace_id: Dict[int, Event] = {}
        self._telemetry_span_event_by_trace_id: Dict[int, Event] = {}
        self._request_span_event_by_trace_id: Dict[int, Event] = {}
        self._response_span_event_by_trace_id: Dict[int, Event] = {}

    def clear_by_trace_id(self, trace_id):
        with self._lock:
            self._event_span_event_by_trace_id.pop(trace_id, None)
            self._telemetry_span_event_by_trace_id.pop(trace_id, None)

    def _send_event_data_for_trace_id(self, trace_id: int, span_id: int):

        event_span_event = self._event_span_event_by_trace_id.get(trace_id)
        request_span_event = self._request_span_event_by_trace_id.get(trace_id)

        if event_span_event is None or request_span_event is None:
            return

        if event_span_event.attributes is None:
            return

        try:
            request_id = event_span_event.attributes["computeRequestId"]
        except KeyError:
            logger.exception("Failed to get request id from event attributes and unable to send event data")
            return

        _event = None
        event = None

        if isinstance(request_span_event.attributes, Mapping):
            _event = request_span_event.attributes.get(SlsExtensionSpanAttributes.SLS_HANDLER_REQUEST)

        if isinstance(_event, (str, bytes)):
            try:
                event = json.loads(_event)
            except JSONDecodeError:
                pass

        event_data = {
            "record": {
                "eventData": {
                    request_id: {
                        **event_span_event.attributes,
                    },
                },
                "requestEventPayload": {
                    "executionId": request_id,
                    "requestData": event,
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                },
                "span": {
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                },
            },
            "recordType": "eventData",
        }

        try:
            extension_otel_http_response: http.client.HTTPResponse = urllib.request.urlopen(
                urllib.request.Request(
                    extension_otel_http_url,
                    method=HTTP_METHOD_POST,
                    headers={
                        HTTP_CONTENT_TYPE_HEADER: HTTP_CONTENT_TYPE_APPLICATION_JSON,
                    },
                    data=bytes(json.dumps(event_data), "utf-8"),
                )
            )
            extension_otel_http_response.read()
        except Exception:
            logger.exception("Failed to send handler eventData")

    def _send_telemetry_data_for_trace_id(self, trace_id: int, span_id: int):

        telemetry_span_event = self._telemetry_span_event_by_trace_id.get(trace_id)
        response_span_event = self._response_span_event_by_trace_id.get(trace_id)

        if telemetry_span_event is None or response_span_event is None:
            return

        if telemetry_span_event.attributes is None:
            return

        try:
            request_id = telemetry_span_event.attributes["computeRequestId"]
        except KeyError:
            logger.exception("Failed to get request id from event attributes and unable to send event data")
            return

        _result = None
        result = None

        if isinstance(response_span_event.attributes, Mapping):
            _result = response_span_event.attributes.get(SlsExtensionSpanAttributes.SLS_HANDLER_RESPONSE)

        if isinstance(_result, (str, bytes)):
            try:
                result = json.loads(_result)
            except JSONDecodeError:
                pass

        instrumentation_spans_by_resource: Dict[Resource, Dict[InstrumentationScope, List[ReadableSpan]]] = {}

        trace_ids = [trace_id]

        # Iterate through all the spans and check for trace id in root and links.
        for spans in self._spans_by_trace_id.values():
            for span in spans:
                if span.links:
                    for link in span.links:
                        if link.context.trace_id in trace_ids:
                            trace_ids.append(span.context.trace_id)

        # Build up the dictionary that will be used to produce the resource_spans dictionary.
        for spans in self._spans_by_trace_id.values():
            for span in spans:
                if span.context.trace_id in trace_ids:
                    instrumentation_spans_by_resource.setdefault(span.resource, {})
                    instrumentation_spans_by_resource[span.resource].setdefault(span.instrumentation_scope, [])
                    instrumentation_spans_by_resource[span.resource][span.instrumentation_scope].append(span)

        resource_spans = []

        # Pivot instrumentation scope and spans into place.
        for resource, instrumentation_spans_by_scope in instrumentation_spans_by_resource.items():

            instrumentation_spans = []

            for instrumentation_scope, spans in instrumentation_spans_by_scope.items():
                instrumentation_spans.append(
                    {
                        "instrumentationLibrary": {
                            "name": instrumentation_scope.name,
                            "version": instrumentation_scope.version,
                        },
                        "spans": [telemetry_formatted_span(s) for s in spans],
                    }
                )

            resource_spans.append(
                {
                    "resource": {
                        **BoundedAttributes(
                            attributes={
                                **resource.attributes,
                            }
                        ),
                    },
                    "instrumentationSpans": instrumentation_spans,
                }
            )

        telemetry_data = {
            "record": {
                "function": {
                    **telemetry_span_event.attributes,
                },
                "responseEventPayload": {
                    "errorData": None,
                    "executionId": request_id,
                    "responseData": result,
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                },
                "span": {
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                },
                "traces": {
                    "resourceSpans": resource_spans,
                },
            },
            "recordType": "telemetryData",
            "requestId": request_id,
        }

        try:
            extension_otel_http_response: http.client.HTTPResponse = urllib.request.urlopen(
                urllib.request.Request(
                    extension_otel_http_url,
                    method=HTTP_METHOD_POST,
                    headers={
                        HTTP_CONTENT_TYPE_HEADER: HTTP_CONTENT_TYPE_APPLICATION_JSON,
                    },
                    data=bytes(json.dumps(telemetry_data), "utf-8"),
                )
            )
            extension_otel_http_response.read()
        except Exception:
            logger.exception("Failed to send handler eventData")

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:

        if self._stopped:
            return SpanExportResult.FAILURE

        wrapper_trace_id: Optional[int] = None

        for span in spans:

            with self._lock:
                self._spans_by_trace_id.setdefault(span.context.trace_id, []).append(span)

            if span.instrumentation_scope.name == WRAPPER_INSTRUMENTATION_NAME:
                if span.name == "start":
                    for event in span.events:
                        if event.name == "event":
                            with self._lock:
                                self._event_span_event_by_trace_id[span.context.trace_id] = event
                        elif event.name == "request":
                            with self._lock:
                                self._request_span_event_by_trace_id[span.context.trace_id] = event
                        if span.parent:
                            self._send_event_data_for_trace_id(span.parent.trace_id, span.parent.span_id)
                if span.name == "finish":
                    for event in span.events:
                        if event.name == "telemetry":
                            with self._lock:
                                self._telemetry_span_event_by_trace_id[span.context.trace_id] = event
                        elif event.name == "response":
                            with self._lock:
                                self._response_span_event_by_trace_id[span.context.trace_id] = event
                        if span.parent:
                            self._send_telemetry_data_for_trace_id(span.parent.trace_id, span.parent.span_id)
                if span.name == "wrapper":
                    wrapper_trace_id = span.context.trace_id

        # if wrapper_trace_id:
        #     print(self._request_span_event_by_trace_id)
        #     print(self._response_span_event_by_trace_id)

        return SpanExportResult.SUCCESS

    def shutdown(self):
        self._stopped = True
