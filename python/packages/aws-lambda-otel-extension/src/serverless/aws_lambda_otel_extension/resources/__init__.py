from opentelemetry.sdk.resources import Resource, ResourceDetector

from serverless.aws_lambda_otel_extension import settings


class ServerlessResourceDetector(ResourceDetector):
    def detect(self) -> Resource:
        return Resource(settings.sls_otel_resource_attributes)


__all__ = [
    "ServerlessResourceDetector",
]
