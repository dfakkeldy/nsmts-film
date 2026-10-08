# Flat illustrated diagrams (`diagram`)

A systems explainer on one neo-brutalist stage: boxes with thick black outlines and hard offset shadows on a cream dot
grid, elbow connectors, messages that travel along them in their sender's colour, a timer ring that runs out, rubber
stamps that slam onto a box when its state changes, and a numbered step bar that carries the teaching structure (the
setup, the obvious fix, why it fails, the mechanism, the trade-off). The cast never leaves the stage; it changes state
in place.

- **Built:** yes. Module `looks/diagram.js`, specimen `specimens/diagram` (1920 x 1080, 30 fps, 12.5 s, 5 bars at
  96 BPM: steps of one, one, two and one bars; not a loop; poster frame 9.9 s). Measured on an M1 Pro: about 0.15 s a
  frame with 4 sub-frames of motion blur (149 ms over the whole clip, JPEG encoding and the pipe to ffmpeg included);
  a single frame draws in 0.02-0.05 s.
- **Best for:** technical explainers (retries, caches, queues, locks, rate limits, leases), product how-it-works films,
  an architecture walkthrough in a launch film, a recipe or how-to with numbered steps and levels that rise against
  ticks. 10-60 s; 16:9, or 1:1 with a smaller grid.
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: M (the story and the timeline take the time; the parts are
  in the module). Layer risk: medium in the atlas; low here, because the draw order is fixed and the same every frame
  (paper, wires, nodes, messages, stamps, step bar) and nodes never travel.
- **Atlas:** look 17, "Flat illustrated diagrams" (5 videos, average 6.6, top 8). Best example:
  [0xnfrith-5be616](https://prompt-motion.com/0xnfrith-5be616), the clearest teaching structure in the corpus; also
  ror-fly-9950f1 (a recipe whose counters move with the pour).

## What it is, and isn't

It is one stage and one cast, taught in steps: the viewer learns the boxes once and watches them change. Each step
title says one thing in three or four words; the picture does the rest, and every change is caused by something the
viewer saw arrive (a message lands, a timer runs out). It isn't slides (no cut to a new layout per point), a dashboard,
or a wall of labels. The atlas names two AI tells for this look, and the module has neither: starburst stickers and
pill eyebrow tags above headings (the step number is a tile in the bar, set in the display face). No decorative hazard
stripes either: the stripes (`hatch`) mean "down" or "wrong", nothing else.

## Materials and palette

Cream paper (`#F3EEE3`) with a 30 px dot grid that moves with the camera; ink (`#161412`) for every outline, wire and
shadow; white panels inside the boxes. Four flat colours, each with one job, set in `DIA.S` or `P.diagram`: butter,
sky and mint name the cast (in the specimen: client, payments, keys) and every message wears its sender's colour; coral
only ever means wrong (the time-out, the second charge, the lost reply, a level past its limit). Outlines 5 px, hard
shadows offset 10 px with no blur, corner radius 12. No gradients, glows or soft shadows.

## Type

Two families from the engine: IBM Plex Mono Bold for everything inside the diagram (box names, values, ids, tags,
counts: `DIA.say`), Barlow Condensed Black caps for the step titles and the stamps (`DIA.big`). Nothing a viewer must
read goes under 28 px at 1080p after the camera's zoom; box names are 30 px, values 36-44 px, step titles 58 px, stamps
64 px. Draw ticks, crosses and arrowheads as strokes (`tick`, `cross`, the wire heads), not glyphs.

## Motion grammar

- A teaching step gets 2-4 bars: one event a beat, then a held beat after the step's verdict (a stamp, a status).
  One bar a step is only for a recap or a montage beat (the specimen's first two steps set up a story the viewer
  already half knows; its mechanism gets two bars). The atlas's best example spends 5-8 s on each step.
- Boxes pop in on an overshooting spring (about 18%) and never travel afterwards. A message landing presses its box
  into its shadow (`hits`); a failure shudders it (`shakes`).
- Wires draw on with the arrowhead riding the tip. Lookups and async calls are dashed and march while the film runs.
- Messages travel on `EASE.inOut`, pop out of the sender, light the stretch of wire behind them in their colour, and
  slide into the receiver through its wall like a letter through a slot (`into`), so they never cover the receiver's
  labels. A lost message hops off the wire part way along (between the boxes, not at the door), spins and falls out of
  frame; a coral cross marks the spot until a later message passes it.
- State changes in place: a status tag swaps, a live light blinks on the beat, a row slides into a ledger, a wrong row
  is struck out and collapses, a stamp slams down (it falls from 1.7x with its shadow closing in, then recoils) and
  lifts off when the story moves on. In a prepended table the new row slides down from under the top edge and pushes
  the stack like a conveyor.
- Gauges move with what they measure: the timer ring drains clockwise, turns coral in its last 15%, flashes when it
  runs out and refills when a reply cancels it; a `meter` fills or drains against ticks and turns coral past its
  limit; a `count` is driven by the same keys as the thing it counts (the KEYS table's count steps as each row lands).
- The step bar's tile flips to the new number and the title swaps in .24 s with a light blur, so the new title is
  legible at once.

## Camera

One camera on `DIA.view`, a `follow()` of `[cx, cy, zoom]` with zoom in log space. Hold on the boxes that matter, pull
out on the `smooth` spring when a new box joins (the reveal is the motivation), and lean in on `heavy` for the last
step so its subject fills the frame (the specimen goes to zoom 1.3 on PAYMENTS and KEYS and lets the client leave
frame). Keep zoom at 1.04 or more: a box's pop-in dips about 4% under full size after its overshoot, and 28 px type
needs the headroom. A box the camera leaves behind gets `read: false` from the start of the move, so its labels don't
register at the frame edge. The step bar sits outside the camera; frame the cast below it.

## Recipe

1. Write the beat sheet first: 2-4 bars a teaching step (one bar for a recap), what changes on stage on each beat and
   what causes it, the step title (three or four words: `--inspect` wants 1 s plus 3 words a second), and the cues. The
   specimen: lost reply (1 bar), retry charges twice (1), retry with a key (2: rewind and file the key; the keyed retry,
   lookup, verdict and saved reply), the cost of keeping keys (1).
2. Lay out the cast on the 60 px grid: `DIA.cell(col, row, w, h)` makes a box, `DIA.pin(box, side, line)` a port on a
   grid line (`DIA.port` takes a fraction instead). Leave the top band for the step bar.
3. Route the wires: `DIA.elbow(a, b, { via: 'x', at })` (or `'y'`, `'hv'`, `'vh'`). Nest a request and its reply as
   two concentric elbows rather than one two-way wire.
4. Put every time in named constants and derive them from each other and the beat (`ARR = SEND + .5`,
   `LOOK = tb(13)`), so the picture and the cues share them.
5. Draw each frame in order: `cam(...DIA.view(t, CAM))`, `DIA.paper()`, `DIA.wire()` for each wire,
   `DIA.node(box, { t, at, label, fill, hits, shakes, status, led, hatch, draw, head, read })`,
   `DIA.packet(route, t, t0, t1, { label, fill, key, dot, into: receiverBox, lost, drift, hop })`,
   `DIA.stamp(id, str, x, y, t, t0, { off, fill, rot })`, `DIA.note(...)`, then restore the camera and draw
   `DIA.caption(t, STEPS)`. Inside a node's `draw(inner, t, live)` use `DIA.list` for ledgers and tables (rows with
   `strike`, `flash`, `hatch`, tags, `order: 'prepend'`; pass `live`), `DIA.ring` for timers, `DIA.tag`, `DIA.say`;
   `head(hdr, t, live)` draws into the header band (a count). Pass the `live` flag through as the condition for an id,
   so text registers only once its box has settled (.55 s after its pop) and while the camera is on it.
6. Gauges for recipes, leases and quotas: `DIA.meter(x, y, w, h, t, keys, { dir: 'up', ticks, units, limit, bad,
   fill })` and `DIA.count(id, x, y, t, keys, { map, fmt, tag })` take the same keys (`[[t, value], ...]` on springs, or
   with `ease: linear` for a steady drain), so the number and the level move together. The specimen's
   `--loop=parts` shows a draining lease with its seconds and a pour rising against ticks with its millilitres. Also
   in the module: `hatch` for a node that is down, `tick` and `cross` as marks, `DIA.along` and `DIA.cut` for anything
   else that rides a wire.
7. Check: `--beats`, `--inspect --every=0.1` (pop-ins and swaps are short; a .25 s sample misses them), a `--strip`
   across each stamp, each lost message and each arrival, `--determinism`, `--events`, then `--clip --subframes=4`
   (cheap at about 0.15 s a frame). Pick a poster frame where every box is settled and no tag is mid-swap.

## Failure modes and checks

- A message centred on the end of its route covers the receiver's top-left label as it arrives: give it `into` (it
  slides through the wall, clipped, and its label stops registering once it enters).
- A stamp over a box's name or a ledger row is a text collision: put it on the empty lower part of the panel or on a
  corner. The specimen keeps a stamp zone under the ledger.
- A stamp that lifts with the next step can be up for less than its reading time: lift it a beat into the next step,
  or leave the last one down so the final frame holds the lesson.
- Text that registers on a spring's value flickers in and out as the spring dips after its overshoot: `node` and
  `note` register on elapsed time instead.
- Status tags and message labels change or move too fast to read, so they register with `~` ids on purpose; the colour
  of the tag and what the boxes show carry the meaning. Anything the story depends on goes in a box, a row or a stamp.
  A count registers as `~` while it is changing and under its plain id once it has settled.
- Pop-ins from scale zero show a speck for a frame: `node` and `note` skip drawing below 4% of full size.
- Text in a list row that slides out of its panel is clipped but would still register: `list` registers a row only when
  it sits inside the panel.
- A step that does too much in too little time: the specimen's first cut crammed the mechanism into one bar, with three
  key tags appearing at once during a camera move. Give the mechanism two bars and start nothing while the camera moves.
- A dead hold: the live lights blink on the beat, the dashed wires march and the note's ring keeps draining, so a held
  frame still moves. Don't add traffic to fill a hold: an extra message reads as an extra event.

## Sound palette

Causal and dry, from the same times as the picture: a click when a message leaves, a pop when a charge lands, a drop
when a reply is lost, a tock when the timer runs out, a thump under the failure stamp, a snap when the key appears, a
tick when a key is saved or found, a land under the success stamp, a chime when the client is paid; nothing on pop-ins
and wires, and quiet under the last step so the cost lands. Pan by where the box sits (client left, keys right). The
specimen declares 13 cues in 12.5 s (about 10 per 10 s). A soft bed at 96 BPM, or none: the atlas's best example was
silent and lost marks for it, so give it at least the cues.
