import logging
import os
from importlib import import_module
from typing import Any, Dict, List, cast

from opentelemetry.distro import OpenTelemetryDistro
from opentelemetry.instrumentation.dependencies import get_dist_dependency_conflicts
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.aws import AwsXRayPropagator
from opentelemetry.sdk.extension.aws.resource import AwsLambdaResourceDetector
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.sdk.resources import OTELResourceDetector, ProcessResourceDetector, get_aggregated_resources
from opentelemetry.sdk.trace import Span, Tracer, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import get_current_span, get_tracer, get_tracer_provider, set_tracer_provider
from pkg_resources import iter_entry_points

from serverless.aws_lambda_otel_extension.aws_lambda.instrumentation import SlsAwsLambdaInstrumentor
from serverless.aws_lambda_otel_extension.resource_detectors.extension import SlsExtensionResourceDetector
from serverless.aws_lambda_otel_extension.shared import settings
from serverless.aws_lambda_otel_extension.shared.constants import PACKAGE_NAMESPACE, PACKAGE_VERSION
from serverless.aws_lambda_otel_extension.shared.store import store
from serverless.aws_lambda_otel_extension.span_exporters.extension import SlsExtensionSpanExporter
from serverless.aws_lambda_otel_extension.span_exporters.logging import SlsLoggingSpanExporter

logger = logging.getLogger(__name__)


def instrumentor_hook() -> None:

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
                logger.debug({"skipping": entry_point.name, "reason": "not enabled"})
                continue

        if settings.otel_python_disabled_instrumentations:
            if entry_point.name in settings.otel_python_disabled_instrumentations:
                skipped.append(entry_point.name)
                logger.debug({"skipping": entry_point.name, "reason": "disabled"})
                continue

        if entry_point.dist:
            try:
                conflict = get_dist_dependency_conflicts(entry_point.dist)
                if conflict:
                    skipped.append(entry_point.name)
                    logger.debug({"skipping": entry_point.name, "conflict": conflict})
                    continue

                distro.load_instrumentor(entry_point, skip_dep_check=True)
                instrumented.append(entry_point.name)
                logger.debug({"instrumented": entry_point.name})

            except Exception as exc:
                failed.append(entry_point.name)
                logger.exception("Instrumenting of %s failed", entry_point.name)
                raise exc

    for entry_point in iter_entry_points("opentelemetry_post_instrument"):
        entry_point.load()()

    current_span = get_current_span()

    if isinstance(current_span, Span):
        current_span.add_event(
            "auto_instrumentor",
            attributes={
                "instrumented": instrumented,
                "skipped": skipped,
                "failed": failed,
            },
        )


def auto_instrumenting_handler(event: Dict, context: Any) -> Dict:

    # Set logging level for the entire package namespace.
    logging.getLogger(PACKAGE_NAMESPACE).setLevel(settings.sls_aws_lambda_otel_extension_log_level)

    execution_id = getattr(context, "aws_request_id", None)

    store.add_execution_id(execution_id)

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

        tracer_provider = cast(TracerProvider, TracerProvider(id_generator=AwsXRayIdGenerator(), resource=resource))

        tracer_provider.add_span_processor(SimpleSpanProcessor(SlsExtensionSpanExporter()))

        # Extra information is logged to the console.
        tracer_provider.add_span_processor(
            SimpleSpanProcessor(SlsLoggingSpanExporter(pretty_print=settings.test_dry_log_pretty))
        )

        set_global_textmap(AwsXRayPropagator())

    else:
        tracer_provider = cast(TracerProvider, get_tracer_provider())

    set_tracer_provider(tracer_provider)

    temporary_tracer_provider = cast(TracerProvider, TracerProvider())
    temporary_tracer = cast(Tracer, get_tracer(__name__, PACKAGE_VERSION, temporary_tracer_provider))

    if store.is_cold_start:
        try:
            with temporary_tracer.start_as_current_span(name="instrumentor") as instrumentor_span:
                instrumentor_span = cast(Span, instrumentor_span)
                store.append_pre_instrumentation_span(instrumentor_span)
                try:
                    instrumentor_hook()
                except Exception:
                    logger.exception("Exception while executing instrumentor")
                    raise
        except Exception:
            logger.exception("Exception while starting instrumentor span")

    SlsAwsLambdaInstrumentor().instrument()

    handler_module_name, handler_function_name = os.getenv("ORIG_HANDLER", os.environ["_HANDLER"]).rsplit(".", 1)
    handler_module = import_module(handler_module_name)

    handler = getattr(handler_module, handler_function_name)

    return handler(event, context)
