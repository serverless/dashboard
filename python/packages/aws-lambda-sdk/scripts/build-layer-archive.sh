#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s extglob globstar

BUILD_DIR=$1       # path to folder where build artifacts are found
OUTPUT=$2          # where to put the actual artifact
DIST=$(mktemp -d)  # directory to store intermediate artifacts
CURRENT_DIR=$(pwd)

mkdir -p $DIST/{python/lib/python3.9/site-packages,sls-sdk-python}

cp -R $BUILD_DIR/* $DIST/python/lib/python3.9/site-packages
cp $BUILD_DIR/serverless_aws_lambda_sdk/internal_extension/__init__.py $DIST/sls-sdk-python
cp $BUILD_DIR/serverless_aws_lambda_sdk/internal_extension/base.py $DIST/sls-sdk-python
cp $BUILD_DIR/serverless_aws_lambda_sdk/internal_extension/exec_wrapper.py $DIST/sls-sdk-python
cp $BUILD_DIR/typing_extensions.py $DIST/sls-sdk-python
cp -R $BUILD_DIR/strenum $DIST/sls-sdk-python

cd $DIST
zip -r $CURRENT_DIR/$OUTPUT python sls-sdk-python
cd $CURRENT_DIR

rm -rf $DIST
