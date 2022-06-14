from opentelemetry.sdk.trace.export import SimpleSpanProcessor  # type: ignore
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter  # type: ignore


class ServerlessInMemorySpanExporter(InMemorySpanExporter):
    pass


class ServerlessSimpleSpanProcessor(SimpleSpanProcessor):
    pass


serverless_in_memory_span_exporter = ServerlessInMemorySpanExporter()
serverless_simple_span_processor = ServerlessSimpleSpanProcessor(serverless_in_memory_span_exporter)
