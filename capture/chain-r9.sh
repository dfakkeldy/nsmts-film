#!/usr/bin/env bash
# Waits for the running take batch to finish, then records R9.
cd "$(dirname "$0")/.."
while pgrep -f "run-batch.sh record-steps.mjs r78" >/dev/null; do sleep 5; done
./capture/run-batch.sh record-steps.mjs r9-poker.mjs:r9-poker.mp4:--phone > capture/batch8.log 2>&1
