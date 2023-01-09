#!/usr/bin/env bash
export PROTO_PATH="../../../proto/serverless/instrumentation"
export LIB='serverless_sdk_schema'
export PROTOS=(
  'v1/trace.proto'
  'v1/request_response.proto'
)

python -m grpc_tools.protoc -I "$PROTO_PATH" --python_betterproto_out="$LIB" "${PROTOS[@]}"
