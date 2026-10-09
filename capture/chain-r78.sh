#!/usr/bin/env bash
# Waits for the R3 take to finish, then records R7+R8 again (slower emulated walk).
cd "$(dirname "$0")/.."
until grep -q "batch done" capture/batch10.log 2>/dev/null; do sleep 5; done
./capture/run-batch.sh record-steps.mjs r78-field.mjs:r78-field.mp4:--phone > capture/batch11.log 2>&1
