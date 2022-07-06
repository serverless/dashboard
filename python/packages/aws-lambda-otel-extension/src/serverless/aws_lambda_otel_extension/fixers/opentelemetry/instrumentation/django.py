import logging

from opentelemetry.sdk.trace import Span

logger = logging.getLogger(__name__)


def fixer_request_hook(span: Span, *args, **kwargs):
    pass


def fixer_response_hook(span: Span, *args, **kwargs):

    response = args[0]
    try:
        from django.http import HttpRequest  # type: ignore
    except ImportError:
        return

    if isinstance(response, HttpRequest):
        if not span.name:
            span.update_name(response.path)
