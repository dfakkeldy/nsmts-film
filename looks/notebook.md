# Annotated paper notebook (`notebook`)

A clean vector object moves across a page of dot-grid paper while a hand annotates it: a pen draws every mark on as a
marker stroke, notes are written letter by letter in a single-stroke hand, a sticky note slaps down with the question,
a wrong answer is struck out, a highlighter marks the right one, and the object's onion skin stays on the page as the
record of what it did. The last frame is the whole argument on one page.

- **Built:** yes. Module `looks/notebook.js`, specimen `specimens/notebook` (1920 x 1080, 30 fps, 10 s, 5 bars at
  120 BPM, one continuous take; not a loop). Measured on an M1 Pro: 67 ms a frame (`--clip`, no motion blur, a busy
  machine).
- **Best for:** explainers that teach one principle, tutorials, pitch stories ("what went wrong, what fixed it"), a
  B2B explainer with a protagonist object, a lab-notebook or design-review film. 8-30 s; 16:9 for a site or a talk,
  1080 x 1350 for a feed (put the notes in the top half).
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: M (plan the page and its notes; the protagonist's poses
  are a few pure functions of t). Layer-order risk: low (one flat page; marks draw in list order, the pen always on
  top).
- **Atlas:** look 16, "Paper and handwriting" (8 videos, 7 distinct, average 6.6 over 7 scored, top 8). The atlas
  gives it two variants on one paper ground: the annotated notebook (a vector protagonist with handwritten notes) and
  the stroke-drawn one (marker stick figures, whiteboard lectures, scanned watercolour doodles). This module builds the
  first and takes the second's draw-on and line boil for every mark; `NB.drawOn` will draw any stroke figure, but stick
  figures and characters are the author's to design, and scanned watercolour (supplied art) is out of scope. Best
  example: [ik-builds-b8bdcf](https://prompt-motion.com/ik-builds-b8bdcf).

## What it is, and isn't

It is one page and one protagonist, with notes that accumulate and never leave. The motion demonstrates; the hand names
what the motion is doing, in three to five short notes. It isn't a whiteboard lecture with paragraphs, a handwriting
font pretending to be a hand (the atlas lists that as this look's main risk), a dark interlude (it breaks the paper
idea), or a reel of nine ideas in ten seconds. No on-screen chrome (scrubber, timecode, frame counts), no animator
jargon written on the page ("squash", "stagger"), no name-card ending.

## Materials and palette

Warm off-white paper (`#F4F1E9`) with a dot grid fixed to the page, so camera moves read; set `P.notebook.grid` to
`'squares'`, `'lines'` (plus `margin: x` for a red margin rule) or `'none'`. A seamless, seeded fibre texture and a
faint warm vignette finish it. Ink is near-black (`#202227`). One accent, blue (`#2B5BD8`), carries the protagonist, the
fix and the highlighter wash; red (`#D63F2A`) carries critique and attention: arrows, strikes, rings and the target. Sticky notes are
kraft (`#E9D9B4`), a paper tone, so they don't add a fifth colour; tape is translucent and multiplied; the paperclip is
steel. Every mark is multiplied into the paper, so crossings darken like real marker. Override any of these with
`P.notebook` in the project's config. Banned: a yellow highlighter on top of a yellow sticky on top of blue and red
(five colours), glows, gradients on marks, drop shadows on ink, and corner telemetry.

## Type

The hand is single-stroke lettering drawn from stroke data in the module (`NB.GLYPH`): a-z, A-Z, 0-9, the punctuation
`. , ! ? : ; - + = ' " / ( ) % < >` and `→ ✓ × °`. The pen writes each glyph in stroke order. Three things keep it from
reading as a font when the frame is paused. Every glyph is jittered, seeded by the text: size, width, angle (up to 4
degrees either way), place, and a slow warp so no bowl is a true arc. Nine common letters (a d e h i l o r t) have a
second form, and a repeated letter alternates between its forms, so the two l's in "stall" and the r's in "harder"
differ. And each stroke carries pen pressure: it lands a little thin, swells and flicks off thinner, with a slow
unevenness between (drawn as short opaque pieces, the ink premultiplied by the paper; a faded note falls back to even
strokes). The line slants about 9 degrees and its baseline wanders. `size` is the em (caps are 0.7 of it); notes at
56-76 world px, stroke weight 0.078 of the size; writing speed `cps` (default 20 glyphs a second; the specimen writes
at 26). A write mark takes `jitter` (1 by default; 0 for a neat hand) and `press: false` (even strokes). A character
without a glyph logs `notebook: no glyph for "…"` and leaves a gap. For a longer typeset caption, `NB.typeOn` wipes on Fraunces italic
(weight 400; the shipped Fraunces has no italic axis, so the slant is synthetic) with the pen riding the wipe. All text
must be at least 28 px on screen at 1080p, measured through the camera.

## Motion grammar

- Every pen mark arrives as a stroke drawn by the pen, timed by its length (default 1500 px a second, clamped to
  0.16-1.4 s): writing, arrows (the shaft, then the head as one V), rings (anticlockwise from the upper right, past
  their start, a slight spiral), underlines with a lifting flick, strikes, ticks and crosses. The pen eases into and
  out of each stroke and lifts between strokes (an air move costs 35% of its length).
- One hand glides between marks on the glide curve, as kit.js `cursor()` does, hovering with a lifted shadow: a felt
  pen for pen marks (its cap in the ink's colour) and a chisel-tip highlighter for highlights, riding the wash's
  leading edge. A change of tool or ink happens in the air over the middle 60% of the glide's time: the old tool lifts
  away along its barrel and fades as the new one comes down the same way (about 3 frames on a 0.2 s hand-off). In a gap longer than 1.4 s the tool leaves along its own barrel, up and to the right, the shortest way off the
  page, and comes back the same way, so it never sweeps across the notes.
- A hand-off takes time: `NB.minGlide(d)` is the larger of 0.2 s and 0.1 s plus the distance d at 2500 px a second. A mark that starts
  sooner after the last one is inked late by the shortfall, and the page logs `notebook: mark … inked … s late`. Treat
  that warning as a timing bug and space the marks; to chain notes closely, start each mark where the last one ended
  (the specimen strikes the wrong answer right to left, `rtl: true`, from where the pen finished writing it).
- The protagonist is clean vector (no wobble) and moves physically: a wind-up before a throw, a stall, a crash that
  tips over on a spring, a glide that flares, touches down with speed and skids. Paths are Catmull-Rom routes through
  points, read by arc length (`NB.route(points).pose(u)`) and timed by eased functions of t. Set the heading against
  fixed attitudes where the motion is about attitude: the stall holds the nose at -72 degrees while the path tops out,
  pitches over to a fixed nose-down attitude and rocks about it as it falls. Added to the path's tangent, a stall
  barely shows, because the tangent is already turning. Blend the heading out of the hand over the first 7% of a
  throw, so it doesn't snap to the route's tangent at release.
- A fast frame leaves a faint smear: the plane drawn again at 1/90, 2/90 and 3/90 s earlier, at up to 20% alpha,
  scaled by its speed. It is a drawn motion blur, cheaper than sub-frames and without their dashed grid.
- The onion skin is a record. Ghosts at fixed times stay on the page as dashed silhouettes (fresh ones darker) beside a
  dotted path; `minGap` thins the bunch a stall leaves. Two records side by side are the argument.
- Props have physics: a sticky note slaps on a quick, underdamped spring (scale 1.16 to 1, a small twist, the shadow
  tightening), tape lays from one end on outExpo, a paperclip slides on with `snappy`.
- A rewind replays the forward pose function, but not by playing time backwards: that only works when the forward
  speed is roughly even, and a flight is not (the stall hangs and the dive jumps, so a backwards stall sits still and
  a backwards dive leaps 300 px in a frame). Re-time it by distance: `NB.retrace(forward, TR, T1, { turn })` samples the
  move at 240 Hz, counts `turn` px per radian of turning so a pivot in place takes time, and returns `u => pose` by the
  fraction of the way travelled. Drive it with `NB.cruise(k, .2)` (speed up, hold, brake: a peak of 1.25 times the
  average, against about 2.9 for `EASE.inOut`), start it where the object lies now (the specimen's covers the crash's
  tip-over), average the heading over the neighbouring frames, and blend into the start pose over the last 0.12 s. It
  passes back through its own ghosts.
- Line boil (`boil` px on a mark, re-seeded on threes at 30 fps (10 a second), twos at 24) keeps holds alive. The
  specimen uses 1.8 px on every drawn mark (floor, target, sketch, crash marks, arrow, strike, ring) and none on the
  writing.
- A new idea every 1.5-2 s. The hits (launch, crash, second launch, touchdown) land on beats; the touchdown is
  computed from the pose (the plane's lowest corner, `NB.planePts`, reaching the floor) and the flight is timed to put
  it on beat 15.

## Camera

`NB.page(t, MARKS, { cam })` takes keys `[t, [cx, cy, zoom], spring?]`, which ride kit.js `follow()` in log zoom on a
soft spring (stiffness 42, damping 13: it settles in about a second). Open close on the pen (about 1.4x), pull back
with the action (a key can carry `'smooth'` so the pull-back rides a throw), and end wide on the whole page; the
specimen then leans in 2% on a very soft spring over its last second, so the hold keeps moving. Once a note is written
it must stay in frame (`--inspect` errors on text cut by the frame edge), so every later framing has to hold all the
notes. Plan the page so they cluster.

## Recipe

1. Write the page as one sentence: what happens, what goes wrong, what fixes it. Plan three to five notes of up to four
   words each and where they sit on the page. The specimen reads left to right: the question top left, the answers top
   right, the action across the lower two thirds.
2. Lay the times on the beat grid (`tb(n)`) as named constants. Leave at least `NB.minGlide(distance)` (0.2 s or
   more) between one pen mark's end and the next one's start, and start a mark where the last one ended when they must
   follow closely. Write the protagonist's poses as pure functions of t (`NB.route(points).pose(u)`), one function per
   move; compute a physical moment (a touchdown) from the pose and time the move to put it on a beat.
3. Write `MARKS` in z order: `{ kind: 'write', id, str, x, y, size, t, col }`, `{ kind: 'arrow', from, to, bend, t }`,
   `{ kind: 'strike', of: W1, t }`, `{ kind: 'ring', box, t }`, `{ kind: 'highlight', of: W2, t }`,
   `{ kind: 'sticky', x, y, w, h, rot, lines, t }`, `{ kind: 'tape', x, y, w, rot, t }`, `{ kind: 'path', d | pts, t }`,
   `{ kind: 'draw', t: 0, fn }` for the protagonist. A mark already on the page at the start gets `t: -1, pen: false`;
   `out` and `outTo` fade one (the specimen fades the plane's sketch to 0.28 once the plane comes alive). Highlights
   are drawn by the highlighter; sticky notes, tape and typeset captions arrive without a tool.
4. Draw the protagonist inside its `draw` mark: `NB.trail(t, pose, { from, to, every, minGap, dots })`, then the object
   (`NB.plane`, `NB.clip`, or your own; `trail` takes `draw(pose, alpha, j)` for any shape), with the speed smear for
   fast frames. A rewind is `NB.retrace` driven by `NB.cruise` (Motion grammar).
5. Write `CAM` and check that every note stays in frame from the moment it is written.
6. Declare cues from the same constants (`cue(T1, 'whoosh')`, `cue(TOUCH, 'land')`); compute physical moments (a
   touchdown) from the pose function, not by eye.
7. `shots([[0, t => NB.page(t, MARKS, { cam: CAM })]])`. Check with `--beats`, `--strip` across each throw and the
   slap, `--inspect`, `--determinism`, then `--clip`. The kit's model sheet:
   `render.mjs --project=specimens/notebook --loop=kit --stills=0.9`.

## Failure modes and checks

- A note cut by the frame edge is an `--inspect` error. Reframe; the pen may leave the frame, notes may not.
- The protagonist crossing the notes: route its moves below them.
- A paper plane drawn fat reads as an arrowhead, a megaphone or a cursor. `NB.PLANE` is a slim dart (tail edge 0.30
  of its length) and narrows by up to 28% when it points steeply up or down (`S.planeThin`); keep the fold running its
  full length and draw its ghosts as dashed silhouettes, not fills.
- The pen jumping between marks in one frame: two marks closer than `NB.minGlide`. The page warns; space them.
- A rewind that hangs, then leaps: playing time backwards through uneven speed. Use `NB.retrace`.
- A heading that snaps at release or at the end of a rewind: blend it from the hand's angle, and back into it.
- The landed object hiding its target: stop it so its nose meets the mark, not its middle, and keep a prop (the clip)
  behind the nose.
- Ghost tangles where the object slows: set `minGap` to about half the object's length.
- A double contour where a sketch sits under the object it became: fade the sketch (`out`, `outTo`).
- Motion blur with 2-3 sub-frames copies the dot grid into dashes during camera moves. Render without sub-frames (the
  look is drawn, not filmed) or use 6 or more.
- The path language takes `M L Q C A`, absolute only; anything else is skipped without an error.
- Cramming: ten seconds hold one story and three notes. The atlas's weaker entries packed nine ideas into ten.
- The specimen passes `--inspect` (41 frames, no errors, no warnings) and `--determinism` (8 frames, 0/255).

## Sound palette

Pen-on-paper is implied, not scored: one swish for a strike or a ring, never one per letter. A whoosh on each throw, a
thump on the crash, a snap as the sticky lands, a suck for the rewind (from its first moving frame, for its length), a
click as the clip goes on, a land on the touchdown and a chime as the highlight finishes: 10 cues in 10 s. The throws,
the crash and the touchdown fall on beats 2.5, 5, 12.5 and 15; the rest follow the picture. Under them, a soft 120 BPM
bed whose drums drop out while the plane is in the air and come back on the landing (the reference does this), or
sound design alone. Master to -14 LUFS for feeds.
