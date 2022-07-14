import importlib
import logging
from contextlib import suppress
from typing import Any, List, Optional, cast

from opentelemetry.distro import OpenTelemetryDistro
from opentelemetry.instrumentation.dependencies import get_dist_dependency_conflicts
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.aws import AwsXRayPropagator
from opentelemetry.sdk.extension.aws.resource import AwsLambdaResourceDetector
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.sdk.resources import OTELResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import ConcurrentMultiSpanProcessor, Span, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import get_tracer, get_tracer_provider, set_tracer_provider
from pkg_resources import iter_entry_points

from serverless.aws_lambda_otel_extension.opentelemetry.instrumentation.aws_lambda import SlsAwsLambdaInstrumentor
from serverless.aws_lambda_otel_extension.opentelemetry.resource import SlsExtensionResourceDetector
from serverless.aws_lambda_otel_extension.opentelemetry.resource.process import ChrisGuidryProcessResourceDetector
from serverless.aws_lambda_otel_extension.opentelemetry.semconv.trace.extension import SlsExtensionSpanAttributes
from serverless.aws_lambda_otel_extension.opentelemetry.trace.export.extension import SlsExtensionSpanExporter
from serverless.aws_lambda_otel_extension.opentelemetry.trace.export.logging import SlsLoggingSpanExporter
from serverless.aws_lambda_otel_extension.shared.constants import (
    PACKAGE_NAMESPACE,
    PACKAGE_VERSION,
    REGRESSION_DO_NOT_INSTRUMENT,
    SLS_MARKER_DEBUG,
    SLS_MARKER_EXTENSION,
    SLS_MARKER_KEY,
)
from serverless.aws_lambda_otel_extension.shared.settings import (
    SETTINGS_SLS_EXTENSION_DISABLED_INSTRUMENTATIONS,
    SETTINGS_SLS_EXTENSION_ENABLED_INSTRUMENTATIONS,
    SETTINGS_SLS_EXTENSION_LOG_LEVEL,
    SETTINGS_SLS_EXTENSION_OVERRIDE,
)
from serverless.aws_lambda_otel_extension.shared.store import store

logger = logging.getLogger(__name__)

SLS_SPAN_TYPE = SlsExtensionSpanAttributes.SLS_SPAN_TYPE


def _auto_instrumentation_log_hook(span: Span, *args: Any, **kwargs: Any) -> None:

    module = None

    with suppress(Exception):
        module = importlib.import_module(
            f"serverless.aws_lambda_otel_extension.opentelemetry.extension.{span.instrumentation_scope.name}.hooks"
        )

    if module:
        log_hook = getattr(module, "log_hook", None)
        if callable(log_hook):
            log_hook(span, *args, **kwargs)


def _auto_instrumentation_request_hook(span: Span, *args: Any, **kwargs: Any) -> None:

    module = None

    with suppress(Exception):
        module = importlib.import_module(
            f"serverless.aws_lambda_otel_extension.opentelemetry.extension.{span.instrumentation_scope.name}.hooks"
        )

    if module:
        request_hook = getattr(module, "request_hook", None)
        if callable(request_hook):
            request_hook(span, *args, **kwargs)


def _auto_instrumentation_response_hook(span: Span, *args: Any, **kwargs: Any) -> None:

    module = None

    with suppress(Exception):
        module = importlib.import_module(
            f"serverless.aws_lambda_otel_extension.opentelemetry.extension.{span.instrumentation_scope.name}.hooks"
        )

    if module:
        response_hook = getattr(module, "response_hook", None)
        if callable(response_hook):
            response_hook(span, *args, **kwargs)


def setup_opentelemetry_instrumentation(
    tracer_provider: Optional[TracerProvider] = None,
    raise_on_exception: Optional[bool] = None,
) -> None:

    if tracer_provider is None:
        _tracer_provider = get_tracer_provider()
        if isinstance(_tracer_provider, TracerProvider):
            tracer_provider = _tracer_provider

    # We expect the set of execution IDs to be empty at this point - hence cold start.
    if tracer_provider is not None:

        temporary_tracer_provider = TracerProvider()
        temporary_tracer = get_tracer(__name__, PACKAGE_VERSION, temporary_tracer_provider)

        try:
            with temporary_tracer.start_as_current_span(
                name="__instrumentor__",
                attributes={
                    SLS_SPAN_TYPE: "instrumentor",
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

                        if entry_point.name in REGRESSION_DO_NOT_INSTRUMENT:
                            skipped.append(entry_point.name)
                            continue

                        if (
                            isinstance(SETTINGS_SLS_EXTENSION_ENABLED_INSTRUMENTATIONS, list)
                            and entry_point.name not in SETTINGS_SLS_EXTENSION_ENABLED_INSTRUMENTATIONS
                        ):
                            skipped.append(entry_point.name)
                            continue

                        if (
                            isinstance(SETTINGS_SLS_EXTENSION_DISABLED_INSTRUMENTATIONS, list)
                            and entry_point.name in SETTINGS_SLS_EXTENSION_DISABLED_INSTRUMENTATIONS
                        ):
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
                                    raise_on_exception=raise_on_exception,
                                    request_hook=_auto_instrumentation_request_hook,
                                    response_hook=_auto_instrumentation_response_hook,
                                    log_hook=_auto_instrumentation_log_hook,
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

                    logger.debug(
                        {
                            "auto_instrumentor": {
                                "instrumented": instrumented,
                                "skipped": skipped,
                                "failed": failed,
                            }
                        }
                    )

                    # Do this last.  If anything explodes before this point we want to make sure that the handler is not
                    # wrapped and instrumented.
                    SlsAwsLambdaInstrumentor().instrument(
                        skip_dep_check=True,
                        tracer_provider=tracer_provider,
                        raise_on_exception=raise_on_exception,
                        request_hook=_auto_instrumentation_request_hook,
                        response_hook=_auto_instrumentation_response_hook,
                        log_hook=_auto_instrumentation_log_hook,
                    )

                except Exception:
                    logger.exception("Exception while executing instrumentor")
                    raise
        except Exception:
            logger.exception("Exception while starting instrumentor span")


def setup_opentelemetry_tracer_provider(
    tracer_provider: Optional[TracerProvider] = None,
    raise_on_exception: Optional[bool] = None,
) -> None:

    if tracer_provider is None:
        resource = get_aggregated_resources(
            detectors=[
                ChrisGuidryProcessResourceDetector(),
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

        set_tracer_provider(tracer_provider)

        # Change the behaviour of the global textmap to propagate xray trace headers instead of the default.
        set_global_textmap(AwsXRayPropagator())

    span_processor_markers = []

    for span_processor in tracer_provider._active_span_processor._span_processors:
        span_processor_marker = getattr(span_processor, SLS_MARKER_KEY, None)
        if span_processor_marker:
            span_processor_markers.append(span_processor_marker)

    if SLS_MARKER_EXTENSION not in span_processor_markers:
        sls_extension_span_processor = SimpleSpanProcessor(SlsExtensionSpanExporter())
        setattr(sls_extension_span_processor, SLS_MARKER_KEY, SLS_MARKER_EXTENSION)
        tracer_provider.add_span_processor(sls_extension_span_processor)

    # If we have debugging enabled then this span processor will be used to dump the spans to stdout.
    if SLS_MARKER_DEBUG not in span_processor_markers:
        sls_debug_span_processor = SimpleSpanProcessor(SlsLoggingSpanExporter())
        setattr(sls_debug_span_processor, SLS_MARKER_KEY, SLS_MARKER_DEBUG)
        tracer_provider.add_span_processor(sls_debug_span_processor)


def sls_extension_initialize(
    org_id: Optional[str] = None,
    namespace: Optional[str] = None,
    environment: Optional[str] = None,
    tracer_provider: Optional[TracerProvider] = None,
    raise_on_exception: Optional[bool] = None,
):

    is_cold_start = store.is_cold_start_for_optional_execution_id()

    if is_cold_start:
        logging.getLogger(PACKAGE_NAMESPACE).setLevel(SETTINGS_SLS_EXTENSION_LOG_LEVEL)

        if org_id is not None:
            SETTINGS_SLS_EXTENSION_OVERRIDE["orgId"] = org_id

        if namespace is not None:
            SETTINGS_SLS_EXTENSION_OVERRIDE["namespace"] = namespace

        if environment is not None:
            SETTINGS_SLS_EXTENSION_OVERRIDE["environment"] = environment

        setup_opentelemetry_tracer_provider(tracer_provider=tracer_provider, raise_on_exception=raise_on_exception)
        setup_opentelemetry_instrumentation(tracer_provider=tracer_provider, raise_on_exception=raise_on_exception)
