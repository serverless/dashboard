import logging

from opentelemetry.sdk.resources import Attributes, Resource, ResourceDetector

from serverless.aws_lambda_otel_extension.opentelemetry.semconv.resource import SlsExtensionResourceAttributes
from serverless.aws_lambda_otel_extension.shared.settings import SETTINGS_SLS_EXTENSION, SETTINGS_SLS_EXTENSION_OVERRIDE
from serverless.aws_lambda_otel_extension.shared.utilities import filter_dict_value_is_not_none

logger = logging.getLogger(__name__)

SLS_ORG_ID = SlsExtensionResourceAttributes.SLS_ORG_ID
SLS_SERVICE_NAME = SlsExtensionResourceAttributes.SLS_SERVICE_NAME
SLS_STAGE = SlsExtensionResourceAttributes.SLS_STAGE


class SlsExtensionResourceDetector(ResourceDetector):
    """Detects OpenTelemetry Resource attributes from the SLS_EXTENSION_SETTINGS environment variable made available
    through SETTINGS_SLS_EXTENSION."""

    def detect(self) -> "Resource":

        org_id = SETTINGS_SLS_EXTENSION_OVERRIDE.get("orgId", SETTINGS_SLS_EXTENSION.get("orgId"))
        namespace = SETTINGS_SLS_EXTENSION_OVERRIDE.get("namespace", SETTINGS_SLS_EXTENSION.get("namespace"))
        environment = SETTINGS_SLS_EXTENSION_OVERRIDE.get("environment", SETTINGS_SLS_EXTENSION.get("environment"))

        if self.raise_on_error:
            if org_id is None:
                raise ValueError("org_id is required")
            if namespace is None:
                raise ValueError("namespace is required")
            if environment is None:
                raise ValueError("environment is required")

        attributes: Attributes = filter_dict_value_is_not_none(
            {
                SLS_ORG_ID: org_id,
                SLS_SERVICE_NAME: namespace,
                SLS_STAGE: environment,
            }
        )

        logger.debug({"attributes": attributes})

        return Resource(attributes)
