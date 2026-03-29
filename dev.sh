#!/bin/bash

set -e
COMPILER_DIR=$(realpath ../compiler)
export GREN_BIN="$COMPILER_DIR"/gren

cd x
node "$COMPILER_DIR"/app format  > out
~/bin/gren-debug-view out > o

