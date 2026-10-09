#!/usr/bin/env bash
# Records the takes moved to the Mabou Highlands: R6 (frame-controlled), then R3 and R7+R8 (step capture).
cd "$(dirname "$0")/.."
./capture/run-batch.sh record-vt.mjs r6-export.mjs:r6-export.mp4 > capture/batch9.log 2>&1
./capture/run-batch.sh record-steps.mjs r3-terrain.mjs:r3-terrain.mp4 r78-field.mjs:r78-field.mp4:--phone >> capture/batch9.log 2>&1
echo "=== chain done" >> capture/batch9.log
