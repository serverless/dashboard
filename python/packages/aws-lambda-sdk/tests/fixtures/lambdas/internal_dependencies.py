# This file is used to test that the customer can shadow modules
# by importing their own modules that has the same name.
# See /node/test/python/aws-lambda-sdk/integration.test.js
# to find out how these modules are injected.

import google.protobuf
import secrets
import typing
import contextvars


def handler(event, context) -> str:
    if set([google.protobuf.foo, secrets.foo, typing.foo, contextvars.foo]) != set(
        ["bar"]
    ):
        raise Exception("customer can not shadow modules")

    return "ok"
