#!/usr/bin/env bash
# Builds the soundtrack from the film's cues, the score and the placed voice: cue events from the scenes
# (render.mjs --events), effects, the music bed, the voice placed on the timeline, the mix and the -14 LUFS master,
# then the readability inspection. Output: sound/build/master.wav (and its analysis, sound/build/master.png).
set -euo pipefail
cd "$(dirname "$0")/.."
export CHROME_PATH=${CHROME_PATH:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
V=/root/.claude/skills/video-sound/scripts/sound.py
DUR=$(grep -o "duration:[[:space:]]*[0-9.]*" src/config.js | head -1 | grep -o "[0-9.]*$")
timeout 300 node render.mjs --events --no-slot 2>&1 | grep -v captions.check | tail -1
python3 -I -c "import json; c = json.load(open('out/cues.json')); c['key'] = 'D major'; json.dump(c, open('sound/cues.json', 'w'), indent=1)"
python3 -I scripts/place-voice.py
python3 -I $V sfx sound/cues.json -o sound/build/sfx.wav --score sound/score.json 2>&1 | tail -1
python3 -I $V score sound/score.json -o sound/build/music.wav --cues sound/cues.json 2>&1 | tail -1
python3 -I $V mix -o sound/build/mix.wav --music sound/build/music.wav --sfx sound/build/sfx.wav --voice sound/voice-placed.wav --cues sound/cues.json --duration "$DUR" 2>&1 | tail -1
python3 -I $V master sound/build/mix.wav -o sound/build/master.wav --lufs -14 2>&1 | tail -1
python3 -I $V analyze sound/build/master.wav --cues sound/cues.json --stem sound/build/sfx.wav --png sound/build/master.png 2>&1 | tail -6
