import json
import logging
import threading
import urllib.request
from typing import Dict, List, Sequence

from opentelemetry.attributes import BoundedAttributes  # type: ignore
from opentelemetry.sdk.trace import Event, ReadableSpan, Resource, Span
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.util.instrumentation import InstrumentationScope
from opentelemetry.trace import SpanContext, format_span_id, format_trace_id

from serverless.aws_lambda_otel_extension.opentelemetry.semconv.trace import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.shared.constants import (
    HTTP_CONTENT_TYPE_APPLICATION_JSON,
    HTTP_CONTENT_TYPE_HEADER,
    HTTP_METHOD_POST,
)
from serverless.aws_lambda_otel_extension.shared.settings import (
    SETTINGS_SLS_EXTENSION_EXPORT_URL,
    SETTINGS_SLS_EXTENSION_INTERNAL_LOG,
    SETTINGS_SLS_EXTENSION_INTERNAL_LOG_PRETTY,
)
from serverless.aws_lambda_otel_extension.shared.store import store
from serverless.aws_lambda_otel_extension.worker.http import http_client_worker_pool

logger = logging.getLogger(__name__)

SLS_SPAN_TYPE = SlsExtensionSpanAttributes.SLS_SPAN_TYPE
SLS_ORIGINAL_PROPERTIES = SlsExtensionSpanAttributes.SLS_ORIGINAL_PROPERTIES


def telemetry_formatted_span(span: ReadableSpan) -> Dict:

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
                "timeUnixNano": str(event.timestamp),
                "attributes": {
                    **span._format_attributes(event.attributes),
                    SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(event.attributes).keys()),
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
                    SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(link.attributes).keys()),
                },
            }
        )

    data: Dict = {
        "name": span._name,
        "traceId": format_trace_id(span.context.trace_id),
        "spanId": format_span_id(span.context.span_id),
        "parentSpanId": parent_id,
        "kind": f"SPAN_KIND_{span.kind.name}",
        "startTimeUnixNano": str(span._start_time),
        "endTimeUnixNano": str(span._end_time),
        "attributes": {
            **span._format_attributes(span._attributes),
            SLS_ORIGINAL_PROPERTIES: ",".join(span._format_attributes(span._attributes).keys()),
        },
        "events": events,
        "links": links,
        "status": {},
    }

    return data


class SlsExtensionSpanExporter(SpanExporter):
    def __init__(self, endpoint: str = None, silent: bool = False):
        self._stopped = False
        self._lock = threading.Lock()
        self._spans_by_span_id_by_trace_id: Dict[int, Dict[int, ReadableSpan]] = {}
        self._event_span_event_by_trace_id: Dict[int, Event] = {}
        self._telemetry_span_event_by_trace_id: Dict[int, Event] = {}
        self._endpoint = endpoint or SETTINGS_SLS_EXTENSION_EXPORT_URL
        self._silent = silent

    def clear_by_trace_id(self, trace_id):
        with self._lock:
            self._event_span_event_by_trace_id.pop(trace_id, None)
            self._telemetry_span_event_by_trace_id.pop(trace_id, None)

    def _send_event_data_for_instrumentation_context(self, instrumentation_context: SpanContext):

        trace_id = instrumentation_context.trace_id
        span_id = instrumentation_context.span_id

        event_span_event = self._event_span_event_by_trace_id.get(trace_id)

        if event_span_event is None:
            return

        if event_span_event.attributes is None:
            return

        try:
            execution_id = event_span_event.attributes["computeExecutionId"]
        except KeyError:
            logger.exception("Failed to get request id from event attributes and unable to send event data")
            return

        request_data = store.get_request_data_for_trace_id(trace_id)

        event_data = {
            "record": {
                "eventData": {
                    execution_id: {
                        **event_span_event.attributes,
                    },
                },
                "requestEventPayload": {
                    "executionId": execution_id,
                    "requestData": request_data,
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                    "timestamp": int(event_span_event.timestamp / 1000000),
                },
                "span": {
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                },
            },
            "recordType": "eventData",
        }

        if not SETTINGS_SLS_EXTENSION_INTERNAL_LOG:
            try:
                http_client_worker_pool.submit_request(
                    urllib.request.Request(
                        self._endpoint,
                        method=HTTP_METHOD_POST,
                        headers={
                            HTTP_CONTENT_TYPE_HEADER: HTTP_CONTENT_TYPE_APPLICATION_JSON,
                        },
                        data=bytes(json.dumps(event_data), "utf-8"),
                    )
                )
            except Exception:
                logger.exception("Failed to submit event data")

            if not self._silent:
                logger.debug(
                    json.dumps(
                        {"extension": {"send": event_data}},
                        indent=4 if SETTINGS_SLS_EXTENSION_INTERNAL_LOG_PRETTY else None,
                        sort_keys=True,
                    )
                )
        else:
            if not self._silent:
                print(  # noqa: T201
                    json.dumps(
                        {"extension": {"send": event_data}},
                        indent=4 if SETTINGS_SLS_EXTENSION_INTERNAL_LOG_PRETTY else None,
                        sort_keys=True,
                    )
                )

    def _send_telemetry_data_for_instrumentation_context(self, instrumentation_context: SpanContext):

        trace_id = instrumentation_context.trace_id
        span_id = instrumentation_context.span_id

        telemetry_span_event = self._telemetry_span_event_by_trace_id.get(trace_id)

        if telemetry_span_event is None:
            return

        if telemetry_span_event.attributes is None:
            return

        try:
            execution_id = telemetry_span_event.attributes["computeExecutionId"]
        except KeyError:
            logger.exception("Failed to get request id from event attributes and unable to send event data")
            return

        instrumentation_library_spans_by_resource: Dict[Resource, Dict[InstrumentationScope, List[ReadableSpan]]] = {}

        trace_ids = [trace_id]

        for spans_by_span_id in self._spans_by_span_id_by_trace_id.values():
            # Iterate through all the spans and check for trace id in root and links.
            for span in spans_by_span_id.values():
                if span.links:
                    for link in span.links:
                        if span.context.trace_id in trace_ids:
                            trace_ids.append(link.context.trace_id)

        for spans_by_span_id in self._spans_by_span_id_by_trace_id.values():
            # Build up the dictionary that will be used to produce the resource_spans dictionary.
            for span in spans_by_span_id.values():
                if span.context.trace_id in trace_ids:
                    instrumentation_library_spans_by_resource.setdefault(span.resource, {})
                    instrumentation_library_spans_by_resource[span.resource].setdefault(span.instrumentation_scope, [])
                    instrumentation_library_spans_by_resource[span.resource][span.instrumentation_scope].append(span)

        resource_spans = []

        # Pivot instrumentation scope and spans into place.
        for resource, instrumentation_library_spans_by_scope in instrumentation_library_spans_by_resource.items():

            instrumentation_library_spans = []

            for instrumentation_scope, spans in instrumentation_library_spans_by_scope.items():
                instrumentation_library_spans.append(
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
                    "instrumentationLibrarySpans": instrumentation_library_spans,
                }
            )

        response_data = store.get_response_data_for_trace_id(trace_id)

        telemetry_data = {
            "record": {
                "function": {
                    **telemetry_span_event.attributes,
                },
                "responseEventPayload": {
                    "errorData": None,
                    "executionId": execution_id,
                    "responseData": response_data,
                    "spanId": format_span_id(span_id),
                    "traceId": format_trace_id(trace_id),
                },
                "traces": {
                    "resourceSpans": resource_spans,
                },
            },
            "recordType": "telemetryData",
            "requestId": execution_id,
        }

        if not SETTINGS_SLS_EXTENSION_INTERNAL_LOG:
            try:
                http_client_worker_pool.submit_request(
                    urllib.request.Request(
                        self._endpoint,
                        method=HTTP_METHOD_POST,
                        headers={
                            HTTP_CONTENT_TYPE_HEADER: HTTP_CONTENT_TYPE_APPLICATION_JSON,
                        },
                        data=bytes(json.dumps(telemetry_data), "utf-8"),
                    )
                )
            except Exception:
                logger.exception("Failed to submit telemetry data")

            if not self._silent:
                logger.debug(
                    json.dumps(
                        {"extension": {"send": telemetry_data}},
                        indent=4 if SETTINGS_SLS_EXTENSION_INTERNAL_LOG_PRETTY else None,
                        sort_keys=True,
                    )
                )
        else:
            if not self._silent:
                print(  # noqa: T201
                    json.dumps(
                        {"extension": {"send": telemetry_data}},
                        indent=4 if SETTINGS_SLS_EXTENSION_INTERNAL_LOG_PRETTY else None,
                        sort_keys=True,
                    )
                )

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:

        if self._stopped:
            return SpanExportResult.FAILURE

        instrumentation_spans: List[ReadableSpan] = []

        for span in spans:

            with self._lock:
                self._spans_by_span_id_by_trace_id.setdefault(span.context.trace_id, {})[span.context.span_id] = span

            sls_span_type = None
            if span.attributes:
                sls_span_type = span.attributes.get(SLS_SPAN_TYPE)

            if sls_span_type == "pre":
                for event in span.events:
                    if event.name == "event":
                        with self._lock:
                            self._event_span_event_by_trace_id[span.context.trace_id] = event
                    if span.parent:
                        self._send_event_data_for_instrumentation_context(span.parent)
                    else:
                        # TODO: Emit something here.
                        pass
            elif sls_span_type == "post":
                for event in span.events:
                    if event.name == "telemetry":
                        with self._lock:
                            self._telemetry_span_event_by_trace_id[span.context.trace_id] = event
            elif sls_span_type == "instrumentation":
                instrumentation_spans.append(span)

        # data.
        for instrumentation_span in instrumentation_spans:
            # TODO: Move these bits to a span processor that can handle threading this different.
            self._send_telemetry_data_for_instrumentation_context(instrumentation_span.context)
            with self._lock:
                self._spans_by_span_id_by_trace_id.pop(instrumentation_span.context.trace_id, None)
                self._event_span_event_by_trace_id.pop(instrumentation_span.context.trace_id, None)
                self._telemetry_span_event_by_trace_id.pop(instrumentation_span.context.trace_id, None)

            # Make sure all the HTTP clients are properly flushed.
            try:
                http_client_worker_pool.force_flush()
            except Exception:
                logger.exception("Exception while flushing http client worker pool")

        return SpanExportResult.SUCCESS

    def shutdown(self):
        self._stopped = True
