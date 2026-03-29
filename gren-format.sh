#!/bin/bash
set -e

THIS_DIR=$(realpath $(dirname $0))

COMPILER_DIR=$(realpath "${THIS_DIR}"/../compiler)
export GREN_BIN="$COMPILER_DIR"/gren

function run_gren() {
    node "$COMPILER_DIR"/app "$@"
}

# Check if we can build this; if it fails,
# we get the actual error, unlinke building in 'compiler'
run_gren format

