from opentelemetry.sdk.resources import Resource, ResourceDetector
from opentelemetry.semconv.resource import ResourceAttributes

from serverless.aws_lambda_otel_extension.shared import environment, settings
from serverless.aws_lambda_otel_extension.shared.utilities import split_resource_attributes


# Replicating what is implemented here:
# https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/detectors/node/opentelemetry-resource-detector-aws/src/detectors/AwsLambdaDetector.ts
class AWSLambdaResourceDetector(ResourceDetector):
    def detect(self) -> "Resource":

        return Resource(
            {
                ResourceAttributes.CLOUD_REGION: environment.AWS_REGION,
                ResourceAttributes.FAAS_VERSION: environment.AWS_LAMBDA_FUNCTION_VERSION,
                ResourceAttributes.FAAS_NAME: environment.AWS_LAMBDA_FUNCTION_NAME,
                ResourceAttributes.FAAS_MAX_MEMORY: environment.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
            }
        )


class ServerlessResourceDetector(ResourceDetector):
    def detect(self) -> "Resource":
        return Resource(split_resource_attributes(settings.sls_otel_resource_attributes))
