from .warning_captured_event import create as create_warning_captured_event
from .imports import internally_imported

with internally_imported():
    import logging


logger = logging.getLogger(__name__)


def report(message: str, code, type: str = "INTERNAL"):
    logger.warning(
        {
            "source": "serverlessSdk",
            "type": f"WARNING_TYPE_SDK_{type}",
            "message": message,
            "code": code,
        }
    )

    create_warning_captured_event(
        message,
        type=("sdkUser" if type == "USER" else "sdkInternal"),
        origin="pythonLogging",
        fingerprint=code,
    )
