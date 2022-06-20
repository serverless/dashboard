#!/bin/bash

export ORIG_HANDLER=$_HANDLER
export _HANDLER="serverless_aws_lambda_otel_extension_wrapper_handler.auto_instrumenting_handler"
export EXEC_WRAPPER_START_UNIX_NANO=$(date +%s%N)

exec "$@"
