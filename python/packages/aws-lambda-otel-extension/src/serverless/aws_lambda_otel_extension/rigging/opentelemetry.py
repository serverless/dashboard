import logging
from typing import List, Optional, cast

from opentelemetry.distro import OpenTelemetryDistro
from opentelemetry.instrumentation.dependencies import get_dist_dependency_conflicts
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.aws import AwsXRayPropagator
from opentelemetry.sdk.extension.aws.resource import AwsLambdaResourceDetector
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ConcurrentMultiSpanProcessor, Span, Tracer, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import get_tracer, get_tracer_provider, set_tracer_provider
from pkg_resources import iter_entry_points

from serverless.aws_lambda_otel_extension.aws_lambda.instrumentation import SlsAwsLambdaInstrumentor
from serverless.aws_lambda_otel_extension.resource_detectors.extension import SlsExtensionResourceDetector
from serverless.aws_lambda_otel_extension.shared import settings
from serverless.aws_lambda_otel_extension.shared.constants import PACKAGE_VERSION
from serverless.aws_lambda_otel_extension.shared.store import store
from serverless.aws_lambda_otel_extension.span_attributes.extension import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.span_exporters.extension import SlsExtensionSpanExporter
from serverless.aws_lambda_otel_extension.span_exporters.logging import SlsLoggingSpanExporter
from opentelemetry.semconv.trace import SpanAttributes
import urllib.parse

logger = logging.getLogger(__name__)


def fixer_request_hook(span: Span, *args, **kwargs):
    pass


def fixer_response_hook(span: Span, *args, **kwargs):

    if span.instrumentation_scope.name == "opentelemetry.instrumentation.django":
        if not span.name:
            try:
                # TODO: Throw a massive amount of tests at this.
                if span.attributes:
                    http_url = span.attributes.get(SpanAttributes.HTTP_URL)
                    if isinstance(http_url, (str, bytes)):
                        span.update_name(urllib.parse.urlparse(http_url).path)
                    raise ValueError("Type of http url is not valid")
                else:
                    raise ValueError("No attributes found on span")
            except Exception:
                span.update_name(repr(span.name))


def setup_auto_instrumentor(tracer_provider: Optional[TracerProvider]) -> None:

    if store.is_cold_start:

        temporary_tracer_provider = cast(TracerProvider, TracerProvider())
        temporary_tracer = cast(Tracer, get_tracer(__name__, PACKAGE_VERSION, temporary_tracer_provider))

        try:
            with temporary_tracer.start_as_current_span(
                name="__instrumentor__",
                attributes={
                    SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "instrumentor",
                },
            ) as instrumentor_span:
                instrumentor_span = cast(Span, instrumentor_span)
                store.append_pre_instrumentation_span(instrumentor_span)
                try:
                    distro = OpenTelemetryDistro()

                    instrumented: List[str] = []
                    skipped: List[str] = []
                    failed: List[str] = []

                    for entry_point in iter_entry_points("opentelemetry_pre_instrument"):
                        entry_point.load()()

                    for entry_point in iter_entry_points("opentelemetry_instrumentor"):

                        if settings.otel_python_enabled_instrumentations:
                            if entry_point.name not in settings.otel_python_enabled_instrumentations:
                                skipped.append(entry_point.name)
                                continue

                        if settings.otel_python_disabled_instrumentations:
                            if entry_point.name in settings.otel_python_disabled_instrumentations:
                                skipped.append(entry_point.name)
                                continue

                        if entry_point.dist:
                            try:
                                conflict = get_dist_dependency_conflicts(entry_point.dist)
                                if conflict:
                                    skipped.append(entry_point.name)
                                    continue

                                distro.load_instrumentor(
                                    entry_point,
                                    skip_dep_check=True,
                                    tracer_provider=tracer_provider,
                                    request_hook=fixer_request_hook,
                                    response_hook=fixer_response_hook,
                                )
                                instrumented.append(entry_point.name)

                            except Exception as exc:
                                failed.append(entry_point.name)
                                logger.exception("Instrumenting of %s failed", entry_point.name)
                                instrumentor_span.record_exception(exc, escaped=True)
                                raise exc

                    for entry_point in iter_entry_points("opentelemetry_post_instrument"):
                        entry_point.load()()

                    if instrumentor_span.is_recording():
                        instrumentor_span.add_event(
                            "auto_instrumentor",
                            attributes={
                                "instrumented": instrumented,
                                "skipped": skipped,
                                "failed": failed,
                            },
                        )

                    # Do this last.  If anything explodes before this point we want to make sure that the handler is not
                    # wrapped and instrumented.
                    SlsAwsLambdaInstrumentor().instrument()

                except Exception:
                    logger.exception("Exception while executing instrumentor")
                    raise
        except Exception:
            logger.exception("Exception while starting instrumentor span")


def setup_tracer_provider() -> TracerProvider:

    # If this is a cold start then we should initialize the global tracer.  We currently don't attempt to provide a
    # customized and filtered span processor where we could work with an inherited tracer and add a span processor to
    # it.
    if store.is_cold_start:

        resource = get_aggregated_resources(
            detectors=[
                ProcessResourceDetector(),
                AwsLambdaResourceDetector(),
                SlsExtensionResourceDetector(),
                # This comes last because we want it to override `service.name` if it is present.
                OTELResourceDetector(),
            ]
        )

        tracer_provider = cast(
            TracerProvider,
            TracerProvider(
                id_generator=AwsXRayIdGenerator(),
                active_span_processor=ConcurrentMultiSpanProcessor(),
                resource=resource,
            ),
        )

        tracer_provider.add_span_processor(SimpleSpanProcessor(SlsExtensionSpanExporter()))

        # Extra information is logged to the console.
        tracer_provider.add_span_processor(
            SimpleSpanProcessor(SlsLoggingSpanExporter(pretty_print=settings.test_dry_log_pretty))
        )

        set_tracer_provider(tracer_provider)

        set_global_textmap(AwsXRayPropagator())

    else:
        tracer_provider = cast(TracerProvider, get_tracer_provider())

    return tracer_provider
