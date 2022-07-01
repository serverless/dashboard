from opentelemetry.sdk.resources import Resource, ResourceDetector

from serverless.aws_lambda_otel_extension.shared.settings import sls_otel_resource_attributes


class SlsExtensionResourceDetector(ResourceDetector):
    def detect(self) -> Resource:
        return Resource(sls_otel_resource_attributes)
