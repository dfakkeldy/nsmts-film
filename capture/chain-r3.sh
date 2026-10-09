#!/usr/bin/env bash
# Waits for the highlands batch to finish, then records R3 again (zoom 14, turning west).
cd "$(dirname "$0")/.."
until grep -q "chain done" capture/batch9.log; do sleep 5; done
./capture/run-batch.sh record-steps.mjs r3-terrain.mjs:r3-terrain.mp4 > capture/batch10.log 2>&1
