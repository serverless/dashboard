from serverless.aws_lambda_otel_extension.initialize import sls_extension_initialize
from serverless.aws_lambda_otel_extension.opentelemetry.instrumentation.aws_lambda import SlsAwsLambdaInstrumentor

__all__ = [
    "sls_extension_initialize",
    "SlsAwsLambdaInstrumentor",
]
