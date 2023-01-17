#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s extglob globstar

export PROTO_PATH="../../../proto"
export PROTOS=( "$PROTO_PATH"/**/*.proto )
export LIB='sdk_schema/schema'

mkdir -p "$LIB"

python -m grpc_tools.protoc -I "$PROTO_PATH" --python_betterproto_out="$LIB" "${PROTOS[@]}"
