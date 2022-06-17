from opentelemetry.sdk.resources import Resource, ResourceDetector
from opentelemetry.semconv.resource import ResourceAttributes

from serverless.aws_lambda_otel_extension.shared import settings
from serverless.aws_lambda_otel_extension.shared.utilities import split_resource_attributes


# Replicating what is implemented here:
# https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/detectors/node/opentelemetry-resource-detector-aws/src/detectors/AwsLambdaDetector.ts
class AWSLambdaResourceDetector(ResourceDetector):
    def detect(self) -> Resource:

        return Resource(
            {
                ResourceAttributes.CLOUD_REGION: settings.cloud_region,
                ResourceAttributes.FAAS_VERSION: settings.faas_version,
                ResourceAttributes.FAAS_NAME: settings.faas_name,
                ResourceAttributes.FAAS_MAX_MEMORY: settings.faas_max_memory,
            }
        )


class ServerlessResourceDetector(ResourceDetector):
    def detect(self) -> Resource:
        return Resource(split_resource_attributes(settings.sls_otel_resource_attributes))
