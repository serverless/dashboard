#!/bin/bash

export NODE_OPTIONS="${NODE_OPTIONS} --require /opt/sls-sdk-node"

exec "$@"
