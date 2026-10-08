# Editorial print poster (`editorial`)

Magazine print design in motion. Every bar is a poster set on one strict grid: a heavy, high-contrast serif set big,
two flat print inks on paper, square rules. On the beat the page rebuilds itself: a new colour sweeps up, a page drains
into a single rule, a sheet is pulled away. A silhouette motif (a wren by default) hops from one composition to the
next and takes the ink that reads on whatever page is under it, so when a page edge stops under it, it shows in two
inks at once, as a print would.

- **Built:** yes. Module `looks/editorial.js`, specimen `specimens/editorial` (1920 x 1080, 60 fps, 10 s, 4 bars at
  96 BPM, one continuous shot ending on a held masthead, `forest` palette). Measured on an M1 Pro: about 0.093 s a
  frame for the final clip (no motion blur, encode included, while other renders ran).
- **Best for:** brand and launch films, manifestos, a publication or newsletter launch, a data-backed product story
  with one number per page, an ident. 8-25 s; 16:9, and 9:16 with the grid re-cut to 4 columns (tested on one page:
  the numeral, a fitted line, a deck, dots and a perched wren at 1080 x 1920 on `ED.grid({ cols: 4, rows: 8 })`).
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: M (a page function per bar, plus choreographing the
  motif's perches). Layer-order risk: low (flat pages in one stack; the motif is always drawn last).
- **Atlas:** look 11, "Editorial print poster system" (7 videos, average 7.6, top 8). Best example:
  [kangaroohere-b10f8d](https://prompt-motion.com/kangaroohere-b10f8d).

## What it is, and isn't

It is printed matter that moves: posters on a grid, flat inks and real typography, a few words a page, one motif that
connects the pages. It isn't a slide deck with transitions, a HUD showreel, a count-up stat reel or a UI demo. A real
number is welcome as one static numeral on its own page; never count it up. Leave out crop marks and corner brackets
(on screen they read as the banned viewfinder chrome), small tracked caps eyebrows, and italics: only roman Fraunces
ships, and the browser's synthetic oblique looks cheap, so the contrast comes from weight.

## Materials and palette

Paper, ink and two print inks: `a`, a deep ink that takes paper-coloured type, and `b`, a light ink that takes ink
type. The default `forest` palette: paper `#EEEBE2`, ink `#121512`, racing green `#1E5B3E`, marigold `#E9A23B`.
`ED.PALETTES` also holds `cobalt` (cobalt and chrome yellow: the reference film's pair, so reach for it only when a
brief asks) and `vermilion` (vermilion and blush). All three are rendered and read; pick one with
`P.editorial.palette`, or set colours with `P.editorial.inks`. Use one palette per film: mixing them drifts toward the
atlas's banned near-black + vermilion + cobalt + cream set. One page shows paper or one ink as its field and at most
two inks on it. Pages are flat, full bleed: no gradients, glows or drop shadows. The finish (`ED.finish()`) is a fixed
paper texture, multiplied (paper doesn't move), plus a whisper of grain.

The motif takes the ink that reads on the page under it (`ED.knockout`): ink on paper and marigold, paper on green,
its eye knocked out in the page colour. A rule that outlives its page does the same (marigold on green, ink on paper).
As a page edge crosses them they split into two inks. A crossing at page-flip speed lasts one or two frames and reads
as a colour pop, so park an edge under the motif for half a beat (`ED.pull` with a stop) to show it: in the specimen
the paper edge stops under the wren for 0.31 s, and when the wren turns its head the two inks swap ends.

## Type

- Display: Fraunces 900. At display sizes its contrast is high, close to a Didone. One display line per page, 1-3
  words, set to span whole columns with `ED.fit(str, o, G.w(n))`.
- Deck: Fraunces 300, at a third to half the display size. Ears and folios: Fraunces 600 roman, 40 px or more at
  1080p (the specimen's "No. 1" and "Five stories" are 44 px). If a brief wants caps labels, set them in Space Grotesk
  600 (`kind: 'caps'`, tracked +14%) at 40 px or more. Smaller tracked caps read as the atlas's tiny-eyebrow tell. All
  voices are set with `ED.headline`.
- Optical tracking (`ED.track`) goes between letters only: display lines tighten to -2.5% of the size at 220 px and
  above, easing to none at 48 px. A word space takes no negative tracking and is at least 0.2 em (`space` option), so
  "Good morning." never closes up into one word.
- Kerning survives animation: `ED.setLine` puts glyph i at the kerned width of the prefix before it, plus tracking, so
  glyphs that move separately land exactly where the set line has them. `ED.fit` sizes with the same layout.
- Perches on letters come from the real ink, not the bounding box: `ED.inkTop(L, i, fx0, fx1)` rasterises a glyph once
  and reads how high its ink reaches across those columns, and `ED.perch(L, i, fx, s, face)` puts a motif's feet on
  the highest ink under them. A numeral's concave flag dips about 50 px below its raised tip, so a box-based perch
  floats. The specimen's wren sits in the saddle of the 5's flag and on the d's ascender.
- For a giant condensed numeral instead of a serif one, set it in Barlow Condensed Black (`family: ED.S.cond`,
  `weight: 900`). Keep one numeral per page, and never count it up.

## Motion grammar

- Glyphs rise into place from behind their own line box (a slot, ascent to descent), 16-35 ms apart, on the punch
  curve. Exits drop back into the slot (`t1`, `outDur`). The line registers for the checks once its last glyph has
  landed.
- Page changes are flat and full bleed, and each is a different move. Sweep: a page wipes in from a side
  (`ED.sweep`). Drain: a page shrinks into a rule, each edge on its own critically damped spring (`ED.rectSpring`).
  The same rule can later run out to the full measure (one edge moves) and lift into a masthead. Pull: a sheet leaves
  sideways carrying its type (`ED.pull`), in two stages if an edge should park under the motif.
- The motif causes the change: the page starts moving when it takes off, or stops when it reaches it, and has
  arrived when it lands, on the beat. An outgoing page empties as the motif crouches (exits about 0.2 s before the
  take-off, faded out by 0.06 s after it), so the moving edges never slice full-strength type.
- Rules are square-ended and wipe in from a side or the centre (`ED.rule` with `ED.wipe`, out-expo).
- The hop (`ED.hop`): a 0.14 s crouch, then an eased parabola (horizontal nearly even, vertical ballistic). On long
  hops the wings beat and then flare back to brake; the tail trails flat in flight; the landing squashes (`kick`).
  Perched, the head turns on chosen beats (`looks`) and the tail flicks. A hop that lands where it took off is a
  jump-turn: it turns round in the air, upright. A perch can be a function of t, so the motif can ride a rule while it
  moves.
- When a rule stays put and a page moves, move the page parallel to the rule, so its type never crosses the rule.
  When a rule moves past type, start the type only once the rule has cleared it (the specimen derives the masthead's
  start from the rising rule's position).
- Hold each page 1.5-2.5 s, with something small on most beats (a dot fills, a head turns, a rule runs out). Five
  pages in 10 s is the most that still reads.

## Camera

None: the frame is the page. A zoom or a pan breaks the printed sheet and the grid. The pages and the motif carry the
movement.

## Recipe

1. Write one line per page (a 1-3 word display line, an optional deck) and lay the pages on bars (`bar(n)`, `tb(n)`).
   Render `--beats` first.
2. Measure layout inside `ED.once(() => ...)`, never at the top level (the fonts aren't loaded yet): `G = ED.grid()`,
   sizes from `ED.fit`, perches from `ED.perch(ED.setLine(str, { size }), i, fx, motifSize, face)`.
3. Draw each page as a function of t: `ED.headline(id, str, x, y, t, { size, t0, t1, outDur, weight, color, align })`,
   `ED.rule(x, y, w, ED.wipe(t, t0), { lw, from })`, `ED.dots(...)` for a small honest chart.
4. Build the page stack for each t, back to front, with the motif's inks on each page, and draw it with
   `const regs = ED.pages([{ fill, draw, col, eye }, { r: ED.sweep(...) or YR(t), fill, draw, col, eye }])`. A pulled
   sheet is `const s = ED.pull([0, 0, W, H], p, 'left')` with `{ r: s.r, dx: s.dx, ... }`; park its edge with
   `p = kf(t, [[t0, 0], [t1, at, EASE.inOut], [t2, at], [t3, 1, EASE.exit]])`. Pages draw clipped to their rects, and
   text registers only where no page above covers it.
5. The motif: a path of perches `[{ t, at, dur, arc, flap, looks, face }]` that lands on beats; take-off times set the
   page changes. Draw it with `const h = ED.hop(t, PATH)` and
   `ED.knockout(regs, (col, eye) => ED.wren(h.x, h.y, size, h.pose, { color: col, eye }))`. A rule that outlives its
   page is drawn the same way from an extra field on each page (`{ ..., rule: ink }`, then `g.rule` in the callback).
   Any drawable `(x, y, s, pose, o)` can replace the wren (`ED.motif(t, path, s, { draw })`).
6. Call `ED.finish()` last. Declare cues from the same times the picture uses (see Sound palette).
7. Check: `--beats`, `--inspect --every=0.05`, `--determinism --n=8`, a `--strip` across every page change and every
   rule move that passes type, a full-size crop of each perch, and `--loop=grid --stills=t` (the specimen's grid
   overlay) for alignment. Then `--clip` without sub-frames. For 9:16, render a grid still of one page first.

## Failure modes and checks

- A perch placed from the glyph's bounding box floats over curved tops. Use `ED.perch` and check a full-size crop:
  the toes should touch ink.
- The motif crossing type in the same ink merges into the letters. Route hops above glyph tops (a kicker rule over the
  headline, not under it), keep the motif's standing place clear of the last glyph (the specimen leaves 140 px after
  the full stop), and check a strip of every hop.
- A rule crossing type reads as a strikethrough. Move the page parallel to the rule, or start the type once the rule
  has passed. `--inspect` can't see it, because rules aren't registered text: strip every rule move.
- A two-ink split at flip speed is a one-frame pop. Park the edge under the motif and check the strip shows the split
  for at least 8 frames (the specimen shows 22).
- A dot chart must be complete before the page leaves: the last fill should finish at least half a beat before the
  take-off crouch. The specimen fills its five dots on sixteenths and holds them full for about 26 frames.
- A page draining or sliding over full-strength type slices it into a letterbox. Empty the page with the crouch.
- A jump-turn passes edge-on for one frame (the motif vanishes). Don't sample a contact sheet or thumbnail there.
- Text under a page that has swept over it, or type carried by a pulled sheet, counts as readable only through
  `ED.pages` / `ED.within` (they compare in frame pixels, through the transform). Carried type leaving the frame shows
  as `outside-safe` warnings for the frames of the move: expected, as long as it is moving.
- A raised wing with a cocked tail reads as rabbit ears. `hop()` trails the tail in flight; keep that if you draw
  another bird.
- Two sub-frames of motion blur double the motif's outline at hop speed and leave a half-tone band behind a fast sheet.
  Render without blur (crisp suits print), or use 4 or more if a frame stays under 250 ms.
- Reading time: display lines of 1-3 words, decks of 3 words or fewer, each page held at least 1.7 s.

## Sound palette

Dry and papery: a whoosh under a page sweep, a thump when a big numeral lands with the motif, a suck as a page drains
into its rule, a soft land for the motif, a swish as a rule runs out and as a sheet slides in, and a whoosh as it is
pulled away. Arrivals get pitched pops (the specimen's chorus rises 0, 2, 4, 7 semitones), with one chime at the
resolve: 12 cues in 10 s. Under them, a light 96 BPM bed (brushed kit, upright piano or celesta), or only room tone and
foley. Leave the parked edge's half beat nearly silent, so the split reads as a held breath. Master to -14 LUFS for
feeds.
