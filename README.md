# NS Marks the Spot: portfolio film

A 101-second film (1920 × 1080, 30 fps) about [NS Marks the Spot](https://github.com/dfakkeldy/ns-marks-the-spot), a
web and iOS app for overlaying historical Nova Scotia maps on modern ones. The film shows where Nova Scotia's GIS data
lives, how a scanned 1884 survey sheet is georeferenced, and how the map is taken into the field on a phone.

Every frame is drawn by code. Plain JavaScript scenes render in headless Chrome, frame by frame, and screen recordings
of the real app are laid into them. ffmpeg then encodes the frames with a mastered soundtrack and checks the result.
Captions are burned in, so it works muted.

## What's here

| Path | What it is |
|---|---|
| `src/` | The film: scene code, the shot manifest and the drawing helpers |
| `looks/` | Reusable visual styles (editorial, kinetic type, diagram, riso, terminal and more), each with notes |
| `render.mjs` | Frame-by-frame renderer: any size and fps, sub-frame motion blur, resumable, a determinism check |
| `deliver.sh` | Encodes the film and checks length, frame count, colour tags, loudness and black or frozen frames |
| `brief/` | The brief, beat sheet, narration drafts, credits ledger and production notes |
| `footage/` | The recorded app takes |
| `sound/` | The finished soundtrack (`master.flac`, -14 LUFS) |

## Rebuild it

[REBUILD.md](REBUILD.md) has the full steps. You need Node 18+, Google Chrome, ffmpeg and about 3 GB of disk:

```bash
npm ci
./scripts/prep-footage.sh
node render.mjs --frames --workers=4 --subframes=4 --shutter=0.5
./scripts/render-turns.sh
./deliver.sh nsmts-portfolio --audio=sound/master.flac --poster=2.0
```

## Credits and licences

Code is MIT ([LICENSE](LICENSE)). The renderer is based on
[ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) by John Heibel (MIT). Fonts are under the SIL
Open Font License 1.1. [NOTICE](NOTICE) and `brief/credits-ledger.md` list every source, including the historical map
scans and their licences.
