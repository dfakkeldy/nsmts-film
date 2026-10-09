#!/usr/bin/env bash
# Stops any running take batch, recorder and headless browsers, and removes their partial frame folders.
# Kept in a file so the patterns never appear on the command line of the shell that runs it.
for pid in $(ps -eo pid=,args= | awk '/run-batch\.sh|record-vt\.mjs|record-steps\.mjs|record\.mjs/ && !/kill-takes/ {print $1}'); do
  [ "$pid" != "$$" ] && kill "$pid" 2>/dev/null
done
sleep 2
for pid in $(ps -eo pid=,comm= | awk '$2 ~ /headless_shell|chrome/ {print $1}'); do kill "$pid" 2>/dev/null; done
rm -rf "$(dirname "$0")"/../footage/.vt-* "$(dirname "$0")"/../footage/.steps-* "$(dirname "$0")"/../footage/.frames-*
echo "stopped"
