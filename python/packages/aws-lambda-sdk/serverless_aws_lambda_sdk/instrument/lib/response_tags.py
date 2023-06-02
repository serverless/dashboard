from .sdk import serverlessSdk
from .api_events import is_api_event

aws_lambda_span = serverlessSdk.trace_spans.aws_lambda


def resolve(response):
    if not is_api_event():
        return

    status_code = response and response.get("statusCode")
    if status_code is None:
        aws_lambda_span.tags.set("aws.lambda.http.error_code", "MISSING_STATUS_CODE")
        return

    status_code = int(status_code)
    if status_code >= 100 and status_code < 600:
        aws_lambda_span.tags.set("aws.lambda.http.status_code", status_code)
    else:
        aws_lambda_span.tags.set("aws.lambda.http.error_code", "INVALID_STATUS_CODE")
