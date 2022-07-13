import json
import logging
from typing import Optional, Sequence

from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

logger = logging.getLogger(__name__)


class SlsLoggingSpanExporter(SpanExporter):
    def __init__(self, service_name: Optional[str] = None, pretty_print: bool = False):
        self.service_name = service_name
        self.pretty_print = pretty_print

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        for span in spans:
            logger.debug(
                json.dumps(
                    {
                        "instrumentation": {
                            "name": span.instrumentation_scope.name,
                            "version": span.instrumentation_scope.version,
                        },
                        "span": json.loads(span.to_json()),
                    },
                    indent=4 if self.pretty_print else None,
                    sort_keys=True,
                )
            )

        return SpanExportResult.SUCCESS
