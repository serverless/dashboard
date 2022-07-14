import logging
import os
from importlib import import_module
from typing import Any, Dict

from serverless.aws_lambda_otel_extension.initialize import sls_extension_initialize

logger = logging.getLogger(__name__)


def wrapper_handler(event: Dict, context: Any) -> Dict:

    sls_extension_initialize()

    handler_module_name, handler_function_name = os.getenv("ORIG_HANDLER", os.environ["_HANDLER"]).rsplit(".", 1)
    handler_module = import_module(handler_module_name)

    handler = getattr(handler_module, handler_function_name)

    return handler(event, context)
