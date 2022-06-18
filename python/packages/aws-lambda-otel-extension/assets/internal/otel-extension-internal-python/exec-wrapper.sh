#!/bin/bash

export ORIG_HANDLER=$_HANDLER
export _HANDLER="serverless_aws_lambda_otel_extension_internal.wrapper.auto_instrumenting_handler"

exec "$@"
