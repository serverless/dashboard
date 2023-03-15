#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
INSTALL_DIR=$SCRIPT_DIR/../dist
if [ ! -d "$INSTALL_DIR/serverless_aws_lambda_sdk" ]; then
  echo "Dependencies are not installed. Install dependencies in $INSTALL_DIR and rerun the script."
  exit 1
fi

CURRENT_DIR=$(pwd)

case $1 in
  /*) OUTPUT=$1 ;;
  *) OUTPUT=$CURRENT_DIR/$1 ;;
esac

if [ -f "$OUTPUT" ]
then
    rm $OUTPUT
fi

SITE_PACKAGES_DIR=python
DIST=$(mktemp -d)  # directory to store intermediate artifacts
mkdir -p $DIST/{$SITE_PACKAGES_DIR,sls-sdk-python}

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
