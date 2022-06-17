import logging

from serverless.aws_lambda_otel_extension.shared.synchronization import extension_theading_lock

logger = logging.getLogger(__name__)


invocations = []


def append_invocation(s: str) -> None:
    with extension_theading_lock:
        global invocations
        logger.debug("append_invocation:%s", s)
        invocations.append(s)
