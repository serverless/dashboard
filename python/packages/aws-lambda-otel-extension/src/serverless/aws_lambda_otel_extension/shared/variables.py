import logging
from typing import Optional
from uuid import uuid1

from serverless.aws_lambda_otel_extension.shared.synchronization import extension_theading_lock

logger = logging.getLogger(__name__)

execution_id = str(uuid1())
extension_id: Optional[str] = None

invocations = []


def set_execution_id(s: str) -> None:
    with extension_theading_lock:
        global execution_id
        logger.debug("set_execution_id:%s", s)
        execution_id = s


def set_extension_id(s: str) -> None:
    with extension_theading_lock:
        global extension_id
        logger.debug("set_extension_id:%s", s)
        extension_id = s


def append_invocation(s: str) -> None:
    with extension_theading_lock:
        global invocations
        logger.debug("append_invocation:%s", s)
        invocations.append(s)
