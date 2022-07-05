from serverless.aws_lambda_otel_extension.rigging.logging import setup_logging
from serverless.aws_lambda_otel_extension.rigging.opentelemetry import setup_auto_instrumentor, setup_tracer_provider


def initialize():
    setup_logging()
    tracer_provider = setup_tracer_provider()
    setup_auto_instrumentor(tracer_provider)
