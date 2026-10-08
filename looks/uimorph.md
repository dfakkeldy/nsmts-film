# One-take UI morph (`uimorph`)

One interface element, never cut: a black pill becomes a loader, a check, an island, a player, a slider, tabs, a chart,
a command palette and a toast, and ends where it began. A cursor drives every change, the camera zooms so each state
fills the frame, and something happens on every beat.

- **Built:** yes. Module `looks/uimorph.js`, specimen `specimens/uimorph` (1440 x 1440, 60 fps, 8 s, 4 bars at 120 BPM,
  a seamless loop). Measured on an M1 Pro: about 0.12 s a frame with 4 sub-frames of motion blur.
- **Best for:** app and SaaS launch films, feature teasers, README hero loops, landing-page loops, an ident for a
  product whose core action is one gesture. 8-20 s; square or 4:5 for feeds, 16:9 for a site.
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: M (design the state list; each state is a small draw
  function). Layer-order risk: low (one body, content clipped inside it).
- **Atlas:** look 23, "One-take UI morph" (7 videos, average 6.9, top 8). Best example:
  [twoclipping-5cba86](https://prompt-motion.com/twoclipping-5cba86); its creator published the brief in the post.

## What it is, and isn't

It is one object with continuous identity. Cuts, a second hero object, a wall of screenshots or a device frame break
it. Real product UI is welcome as content inside a state (a screenshot clipped into the body), never as the body.

## Materials and palette

A light warm-grey canvas (`#ECEAE5`), black and white components, one accent at most. One UI font: Space Grotesk ships
with the engine; set `P.uimorph.font` for another OFL face you add. One icon stroke weight everywhere
(`UIM.S.stroke`). Banned: glows, gradients on UI chrome, particle bursts, bouncy easing on chrome, mismatched icon
strokes, corner HUD text.

## Motion grammar

- The body's width, height and corner radius ride one spring (`snappy` by default) toward each state. The value is a
  sum of springs, one per change (kit.js `follow`), so a new state can arrive mid-move without a jerk.
- Content swaps with its own exit and entrance (`swap()` in draw.js: blur out, lift, blur in), never a crossfade of two
  legible layers.
- Fills change colour over .28 s after the state starts.
- Two-edge springs for anything that slides (tab indicator, toggle knob, a progress fill): the leading edge on a
  quicker spring than the trailing one, so it stretches (kit.js `edges`).
- Drags are direct manipulation: while held, the value is computed from the cursor; past a limit it resists
  (`rubber`); on release it springs back from wherever it was (`drag`).
- The camera frames each state at `fill` (default .62) of the frame on a `smooth` spring that starts `camLead` (.08 s)
  before the state, so the frame is ready when the shape arrives.
- Something happens on every beat; the bigger changes land on bar lines.

## Recipe

1. Pick 8-12 states and lay them on the beat grid (`tb(n)` is the start of beat n). Write the list before any code and
   render one frame per beat (`render.mjs --beats`) as the first check.
2. Write `STATES`: `{ t, w, h, r, fill, draw(B, k, t, zoom) }`. `B` is the body's current box; draw content relative
   to it and scale sizes from `B.h`, so content grows and shrinks with the morph. Use the helpers: `label`, `spinner`,
   `check`, `bars`, `art`, `playPause`, `track`, `toggle`, `tabs`, `chart`, `palette`, `T` (text).
3. Write the cursor `PATH` in world coordinates: `{ t, x, y, click }`, and `hold: [a, b]` for drags. The cursor
   arrives exactly at each `t`; the glide starts up to .46 s earlier.
4. Declare sound cues from the same times (`cue(t, 'click')`, `cue(springAt(t, .5), 'pop')`). Keep it to clicks, pops
   and drag ticks; let the music carry the beat (no sound on every morph).
5. `shots([[0, t => UIM.film(t, STATES, { cursor: PATH, loop: DUR })]])`. For a loop, make the last state look like
   the first; `loop` replays the previous cycle's springs so frame 0 equals the last frame, motion included.
6. Check: `--beats`, `--inspect` (text size and reading time), `--determinism`, `--onion` across a morph, then
   `--clip --subframes=4` (8 for whip-fast moves).

## Failure modes and checks

- Text that swaps inside a morphing container overlaps unless each side has its own timing (use `swap`).
- Labels set from `B.h` get small in big states; `--inspect` flags type under 28 px at 1080p (scaled to the frame).
- A UI label on screen for one beat fails the reading-time check by design. Accept it for glanceable chrome
  ("Day", "Week"), or give the state two beats if the words matter.
- Counting numbers: register them as fast text while counting (the chart helper prefixes the id with `~`).
- A loop that stutters: the last state isn't identical to the first, or the cursor isn't at rest in the same place.
- A dead beat: if nothing changes for a whole beat, add a micro-move (a knob, a value tick) or shorten the state.

## Sound palette

Clicks on presses, a pop when a check or toast lands, soft ticks on grab and release, one riser into the chart, a chime
as it completes. A 120 BPM four-on-the-floor bed: code-written (video-sound `score`) or generated (ElevenLabs music, as
in the specimen's soundtrack). Master to -14 LUFS for feeds.
