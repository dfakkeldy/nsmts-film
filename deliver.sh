#!/usr/bin/env bash
# deliver.sh: encode the rendered frames into the finished files and check them.
#
#   ./deliver.sh <name> --audio=sound/master.wav [--poster=3.2] [--loop]
#   ./deliver.sh <name> --silent [--poster=3.2] [--loop]
#
# Encodes out/frames (render.mjs --frames) into out/<name>.mp4 with the mastered soundtrack, then checks it: duration
# against PROJECT.duration (to a frame), frame count, BT.709 tags, an audio stream (unless --silent) and its loudness and
# true peak after the AAC encode (video-sound's analyze), black frames and frozen stretches. A hard failure stops.
# Then writes out/<name>-share.mp4 (about 7 Mbit/s), out/<name>-phone.mp4 (under 28 MB) and out/<name>-poster.jpg
# (from --poster seconds, default a third of the way in; frame 0 of a loop is often empty). --loop also writes a muted
# H.264 loop, a VP9 WebM, and checks the last frame against the first.
set -euo pipefail
NAME="${1:?usage: deliver.sh <name> --audio=<wav> | --silent [--poster=s] [--loop]}"; shift
AUDIO=""; SILENT=""; POSTER=""; LOOP=""
for a in "$@"; do case "$a" in --audio=*) AUDIO="${a#--audio=}" ;; --silent) SILENT=1 ;; --poster=*) POSTER="${a#--poster=}" ;; --loop) LOOP=1 ;; *) echo "!! unknown option $a"; exit 1 ;; esac; done
[ -n "$AUDIO" ] || [ -n "$SILENT" ] || { echo "!! pass --audio=<mastered wav> or --silent"; exit 1; }
SOUND="$HOME/.claude/skills/video-sound/scripts/sound.py"
PY="$(command -v python3)"
OUT="out/$NAME.mp4"
if [ -n "$SILENT" ]; then node render.mjs --encode --no-audio --out="$OUT"; else node render.mjs --encode --audio="$AUDIO" --out="$OUT"; fi

# ---------- checks ----------
FAIL=0
WANT=$(grep -o "duration:[[:space:]]*[0-9.]*" src/config.js | head -1 | grep -o "[0-9.]*$")
FPS=$(grep -o "fps:[[:space:]]*[0-9.]*" src/config.js | head -1 | grep -o "[0-9.]*$")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
NF=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$OUT")
CSP=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_space -of csv=p=0 "$OUT")
"$PY" - "$DUR" "$WANT" "$FPS" "$NF" <<'EOF' || FAIL=1
import sys
d, want, fps, nf = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4])
ok = abs(d - want) <= 1.5 / fps and abs(nf - round(want * fps)) <= 1
print(f"{'ok  ' if ok else 'FAIL'} picture: {d:.3f} s, {nf} frames (want {want} s = {round(want * fps)} frames at {fps:g} fps)")
sys.exit(0 if ok else 1)
EOF
[ "$CSP" = "bt709" ] && echo "ok   colour: BT.709 tagged" || echo "warn colour: not tagged BT.709 ($CSP)"
if [ -z "$SILENT" ]; then
  if [ -z "$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$OUT")" ]; then echo "FAIL audio: no audio stream"; FAIL=1
  else
    ffmpeg -v error -y -i "$OUT" -vn -ac 2 -ar 48000 out/.delivered.wav
    if [ -f "$SOUND" ]; then "$PY" -I "$SOUND" analyze out/.delivered.wav || true
    else ffmpeg -hide_banner -i out/.delivered.wav -af ebur128=peak=true -f null - 2>&1 | grep -E " I:| Peak:" | tail -2; fi
    "$PY" - "$OUT" <<'EOF' || FAIL=1
import subprocess, sys, re
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', 'out/.delivered.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
i = float(re.findall(r'I:\s*(-?[\d.]+) LUFS', r)[-1]); p = float(re.findall(r'Peak:\s*(-?[\d.]+) dBFS', r)[-1])
ok = -18.5 <= i <= -12.5 and p <= -0.9
print(f"{'ok  ' if ok else 'FAIL'} sound after AAC: {i:.1f} LUFS integrated, true peak {p:.1f} dBTP (want -14 for feeds or -16 for web, peak at most -1)")
sys.exit(0 if ok else 1)
EOF
    rm -f out/.delivered.wav
  fi
fi
BLACK=$(ffmpeg -hide_banner -i "$OUT" -vf "blackdetect=d=0.1:pix_th=0.05" -an -f null - 2>&1 | grep -c black_start || true)
FROZEN=$(ffmpeg -hide_banner -i "$OUT" -vf "freezedetect=n=0.001:d=1.5" -an -f null - 2>&1 | grep -o "freeze_start: [0-9.]*" || true)
[ "$BLACK" = "0" ] && echo "ok   no black stretches" || echo "warn $BLACK black stretch(es) over 0.1 s: designed? (blackdetect)"
[ -z "$FROZEN" ] && echo "ok   nothing frozen for 1.5 s" || echo "warn frozen stretches start at: $(echo $FROZEN | tr '\n' ' ') (designed holds should still breathe)"
if [ -n "$LOOP" ]; then
  ffmpeg -v error -y -i "$OUT" -frames:v 1 out/.first.png
  ffmpeg -v error -y -sseof -0.05 -i "$OUT" -frames:v 1 -update 1 out/.last.png
  SSIM=$(ffmpeg -hide_banner -i out/.first.png -i out/.last.png -lavfi ssim -f null - 2>&1 | grep -o "All:[0-9.]*" | cut -d: -f2)
  "$PY" -c "s=float('${SSIM:-0}'); print(('ok  ' if s>.97 else 'warn'), f'loop seam: last frame vs first SSIM {s:.3f} (a seamless loop is above about .97; the last frame should be one step before the first)')"
  rm -f out/.first.png out/.last.png
fi
[ "$FAIL" = 0 ] || { echo "!! delivery stopped: $OUT failed a check (above)"; exit 1; }

# ---------- copies ----------
AFLAGS=(-c:a copy); [ -n "$SILENT" ] && AFLAGS=(-an)
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_videotoolbox; then
  ffmpeg -hide_banner -loglevel error -y -i "$OUT" -c:v h264_videotoolbox -b:v 7M -maxrate 10M -bufsize 14M -pix_fmt yuv420p "${AFLAGS[@]}" -movflags +faststart "out/$NAME-share.mp4"
else
  ffmpeg -hide_banner -loglevel error -y -i "$OUT" -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p "${AFLAGS[@]}" -movflags +faststart "out/$NAME-share.mp4"
fi
VB=$("$PY" -c "print(max(300, min(6000, int(26e6 * 8 / 1000 / float('$DUR') - 128 - 32))))")   # under 28 MB, at most 6 Mbit/s
SHORT=$("$PY" -c "w,h=$(grep -o 'width:[[:space:]]*[0-9]*' src/config.js | head -1 | grep -o '[0-9]*$'),$(grep -o 'height:[[:space:]]*[0-9]*' src/config.js | head -1 | grep -o '[0-9]*$'); print('scale=1280:-2' if w>=h else 'scale=-2:1280')")
ffmpeg -hide_banner -loglevel error -y -i "$OUT" -vf "$SHORT:flags=lanczos" -c:v libx264 -preset faster -b:v ${VB}k -maxrate ${VB}k -bufsize $((VB * 2))k -pix_fmt yuv420p $([ -n "$SILENT" ] && echo -an || echo -c:a aac -b:a 128k) -movflags +faststart "out/$NAME-phone.mp4"
T=${POSTER:-$("$PY" -c "print(round(float('$DUR')/3, 2))")}
ffmpeg -v error -y -ss "$T" -i "$OUT" -frames:v 1 -q:v 2 "out/$NAME-poster.jpg"
if [ -n "$LOOP" ]; then
  ffmpeg -hide_banner -loglevel error -y -i "$OUT" -an -c:v libx264 -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart "out/$NAME-loop-muted.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT" -an -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 "out/$NAME-loop.webm"
fi
ls -lh out/"$NAME"*.mp4 out/"$NAME"*.webm out/"$NAME"-poster.jpg 2>/dev/null
echo "Delivered. Now the human watches it, on the device it's for."
