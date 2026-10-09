#!/usr/bin/env bash
# Re-renders the page turns (the fast slides) at 12 sub-frames, over a full render at 4 (render.mjs --frames
# --subframes=4): deletes those frames and the render stamp, then renders each stretch again. Run after the full render.
set -euo pipefail
cd "$(dirname "$0")/.."
TURNS="10.45 13.35 30.55 39.55 45.75 66.75 88.95"   # src/scenes/film.js SLIDES, each 0.6 s
for s in $TURNS; do
  a=$(python3 -c "print(int($s * 30))"); b=$(python3 -c "import math; print(math.ceil(($s + .6) * 30))")
  for i in $(seq $a $b); do rm -f "out/frames/f$(printf %05d $i).jpg"; done
done
rm -f out/frames/frames.json
for s in $TURNS; do   # the range is given in whole frames, the same ones deleted above
  r=$(python3 -c "import math; a = int($s * 30); b = math.ceil(($s + .6) * 30); print(f'{a / 30:.5f}:{(b + 1) / 30:.5f}')")
  node render.mjs --frames --workers=3 --subframes=12 --shutter=0.4 --range=$r
done
echo "turns re-rendered"
