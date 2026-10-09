#!/usr/bin/env bash
# Records takes one after another: run-batch.sh <recorder> <scenario>:<out> [--phone] ...
set -u
rec="$1"; shift
for spec in "$@"; do
  scen="${spec%%:*}"; out="${spec#*:}"; flag=""
  case "$out" in *--phone) flag="--phone"; out="${out%:--phone}";; esac
  echo "=== $scen -> $out $flag"
  mkdir -p capture/logs
  timeout 2400 node "capture/$rec" "capture/scenarios/$scen" "footage/$out" $flag 2>&1 | tee "capture/logs/${out%.mp4}.log" | grep -v "^\s*at " | tail -6
done
echo "=== batch done"
