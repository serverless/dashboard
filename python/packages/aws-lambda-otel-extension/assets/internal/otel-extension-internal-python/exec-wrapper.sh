#!/bin/bash

export ORIG_HANDLER=$_HANDLER
export _HANDLER="serverless.aws_lambda_otel_extension.internal.wrapper.auto_instrumenting_handler"

exec "$@"
