import logging
from typing import List, cast

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

logger = logging.getLogger(__name__)


def setup_auto_instrumentor() -> None:

    temporary_tracer_provider = cast(TracerProvider, TracerProvider())
    temporary_tracer = cast(Tracer, get_tracer(__name__, PACKAGE_VERSION, temporary_tracer_provider))

    if store.is_cold_start:
        try:
            with temporary_tracer.start_as_current_span(
                name="__instrumentor__",
                attributes={
                    SlsExtensionSpanAttributes.SLS_SPAN_TYPE: "instrumentor",
                },
            ) as current_span:
                current_span = cast(Span, current_span)
                store.append_pre_instrumentation_span(current_span)
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

                                distro.load_instrumentor(entry_point, skip_dep_check=True)
                                instrumented.append(entry_point.name)

                            except Exception as exc:
                                failed.append(entry_point.name)
                                logger.exception("Instrumenting of %s failed", entry_point.name)
                                current_span.record_exception(exc, escaped=True)
                                raise exc

                    for entry_point in iter_entry_points("opentelemetry_post_instrument"):
                        entry_point.load()()

                    if current_span.is_recording():
                        current_span.add_event(
                            "auto_instrumentor",
                            attributes={
                                "instrumented": instrumented,
                                "skipped": skipped,
                                "failed": failed,
                            },
                        )

                    SlsAwsLambdaInstrumentor().instrument()

                except Exception:
                    logger.exception("Exception while executing instrumentor")
                    raise
        except Exception:
            logger.exception("Exception while starting instrumentor span")


def setup_tracer_provider() -> None:

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

        set_global_textmap(AwsXRayPropagator())

    else:
        tracer_provider = cast(TracerProvider, get_tracer_provider())

    set_tracer_provider(tracer_provider)
