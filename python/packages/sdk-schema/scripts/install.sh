#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s expand_aliases

alias poe='python3 -m poethepoet'
alias pip='python3 -m pip'

pip install --upgrade poethepoet pip
poe build
pip install .
