# One generative system (`swarm`)

One population of particles carries the whole film and never cuts. A murmuration of strokes rolls across a dusk sky,
spreads into an estuary map whose roosts are joined by flight lines, stacks into a histogram of arrivals after sunset
and settles into a wordmark. Every picture is the same particles rearranged, each on its own delay and bent path. One
particle in the accent colour is in every picture until it perches on the last one.

- **Built:** yes. Module `looks/swarm.js`, specimen `specimens/swarm` (1920 x 1080, 30 fps, 11.1 s, 7,500 particles,
  five bars at 108 BPM). Every morph takes two beats, and the map, which carries five names, holds for a full bar.
  Measured on an M1 Pro: 68 ms a frame. The delivered clip uses 2 sub-frames of motion blur and took 133 ms a frame
  (one worker, capture and encode included). There are two versions: `swarm-specimen.mp4` is silent, and
  `swarm-specimen-sfx.mp4` has its soundtrack (10 cues, effects only, -14 LUFS).
- **Best for:** data stories where one set of things (people, birds, messages, orders) is shown several ways;
  analytics, network and AI product launches; brand idents that assemble a wordmark. 8-20 s, 16:9 or square.
- **Engine:** canvas (`mode: 'canvas'`), Canvas 2D only, no WebGL. Cost to make a film: M (three to five formations,
  each a small builder of point sets). Layer-order risk: low (one batched layer of strokes, type above it).
- **Atlas:** look 20, "One generative system" (6 videos, average 6.5, top 8). Best example:
  [ismailfahmi-557268](https://prompt-motion.com/ismailfahmi-557268), one swarm re-forming into a network, a spike chart
  and a wordmark in 15 s with no cuts.

## What it is, and isn't

It is one system with continuous identity: the same N particles in every frame, none added or removed, and every
transition a re-formation. Each formation states one thing (a quantity, a place, a relation, a name). It isn't a
particle effect behind other content, a burst on a click, a particle sphere with orbit rings, or a screensaver with no
story. Type stays crisp and separate; only the wordmark is spelled in particles.

## Materials and palette

- Default: ink on a pale ground. A dusk gradient (`#D9D5DC` to `#F0DCC9`) darkens a little towards `S.dusk` over the
  film, for the story's passing evening. Ink is `#191820`, and one accent, `#C9391B`, marks the through-line particle
  and its labels. Four colours in all.
- Ink on pale is the hard mode. Where strokes cross they darken, so a dense crossing reads as pencil scribble. The
  defaults keep it in check: streaks are capped at 18 px (`S.cap`), and fast strokes (4-20 px) fade to 45% of their
  opacity (`S.thin`), so a mass in flight reads as a haze of birds. The matching keeps paths from crossing in the
  first place (see Motion grammar).
- Glow variant, sketched on a 4-frame sheet and not rendered as a clip: `P.swarm = { sky, dusk: navy, ink: '#7FD6E8',
  accent: '#F2B84B', blend: 'lighter', alpha: [.25, .55], cap: 64, fade: 30 }`. Additive blending keeps dense
  overlaps reading as light rather than scribble, so `S.thin` is ignored there and longer trails are safe.
- Strokes come in two widths (1.3 and 2.25 px) and four opacities, which reads as depth. In still formations each
  stroke takes an engraved direction: along the line it was sampled from (coast, creek, axis), vertical in bars, one
  diagonal in letters, drifting slowly on a noise field. Light grain (`grain(.035)`).
- The through-line particle sits in a 3 px ring of the ground colour, taken from the dusk mix `SW.sky(k)` drew this
  frame at the particle's screen height, so it shows only over ink.
- Banned: glow orbs, spheres with orbit rings, parameter readouts, a "mentions analysed" counter or any count-up
  digits, rainbow particle colours, corner telemetry.

## Type

- Captions: Space Grotesk 500 at 48 px (1080p), bottom left, words landing one after another (`SW.caption`). Use
  three words or so. A caption needs about 1 s plus a second for every three words once it has landed, so let it
  start as the flock leaves for its formation and end just after the formation's labels go.
- Labels: Space Grotesk 500 at 30 px (`SW.label`), never under 28. Put them where no flight line arrives (above
  inland nodes, below the rest). The accent label is weight 600 in the accent colour and follows the through-line
  (`SW.at`).
- A formation that carries labels needs to hold for about a bar (2.2 s at 108 BPM). Five two-word names plus a
  caption can't be read in half a bar, so the specimen's map holds for a full bar and the label-free chart for half.
- Wordmark: particles sampled from Fraunces 800 at 300 px (`SW.textPoints`). Once they land, a fill of the same type
  fades to 70% under them, so the mark reads crisp and the strokes stay as texture. Register it with `SW.read`, since
  the checks can't see particles.

## Motion grammar

- Formations are point sets with motion. `still` points hold and let their strokes drift; `orbit` clusters circle
  their centres (roosts, hubs); `stream` particles flow along edges and fade at both ends; `ribbon` is the
  murmuration.
- The ribbon: two travelling waves on its centreline, a ripple and one slow lobe that drifts along the sheet (so the
  flock is lopsided, a dense ball and a thinner tail), and a twist that pinches to a dark seam where the sheet turns
  edge-on. Its frame (normal and curvature) comes from points about 80 px either side along the centreline, and inside a
  tight bend the whole inner half narrows evenly. A sheet wider than the bend's radius would otherwise fold into a
  hard crease, and clamping single particles piles them into a line.
- Matching (`match: 'split'`, the default) is recursive median bisection. The old and new point sets are both cut at
  the median along the longer side of their joint extent, and each half is matched to its counterpart, down to single
  points. Each part of the old picture fills the nearest part of the new one. Four passes of 2-opt swaps between
  neighbours then remove most crossings left along the cuts (`uncross`). On the specimen's map-to-chart morph, mean
  flight is 278 px against 383 with Hilbert-rank matching (`match: 'hilbert'`, kept for comparison), and about 6.5
  times fewer paths cross.
- Each particle leaves on its own delay (`stagger`: by x, y, radially, at random or by a function of target and
  source), spread over 35% of the window. It travels on a gentle in-out whose peak speed is about 1.9 times the mean,
  along a quadratic path bowed sideways by a coherent noise plus a per-particle jitter, so the mass shears a little
  in flight instead of moving in rigid tiles. A flow-field wander peaks mid-flight.
- A dense source needs a density-aware stagger. The specimen's Old Pier roost holds about 1,070 particles in a 64 px
  disc with four streams arriving. Its stagger mixes target x (60%: the chart builds left to right) with distance
  from the roost (40%: it unspools from the outside in), each normalised to 0..1, so the roost never leaves all at
  once.
- A departing particle keeps its old motion for .28 s, decaying, so leaving a moving formation never jerks.
- Streaks are the distance travelled in the last .028 s (two evaluations, no history), capped and thinned as above.
  They blend by speed into the idle stroke, so the material never vanishes in a hold.
- The through-line particle has its own timing per key (`tag`). In the specimen it reaches Old Pier a beat after the
  flock, marks the chart's peak before the flock arrives, and is the last one home, perching on the wordmark's l and
  settling with one small hop, so the final hold isn't still. In a ribbon it is pinned (`pins`): it advances with the
  sheet but stops at u = .85, short of the head, so it never fades out or wraps however long the flock holds.
- Leave on a beat and land two beats later. Hold a formation for at least half a bar, a full bar if it carries
  labels, and the wordmark for two seconds.

## Camera

Mostly none: the formation does the moving. The specimen pushes in 3% over the whole film, so line formations (a
coast, a creek) stay at least 120 px inside the frame at the end of the push. To track the through-line,
`SW.at(SYS, 0, t)` gives its position; follow it on a `smooth` spring, never rigidly.

## Recipe

1. Write the story as three to five formations, one sentence each. Choose N (5,000-8,000 at 1080p) and whether one
   particle carries the story (`tags: 1`).
2. Write each formation as a builder that returns `SW.formation([...parts])` with exactly N points. Put the
   through-line's seat first (`SW.still(SW.one(x, y), { len: 0 })`), then parts from the samplers: `SW.textPoints`,
   `SW.maskPoints` (any path: a logo outline, a country), `SW.rectPoints`, `SW.linePoints`, `SW.arc` with
   `SW.stream`, `SW.orbit`, `SW.ribbon`. Split counts with `SW.shares(N - 1, [...])`, which always sums exactly. A
   custom part is just `{ n, at(j, t, tRef, out) }` writing `x`, `y`, `ang`, `len` and `a` (the specimen's perch).
3. `KEYS = [{ t: 0, f: first }, { t: tb(4), land: tb(6), f, stagger, from, bend, drift, tag }, ...]` and
   `SYS = SW.system(N, KEYS, { tags: 1 })`. Builders run once, on the first frame, after the fonts load. Where a
   formation has a dense cluster, give the next key a stagger function, for example
   `(X, Y, sx, sy) => .6 * clamp((X - x0) / w) + .4 * (1 - clamp(Math.hypot(sx - hub.x, sy - hub.y) / span))`.
4. Draw the shot: `SW.sky(k)`, then the camera, the wordmark's fill, `SW.draw(t, SYS)` and labels (timed from the key
   times, or from `SW.landed(SYS, k, t)`). Call `SW.read` for the wordmark once it has landed. Then, outside the
   camera, `SW.caption` and the tagline. A film that paints its own ground instead of `SW.sky` passes
   `SW.draw(t, SYS, { k })` or sets `S.halo: 0`.
5. Declare cues from the KEYS with video-sound's anchors: a whoosh at a morph's velocity peak, `(k.t + k.land) / 2`;
   a land at each `land`; a riser that ends .2 s before the wordmark's land, then the hit on it; a pop at the
   through-line's `tag.land`.
6. Check with `--sheet --w=480` (feed size: does the flock read as birds?), then a `--strip` across each morph and
   full-size stills mid-morph. Then `--onion` on the through-line's last flight, `--inspect`, `--determinism`, and
   finally `--clip --subframes=2`. Pull a mid-morph frame out of the MP4 itself (`ffmpeg -ss <t> -i clip.mp4
   -frames:v 1`), since that is what viewers see.

## Failure modes and checks

- Hairy morphs: a mid-flight still reads as pencil scribble, or a dense source knots into a black hairball. The cause
  is crossing paths stacking ink. Keep `match: 'split'`, give dense sources a density-aware stagger, and keep
  `S.thin` and `S.cap` at their defaults on a pale ground. If it persists, lengthen the window. Raising `spread`
  makes it worse, because each particle then has less time to fly. Judge full-size stills and a frame from the MP4.
- Brushstroke flock: a thin, tapered ribbon reads as an eyebrow or a brush mark at feed size. Keep `width` at 230 or
  more with a `lobe` of about .5, keep a few stragglers, and check with `--sheet --w=480`.
- Creases in the flock: a hard line through the sheet. The ribbon's wide frame and even inner narrowing prevent it;
  if a custom ribbon shows one, lower `amp` or `lobe` rather than clamping particles.
- A halo that shows on clear ground: the through-line's ring is matched to the ground `SW.sky(k)` drew this frame. A
  stale value from another frame is ignored, so a film without `SW.sky` must pass `k` or turn the halo off.
- Fonts: a formation sampled from type before the fonts load samples a fallback face. Builders run lazily on the first
  frame for this reason; add the face to `PROJECT.fonts` too. `--determinism` catches it.
- Counts: a formation with the wrong count throws ("formation k has n points"), and so do overlapping windows (a key
  that starts before the previous one has landed). A formation can have up to 65,535 parts and a stream up to 65,535
  paths; beyond that both throw.
- Small subject: a formation should span 50-80% of the frame's width. A small swarm in a big empty frame is the
  look's commonest failure in the atlas.
- Reading time: two-word labels need about 1.7 s readable, so fade them in as the formation lands and out as it
  leaves. `--inspect` flags any that fall short.
- Wraps: cyclic parts count their laps from `tRef`, so a streak never spans a wrap. A custom part must do the same.
- Cost grows with N: 7,500 particles cost about 68 ms a frame, sub-frames multiply it, and building the system (the
  sampling and the matching for every key) adds about 0.3 s to each page's first frame.

## Sound palette

Effects only, `soft` palette, tuned to D minor, about 9 cues per 10 s. Wings bloom in and stop as the first caption
lands (a swell). A soft whoosh peaks mid-flight on the first two re-formations; at most two whooshes a film, since
the re-formations are the film's only moves. A soft land follows as each formation arrives, and a small tick when
the straggler reaches its roost. A riser runs through the flight into the wordmark and stops .2 s before it, leaving
a moment of near-silence, then a hit on its landing. A pop marks the through-line perching, and a softer tick its
hop. The specimen's master measured -14.0 LUFS, -1.5 dBTP (-1.47 after AAC), with 2.1 dB of limiting and every
percussive cue within 0.3 ms of its frame. A sparse pulse at the film's BPM would also suit it. Or the picture can
make the sound (a tick for every particle landing in a bar), which the atlas found reads as causal and never out of
sync.
