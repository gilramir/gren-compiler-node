#!/bin/bash
set -e
#
# This checks if if the Formatter.PrettyPrinter has any compilation problems.
# If so, it stops. If that module compiles, then it builds the entire Gren
# front-end to the compiler.
#
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
