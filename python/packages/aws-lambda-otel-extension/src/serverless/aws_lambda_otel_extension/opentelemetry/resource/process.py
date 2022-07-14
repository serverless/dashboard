# Yanked from:
# https://github.com/chrisguidry/opentelemetry-resourcedetector-process/blob/main/src/opentelemetry_resourcedetector_process/__init__.py
# while the owner works on migrating this code back to Python 3.6 (MIT)
# https://github.com/chrisguidry/opentelemetry-resourcedetector-process/blob/main/LICENSE

import sys

from opentelemetry.sdk.resources import Attributes, Resource, ResourceDetector
from opentelemetry.semconv.resource import ResourceAttributes
from psutil import Process

from serverless.aws_lambda_otel_extension.shared.utilities import filter_dict_value_is_not_none

PROCESS_RUNTIME_NAME = ResourceAttributes.PROCESS_RUNTIME_NAME
PROCESS_RUNTIME_VERSION = ResourceAttributes.PROCESS_RUNTIME_VERSION
PROCESS_RUNTIME_DESCRIPTION = ResourceAttributes.PROCESS_RUNTIME_DESCRIPTION
PROCESS_PID = ResourceAttributes.PROCESS_PID
PROCESS_EXECUTABLE_NAME = ResourceAttributes.PROCESS_EXECUTABLE_NAME
PROCESS_EXECUTABLE_PATH = ResourceAttributes.PROCESS_EXECUTABLE_PATH
PROCESS_COMMAND_LINE = ResourceAttributes.PROCESS_COMMAND_LINE
PROCESS_COMMAND = ResourceAttributes.PROCESS_COMMAND
PROCESS_COMMAND_ARGS = ResourceAttributes.PROCESS_COMMAND_ARGS
PROCESS_OWNER = ResourceAttributes.PROCESS_OWNER


class ChrisGuidryProcessResourceDetector(ResourceDetector):
    """Detects OpenTelemetry Resource attributes for an operating system process, providing the `process.*`
    attributes"""

    def detect(self) -> Resource:
        python_version = sys.implementation.version
        python_version_string = ".".join(
            map(
                str,
                python_version[:3]
                if python_version.releaselevel == "final" and not python_version.serial
                else python_version,
            )
        )

        process = Process()
        with process.oneshot():
            command_line = process.cmdline()
            command, *arguments = command_line
            attributes: Attributes = filter_dict_value_is_not_none(
                {
                    # https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/resource/semantic_conventions/process.md#python-runtimes
                    PROCESS_RUNTIME_NAME: sys.implementation.name,
                    PROCESS_RUNTIME_VERSION: python_version_string,
                    PROCESS_RUNTIME_DESCRIPTION: sys.version,
                    # https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/resource/semantic_conventions/process.md#process
                    PROCESS_PID: process.pid,
                    PROCESS_EXECUTABLE_NAME: process.name(),
                    PROCESS_EXECUTABLE_PATH: process.exe(),
                    PROCESS_COMMAND_LINE: " ".join(command_line),
                    PROCESS_COMMAND: command,
                    PROCESS_COMMAND_ARGS: " ".join(arguments),
                    PROCESS_OWNER: process.username(),
                }
            )

        return Resource(attributes)
