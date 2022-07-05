from opentelemetry.sdk.resources import Resource, ResourceDetector

from serverless.aws_lambda_otel_extension.shared.settings import sls_otel_resource_attributes


class SlsExtensionResourceDetector(ResourceDetector):
    def detect(self) -> Resource:

        try:
            resource = Resource(sls_otel_resource_attributes)
        except Exception:
            resource = Resource({})

        return resource

    # def detect(self) -> "Resource":
    #     env_resources_items = os.environ.get(OTEL_RESOURCE_ATTRIBUTES)
    #     env_resource_map = {}

    #     if env_resources_items:
    #         for item in env_resources_items.split(","):
    #             try:
    #                 key, value = item.split("=", maxsplit=1)
    #             except ValueError as exc:
    #                 logger.warning(
    #                     "Invalid key value resource attribute pair %s: %s",
    #                     item,
    #                     exc,
    #                 )
    #                 continue
    #             env_resource_map[key.strip()] = value.strip()

    #     service_name = os.environ.get(OTEL_SERVICE_NAME)
    #     if service_name:
    #         env_resource_map[SERVICE_NAME] = service_name
    #     return Resource(env_resource_map)
