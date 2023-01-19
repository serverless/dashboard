from __future__ import annotations

import logging
import platform
from os import environ
from typing import Dict, Optional

from serverless_sdk.span.tags import Tags
from serverless_sdk.span.trace import TraceSpan
from typing_extensions import Final

from ..base import Arch, Env, NAME, Name, Tag, __version__
from ..internal_extension.base import START


NOT_SET: Final[str] = ""
SET_ON_REQUEST: Final[str] = NOT_SET

TAGS: Final[Tags] = Tags()
_TAGS: Final[Dict[str, str]] = {
    Tag.org_id: environ.get(Env.SLS_ORG_ID),
    Tag.service: environ.get(Env.AWS_LAMBDA_FUNCTION_NAME),
    Tag.sdk_name: NAME,
    Tag.sdk_version: __version__,
}
TAGS.update(_TAGS)

INIT: Final[Optional[str]] = environ.get(Env.AWS_LAMBDA_INITIALIZATION_TYPE)

if INIT == "on-demand":
    TAGS.update({Tag.is_coldstart: True})

else:
    TAGS.update({Tag.is_coldstart: False})


def get_arch() -> Optional[str]:
    arch = platform.machine()

    if arch == "AMD64" or arch == "x86_64":
        return Arch.x64

    elif "arm" in arch.casefold():
        return Arch.arm

    logging.error(f"Serverless SDK Warning: Unrecognized architecture: {arch}")
    return None


ARCH: Final[str] = get_arch()

if ARCH:
    TAGS.update({Tag.arch: ARCH})

TAGS[Tag.name] = environ.get(Env.AWS_LAMBDA_FUNCTION_NAME)
TAGS[Tag.version] = environ.get(Env.AWS_LAMBDA_FUNCTION_VERSION)


def get_tags() -> Tags:
    tags = Tags()
    tags.update(TAGS)

    return tags


aws_lambda_span: Final[TraceSpan] = TraceSpan(
    name=Name.aws_lambda,
    start_time=START,
    tags=get_tags(),
)

aws_lambda_initialization: Final[TraceSpan] = TraceSpan(
    name=Name.aws_lambda_initialization,
    start_time=START,
    tags=get_tags(),
)

aws_lambda_invocation: Final[TraceSpan] = TraceSpan(
    name=Name.aws_lambda_invocation,
    start_time=START,
    tags=get_tags(),
)
