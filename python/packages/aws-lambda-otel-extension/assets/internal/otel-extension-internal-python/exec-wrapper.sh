#!/bin/bash

# This file is a part of the Serverless Console Extension internal components and is meant to replace the deafult
# handler that is imported by the AWS Lambda bootstrap script with one that will automatically instrument the original
# handler code as well as supported libraries.

export ORIG_HANDLER=$_HANDLER
export _HANDLER="serverless_aws_lambda_otel_extension_wrapper_handler.wrapper_handler"

exec "$@"
