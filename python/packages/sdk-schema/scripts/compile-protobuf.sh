#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
SCHEMA_DIR=$SCRIPT_DIR/../serverless_sdk_schema/schema
mkdir -p $SCHEMA_DIR

PROTO_DIR=$SCRIPT_DIR/../../../../proto
cd $PROTO_DIR
echo "$(protoc --version)"
protoc --python_out=../python/packages/sdk-schema/serverless_sdk_schema/schema serverless/instrumentation/tags/v1/*.proto
protoc --python_out=../python/packages/sdk-schema/serverless_sdk_schema/schema serverless/instrumentation/v1/*.proto
find ../python/packages/sdk-schema/serverless_sdk_schema/schema -type d -exec touch {}/__init__.py \;
