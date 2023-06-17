from .sdk import serverlessSdk
from sls_sdk.lib.captured_event import CapturedEvent  # noqa E402

DEV_MODE_SPECIFIC_EVENT_FINGERPRINTS = {
    "INPUT_BODY_BINARY",
    "INPUT_BODY_TOO_LARGE",
    "OUTPUT_BODY_BINARY",
    "OUTPUT_BODY_TOO_LARGE",
}


def should_include(captured_event: CapturedEvent):
    if (
        not serverlessSdk._is_dev_mode
        and captured_event.custom_fingerprint in DEV_MODE_SPECIFIC_EVENT_FINGERPRINTS
    ):
        return False
    else:
        return True
