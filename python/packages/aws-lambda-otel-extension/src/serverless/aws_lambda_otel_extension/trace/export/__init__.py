import json
import logging
import typing

from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

logger = logging.getLogger(__name__)


class ServerlessSimpleSpanProcessor(SimpleSpanProcessor):
    pass


class ServerlessInMemorySpanExporter(InMemorySpanExporter):
    pass


class LoggingSpanExporter(SpanExporter):
    def __init__(self, service_name: typing.Optional[str] = None, pretty_print: bool = False):
        self.service_name = service_name
        self.pretty_print = pretty_print

    def export(self, spans: typing.Sequence[ReadableSpan]) -> SpanExportResult:
        for span in spans:
            if not self.pretty_print:
                logger.debug({"export": json.loads(span.to_json())})
            else:
                logger.debug(json.dumps(json.loads(span.to_json()), indent=4, sort_keys=True))

        return SpanExportResult.SUCCESS


serverless_in_memory_span_exporter = ServerlessInMemorySpanExporter()
serverless_simple_span_processor = ServerlessSimpleSpanProcessor(serverless_in_memory_span_exporter)

__all__ = [
    "LoggingSpanExporter",
    "serverless_in_memory_span_exporter",
    "serverless_simple_span_processor",
    "ServerlessInMemorySpanExporter",
    "ServerlessSimpleSpanProcessor",
]
