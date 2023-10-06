from .sdk import serverlessSdk
from .api_events import is_api_event, is_api_gateway_v2_event

aws_lambda_span = serverlessSdk.trace_spans.aws_lambda


def _get_response_status_code(response):
    status_code = None
    if response and isinstance(response, dict):
        status_code = response.get("statusCode")

    if status_code is None:
        return 200 if is_api_gateway_v2_event() else None

    try:
        return int(status_code)
    except Exception:
        return None


def resolve(response):
    if not is_api_event():
        return

    status_code = _get_response_status_code(response)
    if status_code is None:
        aws_lambda_span.tags.set("aws.lambda.http.error_code", "MISSING_STATUS_CODE")
        return

    if status_code >= 100 and status_code < 600:
        aws_lambda_span.tags.set("aws.lambda.http.status_code", status_code)
    else:
        aws_lambda_span.tags.set("aws.lambda.http.error_code", "INVALID_STATUS_CODE")
