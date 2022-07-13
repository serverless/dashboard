from opentelemetry.sdk.trace import Span

from serverless.aws_lambda_otel_extension.shared.utilities import filter_dict_value_is_not_none


def request_hook(span: Span, *args, **kwargs):
    pass


def response_hook(span: Span, *args, **kwargs):

    try:
        from django.http import HttpRequest  # type: ignore
    except ImportError:
        return

    updates = {}

    response = args[0]

    if isinstance(response, HttpRequest) and not span.name:
        span.update_name(response.path)
        updates["name.old"] = span.name
        updates["name.new"] = response.path

    if updates:
        span.add_event(
            "extension_response_hook",
            attributes=filter_dict_value_is_not_none(
                {
                    **updates,
                }
            ),
        )
