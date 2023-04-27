#!/bin/bash

# Ensure our --require first in the list of pre-required modules
export NODE_OPTIONS="--require /opt/sls-sdk-node ${NODE_OPTIONS}"

exec "$@"
