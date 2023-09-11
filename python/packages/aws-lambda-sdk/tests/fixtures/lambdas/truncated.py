from sls_sdk import serverlessSdk as sdk
import random


def _get_random(length: int) -> str:
    return "".join(random.choice("0123456789abcdef") for _ in range(length))


def handler(event, context):
    truncation_method = int(event.get("truncationMethod") or "1")
    if truncation_method == 2:
        sdk._create_trace_span("user.trunc").close()
        for _ in range(100):
            sdk.set_tag(f"user.x{_get_random(200)}", _get_random(30000))
    elif truncation_method == 3:
        for _ in range(100):
            user_span = sdk._create_trace_span(f"user.x{_get_random(200)}")
            sdk.capture_warning(f"Test:{_get_random(10000)}")
            user_span.close()
    elif truncation_method == 4:
        for _ in range(100):
            user_span = sdk._create_trace_span(f"user.x{_get_random(200)}")
            if _ == 1:
                sdk.capture_warning(f"Test:{_get_random(10000)}")
            sdk.capture_error(f"Test:{_get_random(10000)}")
            user_span.close()
    else:
        for _ in range(7000):
            sdk._create_trace_span(f"user.x{_get_random(200)}").close()

    return "ok"
