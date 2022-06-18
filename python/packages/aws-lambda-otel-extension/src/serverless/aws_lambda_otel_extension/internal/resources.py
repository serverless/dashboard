from opentelemetry.sdk.resources import Resource, ResourceDetector
from opentelemetry.semconv.resource import ResourceAttributes

from serverless.aws_lambda_otel_extension.shared import settings


# Replicating what is implemented here:
# https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/detectors/node/opentelemetry-resource-detector-aws/src/detectors/AwsLambdaDetector.ts
class AWSLambdaResourceDetector(ResourceDetector):
    def detect(self) -> Resource:

        return Resource(
            {
                ResourceAttributes.CLOUD_REGION: settings.aws_region,
                ResourceAttributes.FAAS_VERSION: settings.aws_lambda_function_version,
                ResourceAttributes.FAAS_NAME: settings.aws_lambda_function_name,
                ResourceAttributes.FAAS_MAX_MEMORY: settings.aws_lambda_function_memory_size,
            }
        )


class ServerlessResourceDetector(ResourceDetector):
    def detect(self) -> Resource:
        return Resource(settings.sls_otel_resource_attributes)
