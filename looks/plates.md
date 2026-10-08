# Figure plates on paper (`plates`)

One object on cream paper turns, in a single uncut take, into a sequence of numbered figures that make an argument:
fine engraved line work, soft contact shadows, a glass loupe that magnifies what lies under it, measured annotations
with leader lines and dimension lines, and a FIG. caption that types in at the foot of the plate and states the fact
each figure adds. The last figure answers the question the plate opened with.

- **Built:** yes. Module `looks/plates.js`, specimen `specimens/plates` (1920 x 1080, 30 fps, 11.5 s, one uncut take:
  "How big is the Earth?" in four figures). Measured on an M1 Pro: 0.075 s a frame with no motion blur (the busiest
  stretch, 6-10 s, JPEG encode included), and 0.32 s a frame for the delivered clip (12 sub-frames of motion blur,
  0.4 shutter: the drawing is cheap, the blur multiplies it).
- **Best for:** explainers and lessons, science and engineering stories, a brand or capability film with one idea, an
  ident that resolves into a fact. 8-30 s, 16:9 (4:5 and 9:16 work: sizes scale with `PLT.u` and the bands follow the
  frame, but re-frame the camera keys); at 30 s, hold each figure 3 s.
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: M (the materials are ready; each figure is a small
  piece of geometry you write as pure functions). Layer-order risk: low (one drawing, a fixed draw order, the loupe
  last).
- **Atlas:** look 13, "Scientific figure plates on paper" (2 videos, average 8.5, top 9). Best example:
  [hbcoop-de365c](https://prompt-motion.com/hbcoop-de365c), the top-scoring video in the corpus; the other member is
  [fionntobin-97b7af](https://prompt-motion.com/fionntobin-97b7af).

## What it is, and isn't

It is a printed plate that redraws itself: one subject, continuous identity, and every change shows the next step of
an argument. Each figure adds one exact fact (an angle, a distance, a rule) and the caption states it in two to four
words ("7.2° from vertical", "Syene, noon"). It isn't a showreel of techniques, a sequence of unrelated objects, a
dark or glowing scene, or a "written in code" credit in the header. hbcoop's grammar is the model (uncut
metamorphosis, numbered figures, glass, shadows on paper, an ending that calls back); don't copy its sequence (a lone
point, a line, a circle, a lens, a ball, a flock, a world), its captions (an article and a noun: "a point", "a lens"),
its floor shadow under a floating world, or its ending (the object becomes the full stop of a closing sentence). Open
on the subject, already in its setting.

## Materials and palette

- Paper `#F1EADB`, built once from a seed (fibres, specks, a faint mottle) and drawn every frame. It never moves with
  the camera, so a zoom reads as the figure redrawn at a new scale on the same sheet (`PLT.paper`).
- Ink `#1E1C19` for the object and outlines; graphite `#857E71` for construction lines, rays and hatching; one
  vermilion `#BD3F27` for what is measured (angle marks, the FIG. label, the measure carried round). Three inks on
  paper; set `P.plates` to change them.
- Engraving: `PLT.hatch` (parallel lines clipped to a region, anchored so they never swim), `PLT.crossHatch`,
  `PLT.ribbon` (a line that swells and thins) and `PLT.sphere` (contour rings round an axis, swelling into the shade,
  cross-hatched with meridians where it is darkest; the meridians thin out before the polar cap). Point the axis
  toward the light (the specimen uses the light's own direction): the blank cap round the pole then sits in the
  highlight, where an engraver leaves the paper bare.
- Physical touches, used sparingly: `PLT.contact` (a soft contact shadow under a standing object) and `PLT.lens` (a
  loupe: magnification with barrel compression at the rim, a rim and one highlight, a shadow that grows and softens
  as it lifts, a faint caustic).
- Light: `PLT.rays` lays a narrow beam of parallel rays (about 4-6, 115 px apart at 1080p) over each object that
  casts a shadow, each ray stopped by what it hits. Build the stop from `PLT.hitSeg` (a stick, an edge),
  `PLT.hitCircle` (a ball, a planet) and `PLT.hitLine` (a floor), combined by `PLT.stops(v, ...)`, which takes the
  nearest hit and works in world units through the camera.
- Sizes are 1080p pixels times `PLT.u` = min(W, H) / 1080: stroke weights (hairline 1.1, line 2, emphasis 3.2), label,
  caption and leader type, arrowheads, dimension offsets, scale ticks and numerals, ray gap, chevrons and speed, lens
  rims. The head band (`S.head`, 0-64) and foot band (`S.foot`, 178-128 above the bottom edge) are measured from the
  frame's edges, so a tall feed frame keeps its whole drawing. Not scaled: the loupe's radius and anything a scene
  passes explicitly (the specimen's camera keys, beam widths and label sizes are 1080p numbers).
- Grain .03 and a faint warm vignette (`PLT.finish`).
- Banned: glows, gradients on the drawing, RGB split, particle bursts, corner telemetry, a self-credit header, more
  than one accent colour.

## Type

- Fraunces (engine OFL font) for the running head, names and captions, at weight 400; the figure number in Fraunces
  600 at .7 of the caption size, tracked out, in vermilion (`FIG. 2`), as small capitals. The atlas lists italic
  serif names as a trait, but the engine's Fraunces file has no italic and canvas would fake one with a slant, so set
  names in roman until a Fraunces Italic file is added to `fonts/`.
- Space Grotesk 500 for measurements (`7.2°`, `800 km`): numbers read better in a grotesk.
- Sizes at 1080p: caption 46, running head 40, labels 34-36, measurements 34-36, the answer 64. Nothing a viewer must
  read goes under 28 px; the loupe is how the film shows something smaller (the printed scale is 9-12 px and reads
  only through the glass, which is the point).
- `PLT.label` draws text with a paper halo, so it stays clean over rays and hatching. `PLT.caption` types the
  figure's name at 36 characters a second; on each change it strikes the old name back at 90 a second, retypes the
  number on the empty line, then types the new name, so a number never sits beside another figure's name. Give
  figure 1 a negative start (`[0, 'Alexandria, noon', -.6]`) so its name is already set on frame 0, the poster
  frame. The caret blinks a few times, then goes.

## Motion grammar

- One uncut take. Figures change by a camera move, a morph of the object, or a draw-on, never a cut or a crossfade.
- Cause before effect. A shadow is cast only as the front of its light passes the object: `PLT.rays` returns each
  ray's start, front and length, so the shade can fill out from the object as the front travels down (the specimen's
  `keyRay` and `shade`).
- Things arrive by drawing on: a stroke grows along its length (`PLT.draw`, `lineTo`), hatching lays down line by
  line (`o.p`), a leader goes dot, line, shelf, then words (`PLT.leader`), a dimension draws from its middle outwards
  (`PLT.dimPath`).
- Morphs carry meaning: `PLT.morph(a, b, k)` matches two outlines by arc length (in the specimen, the angle slides
  down a radius and lands on the arc it measures). Drive a figure from a few parameters (the specimen's ground
  `bend` runs 0 to 1, from flat to the Earth) rather than redrawing it.
- One event at a time at the key step: the specimen's slide (0.5 s) plays alone, after the camera has settled and
  before anything else moves; the measure it lands on waits beside the arc with a fine leader until it has landed.
- Labels that travel (a value carried to the answer, a label riding a morph) move on smoothstep (`ease`), whose peak
  speed is half that of `EASE.inOut`; a steep curve smears them into separate copies even under motion blur.
- Chevrons travel down the rays, so a held figure is never dead. The loupe glides in on `EASE.glide` with an arc,
  settles (its shadow tightens), drifts a few pixels on seeded noise while it reads, then lifts and leaves.
- Hold each figure until its caption has been readable for 1 s plus 3 words a second: with the caption's erase and
  typing, about 2.3 s for a two-word name and 2.65 s for three. Hold the answer at least 2 s.

## Camera

`PLT.camera(t, keys)` returns a view `v`: `v.p([x, y])` maps world to screen and `v.z` is the zoom. Keys are
`[t, [fx, fy], zoom, seconds, easing]`; zoom travels in log space and the pan is zoom-compensated, so a 28x pull-back
keeps its subject on screen. Draw every point through `v.p` and keep widths in pixels. Use `EASE.inOut` for short
moves and smoothstep (`ease`) over 1.5 s or more for a big pull-back. Fine lines under a fast scale change, an arc
sweeping closed or a label carried across the frame show as separate sharp copies with few sub-frames: deliver with
`--subframes=12 --shutter=0.4` (the specimen's whole clip, 0.32 s a frame), or render only the fast stretch that way
(`--frames --range=6.6:9.6` at 12, the rest at 4, deleting the frames stamp between the two runs).

## Recipe

1. Write the argument first, as figures: a running-head question; `FIG. n`, a name of two to four words stating the
   one exact fact each figure adds; an ending that answers the question. Put the times in one table (the specimen's
   `TL`) at about 2.3-2.7 s a figure (see Motion grammar for the caption's arithmetic); render `--sheet` at the figure
   changes as the first check.
2. Model the subject in one world coordinate system as pure functions of the morph parameters (the specimen's
   `ground(s, bend)`, `stick()`, `hitGround()`), and decide what each figure shows by camera keys (`CAM`).
3. Draw in this order: `PLT.paper()`; contact shadows and engraving (`PLT.contact`, `PLT.sphere`); light
   (`PLT.rays` with a `stop` and a narrow `band`); shading (`PLT.hatch`); outlines (`PLT.ink`, `PLT.shape`);
   construction and measures (`PLT.construct`, `PLT.angle`, `PLT.scale`, `PLT.dimPath`); names and values
   (`PLT.leader`, `PLT.label`); then `PLT.lens` over everything; `PLT.margins()`; the running head and
   `PLT.caption(t, FIGS)`; `PLT.finish()`. A minimal plate:

   ```js
   const FIGS = [[0, 'one ball, at noon', -.6], [2.6, 'light 7° from vertical']];
   const CAM = [[0, [0, 0], 3], [2.3, [-20, -10], 2.2, 1.2, ease]];
   const BALL = [0, 0], RB = 30, { add } = PLT;                   // world units
   function film(t) {
     PLT.paper();
     const v = PLT.camera(t, CAM), c = v.p(BALL), r = RB * v.z, d = [-.12, .99];
     PLT.contact(c[0], c[1] + r * 1.02, r * .9, r * .16, .35);
     PLT.sphere(c, r, { light: [.45, -.62, .66], axis: [.45, -.62, .66], polar: 80, p: seg(t, .2, 1.2) });
     PLT.ink([v.p([-400, RB]), v.p([400, RB])]);                    // the floor
     PLT.rays(t, d, add(c, [r * .6, 0]), { gap: 115, band: [-300, 300], p: seg(t, 0, .7),
       stop: PLT.stops(v, (P, dd) => PLT.hitCircle(P, dd, BALL, RB), (P, dd) => PLT.hitLine(P, dd, [0, RB], [0, 1])) });
     PLT.leader('ball', 'steel, 6 mm', add(c, [r * .7, -r * .7]), add(c, [r * 2, -r * 1.6]), seg(t, 1, 1.6));
     PLT.margins();
     PLT.label('head', 'Where is the sun?', 120, 124, { size: 40 });
     PLT.caption(t, FIGS);
     PLT.finish();
   }
   shots([[0, t => film(t)]]);
   ```
4. Register what the loupe reveals with `readable('~id', ...)` at its magnified box (`lens().at(q)` maps a point
   through the glass), and write the reading again at full size once the glass has gone, so it persists.
5. Declare sound cues from the same table (`cue(TL.slide[1], 'pop')`) and keep the scene's globals distinct from the
   kit's (`T`, `W`, `H`, `P` are taken).
6. Check: `--inspect --every=0.1` (0.25 s sampling misses short reading-time failures), `--determinism`, `--strip`
   across each camera move and each caption change, `--onion` across a morph, stills with
   `--subframes=12 --shutter=0.4` at the fastest moment of each move, then
   `--clip --subframes=12 --shutter=0.4 --no-audio`.

## Failure modes and checks

- Hairlines and labels under fast motion: with 4 sub-frames, a fast zoom, an arc sweeping closed (`TL.close`) or a
  carried label shows as four sharp copies, not a blur. Use 12 sub-frames at a 0.4 shutter, keep big pull-backs on
  smoothstep over 1.5 s, carry labels on smoothstep, and check one frame from the middle of each move at full size.
- The key step crowded by other events: if the morph that makes the argument shares its half-second with a camera
  settle, a draw-on and a flying label, nobody sees it. Give it its own beat, after the camera has settled.
- `--inspect` skips the reading-time check for text that runs to the end of the film, so it never checks the answer.
  Hold the answer at least 2 s by hand.
- Captions: a figure whose name finishes typing less than 1 s + 3 words a second before the next figure fails the
  reading-time check; `7.2°` counts as a word. Shorten the name or lengthen the figure.
- A shadow drawn before its light reaches the object reads backwards in a film about cause and effect; tie the shade
  to the front of the key ray.
- Text drawn before the loupe is magnified by it. Write a label after the glass has moved off, or draw it after
  `PLT.lens`.
- Hatching anchored to its region's bounding box swims as the region changes; pass `anchor` (a point on the object).
- An engraved sphere knots where its contour rings and meridians meet a pole on the limb, and a polar cap on the
  shaded face reads as a hole. Point the axis toward the light.
- A full-frame field of rays reads as ruled paper or rain. Keep the light to a narrow beam over each object that casts
  a shadow (`band` about ±250-360 px, `gap` 110-120); fade a second beam out before two objects' beams overlap.
- Close-ups run under the caption: `PLT.margins()` fades the drawing into the paper above the caption and under the
  running head; keep annotation out of those bands.
- Hype and clichés creep in at the end: no count-up, no stat triplet, no "every frame is code" line. One measured
  answer, set once.

## Sound palette

Paper and glass, not a club bed: a soft land as the first shadow falls, a low tock when a shadow settles, a swish and
a small glass land for the loupe, a whoosh or swell under each pull-back, a pop as the key morph lands, a riser under
the count, one chime on the answer, then a short silence. If there is music, a quiet piano or celesta figure at
60-90 BPM leaves room for the cues; master to -14 LUFS for feeds, -16 for a site.
