import logging

from opentelemetry.sdk.resources import Resource, ResourceDetector

from serverless.aws_lambda_otel_extension.shared.environment import ENV_SLS_CONSOLE_SETTINGS

logger = logging.getLogger(__name__)


class SlsConsoleResourceDetector(ResourceDetector):
    def detect(self) -> "Resource":

        if not ENV_SLS_CONSOLE_SETTINGS:
            return Resource({})

        try:
            service, stage, org_id, _ = ENV_SLS_CONSOLE_SETTINGS.split(",")
        except Exception:
            logger.exception("Failure parsing resource attribute")
            return Resource({})

        return Resource(
            {
                "sls_service_name": service,
                "sls_stage": stage,
                "sls_org_id": org_id,
            }
        )
