#!/usr/bin/env bash
set -Eeuo pipefail

DIST=$(mktemp -d)  # directory to store intermediate artifacts
CURRENT_DIR=$(pwd)

case $1 in
  /*) OUTPUT=$1 ;;
  *) OUTPUT=$CURRENT_DIR/$1 ;;
esac

SITE_PACKAGES_DIR=python/lib/python3.9/site-packages
mkdir -p $DIST/{$SITE_PACKAGES_DIR,sls-sdk-python}


SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
INSTALL_DIR=$SCRIPT_DIR/../dist

cp $INSTALL_DIR/serverless_aws_lambda_sdk/internal_extension/__init__.py $DIST/sls-sdk-python
cp $INSTALL_DIR/serverless_aws_lambda_sdk/internal_extension/base.py $DIST/sls-sdk-python
cp $INSTALL_DIR/serverless_aws_lambda_sdk/internal_extension/exec_wrapper.py $DIST/sls-sdk-python
cp $INSTALL_DIR/typing_extensions.py $DIST/sls-sdk-python
cp -R $INSTALL_DIR/strenum $DIST/sls-sdk-python
cp -R $INSTALL_DIR/* $DIST/$SITE_PACKAGES_DIR

mkdir -p $(dirname $OUTPUT)


cd $DIST
zip -r $OUTPUT python sls-sdk-python
cd $CURRENT_DIR

rm -rf $DIST
