#!/bin/bash
set -e

COMPILER_DIR=$(realpath ../compiler)
export GREN_BIN="$COMPILER_DIR"/gren

function run_gren() {
    node "$COMPILER_DIR"/app "$@"
}

# Check if we can build this; if it fails,
# we get the actual error, unlinke building in 'compiler'
run_gren make Formatter.PrettyPrinter

# Now build for real
cd ../compiler
run_gren make Main
