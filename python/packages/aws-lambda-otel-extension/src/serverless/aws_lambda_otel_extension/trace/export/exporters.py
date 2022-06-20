import json
import logging
import typing

from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

logger = logging.getLogger(__name__)


class LoggingSpanExporter(SpanExporter):
    def __init__(self, service_name: typing.Optional[str] = None, pretty_print: bool = False):
        self.service_name = service_name
        self.pretty_print = pretty_print

    def export(self, spans: typing.Sequence[ReadableSpan]) -> SpanExportResult:
        for span in spans:
            if not self.pretty_print:
                logger.debug({"export": json.loads(span.to_json())})
            else:
                # No comment...
                logger.debug(json.dumps(json.loads(span.to_json()), indent=4, sort_keys=True))

        return SpanExportResult.SUCCESS
