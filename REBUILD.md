# Rebuilding the film

These steps make `out/nsmts-portfolio.mp4` (101.3 s, 1920 x 1080, 30 fps), plus its share, phone and poster copies,
from this repository on your own computer.

## You need

- Node 18 or later, with npm
- Google Chrome. On a Mac it is found at `/Applications/Google Chrome.app`. Elsewhere, set `CHROME_PATH` to the Chrome
  binary.
- ffmpeg, with ffprobe (on a Mac: `brew install ffmpeg`)
- python3
- About 3 GB of free disk: the takes' frames and the film's frames take about 1.3 GB each.

## Steps

```bash
git clone https://github.com/dfakkeldy/nsmts-film.git
cd nsmts-film
npm ci
./scripts/prep-footage.sh
node render.mjs --frames --workers=4 --subframes=4 --shutter=0.5
./scripts/render-turns.sh
./deliver.sh nsmts-portfolio --audio=sound/master.flac --poster=2.0
```

What each step does:

1. `npm ci` installs the one dependency (puppeteer-core, which drives Chrome).
2. `prep-footage.sh` unpacks the recorded takes (`footage/*.mp4`) into frames under `footage/frames/`.
3. `render.mjs --frames` draws every frame of the film into `out/frames/`. This is the long step. Raise `--workers` on
   a machine with more cores. If it stops, run the same command again: it picks up where it left off.
4. `render-turns.sh` renders the seven page turns again with more motion blur. Run it after step 3. It clears the
   render's settings stamp, so to re-run step 3 later, delete `out/frames/frames.json` first.
5. `deliver.sh` encodes the frames with the soundtrack and checks the result: length, frame count, colour tags,
   loudness after AAC, and no black or frozen stretches. It then writes the share, phone and poster copies. Every
   check should print `ok`.

Everything lands in `out/`, which git ignores.

## The soundtrack

`sound/master.flac` is the finished mix: 24-bit, 48 kHz, mastered to -14 LUFS. Building it again from its parts
(`scripts/build-sound.sh`) needs the narration recordings, which are kept out of git (`sound/elevenlabs/`), and the
video-sound skill. Neither is needed to rebuild the film.

## Not in git

- `out/`: renders and deliveries
- `footage/frames/`: made by `prep-footage.sh`
- `sound/elevenlabs/` and `sound/build/*.wav`: the narration recordings and the soundtrack's working files
