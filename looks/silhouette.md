# Silhouette shadow theatre (`silhouette`)

A paper shadow play on a curtained stage: flat black cut-outs of a town (houses, lamps, a cart, a walking figure, a
rooster, birds) in parallax layers against a sky that moves through the times of day, with captions on a paper card
hanging from the flies. Light is the plot. A lantern, a doorway, windows, lamps and the sun come and go on the story's
beats, and the curtains open and close as the bookends.

- **Built:** yes. Module `looks/silhouette.js`, specimen `specimens/silhouette` (1920 x 1080, 30 fps, 10 s, 4 bars at
  96 BPM, one take). Measured on an M1 Pro at load average 11-12: 74 ms a frame for a whole `--clip` (drawing,
  capture and H.264 encoding in one worker, no sub-frames), and 151 ms in a second run that shared the machine with
  other renders. The first build reported about 42 ms a frame, conditions unrecorded.
- **Best for:** story shorts, tribute and memorial films, brand stories (a shop, a maker, a place), poems and quote
  films, lyric pieces. 8-60 s at 16:9, a stage that pans. A locked 9:16 proscenium should work (the curtains, valance
  and card size themselves from the frame), but it is untested: check the card's width and the curtain gap first.
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: S-M (lay the set out along one street and write the light
  cues; the figures, buildings, sky and curtains come from the kit). Layer-order risk: medium. Everything is the same
  black, so an ordering mistake stays hidden until something lit (a lantern, a doorway, a lamp) crosses something else.
- **Atlas:** look 2, "Silhouette shadow theatre" (2 videos, average 6.5, top 7). Best example:
  [x4b47x-9cc84f](https://prompt-motion.com/x4b47x-9cc84f).

## What it is, and isn't

It is one stage seen through a proscenium, with very few words and light doing the acting. Pure black shapes with no
interior detail: a face is a profile (a nose and a chin), a window is a hole that lights up. It is not a flat-vector
storybook (no shaded characters, no expressions), not a montage (one take, or acts joined by the closed curtain), and
not a starfield title card. The atlas's tells to avoid: a widely tracked serif title over the night sky, a lighthouse
keeper (and a heroine named Mira), and figures that only stand there. Give each figure real actions with its hands and
feet: walking somewhere, pushing a door and stepping in, turning (a puppet's flat turn), a bow at the curtain call.
Build the set from the story's own props (the specimen's bread cart, rooster and sold-out window) rather than the
genre's stock ones (a bare tree full of birds, two matching lamp posts, a windmill).

## Materials and palette

- Silhouettes in one warm near-black ink (`SIL.S.ink`, `#120C11`). Layers further back fade toward the sky's horizon
  colour (`SIL.tint(depth, sky)`), so depth reads as haze, not as outlines.
- The sky comes from a table keyed by the hour (`SIL.skyAt(hour)`: top, middle and horizon colours, plus `night`
  and `sun` levels; `SIL.skyCol(c, y)` gives the colour at a screen height). Night is deliberately lifted off black
  (indigo `#171D4A` to violet `#4C3F78`). Dawn runs through rose to apricot, and morning is pale gold under a soft blue.
  Stars twinkle by seeded noise and fade with `night`. The moon is a clipped crescent and the sun a disc with additive
  halos; the disc only shows once the hour passes about 5.8 and is fully opaque from 6.9.
- One light colour: amber `#FFB04A` with a pale flame `#FFE3A6` at the centre of every lit pane. Glows and ground
  pools are additive radial gradients (cheap; no blur filters, no `shadowBlur`).
- Smoke is opaque paper too: each puff is two or three seeded lobes filled as one shape, its ink mixed toward the sky
  behind it as it ages, and it shrinks away at the end. Overlaps read as stacked paper, never as translucent discs.
- The proscenium: oxblood velvet (`#5E1720`, folds in `#330A12` and `#7C2731`), a scalloped valance and a brass
  tie-back (`#C08A45`). The caption card is cream paper `#EFE3C6` with a faint seeded fibre texture, a thin inner rule
  and dark ink.
- That is four colours: ink, amber, velvet and paper, plus the sky as the clock. Banned: outlines, gradients on the
  cut-outs, more than one light colour, neon, lens flares, a glowing orb.
- A film restyles all of it from its config: `PROJECT.silhouette = { ink, amber, flame, dim, paper, paperInk, cord,
  curtain, curtainDark, curtainLight, trim, font, ground (the street's ground line, a fraction of H, default .835),
  haze (how far the furthest layer fades toward the horizon, default .8) }`. Any key left out keeps its default.

## Type

Captions only, on the hanging card: Fraunces at weight 500, 54 px at 1080p, centred, at most about six words, one card
face at a time. The card is the only place text goes; nothing is written on the set. Shop signs are emblems (the kit
has a pretzel). No title card, and no tracked-out caps. Change the face with `PROJECT.silhouette.font` (an engine font
only). `SIL.card` registers its text for `--inspect` only once the card has dropped into place and faces the viewer
flat. A four-word face needs about 2.3 s fully up, and every face should say something the picture then shows (the
specimen's "Sold out by nine." is followed by the window emptying loaf by loaf).

## Motion grammar

- The camera is locked or drifts slowly. Big changes are light changes: a pane catches with a short flicker
  (`SIL.light(t, on, off)`), a doorway glows, a lamp fades out over .3 s. Each one is a beat. Leave a dark beat
  (about .4 s) before the turn of the story.
- The sky changes in one deliberate eased ramp (`EASE.inOut` over four to eight beats) with holds either side. A slow
  continuous drift reads as a colour error, not as time passing.
- Walking is distance-locked. `SIL.gait(d, h)` plants each foot where it lands and solves the knees by two-bone IK, so
  feet never slide. Hips bob twice a stride, arms counter-swing, and a carried lantern swings at step rate.
  `SIL.travel` gives constant speed with an ease-out stop. When a figure stops, the foot carrying the weight stays put,
  the other comes down beside it, and the hips settle over both: end a walk at `SIL.stopX(...)` and nothing slides.
- Figures act with their arms (`look.arms`, blended in and out of the walk's own swing), step into a doorway by
  shrinking 3-4% and stepping up onto the sill (`look.scale` and the walker's `y`), and turn round the way a shadow
  puppet does, flattening to a sliver and opening the other way (`SIL.turn`).
- Small things stay alive in every hold: smoke puffs (`SIL.smoke`), trees and grass sway, stars twinkle, the shop
  sign swings, a roosting bird breathes, perched birds peck before they lift.
- One cause, one effect: the sun clears the hills, the rooster crows (`SIL.rooster`: chest up, neck stretched, beak
  open), and the birds on the next roof lift a fifth of a second later. Derive the times from the sun's own curve.
- The curtains move on a spring (`SIL.CURTAIN_SPRING`: about 1.1 s to shut, no overshoot) and their folds bunch as
  they gather. The card drops on a springy cord (`SIL.CARD_SPRING`), swings to rest, and changes text by flipping over
  at its top edge, never by crossfading.
- Birds lift one after another (a stagger of .07 s), flap at 6 beats a second, and shrink a little as they fly off.
  The downstroke stops with the wings level and a forked tail trails, so a bird never reads as a blob.

## Camera

`SIL.stage(t, { cam: [x, zoom] })`. A layer at depth d moves d times as far as the street (1) and zooms
1 + (zoom - 1) x d about the ground line, so the sky stays put, the far town barely moves and the grass row (1.35)
slides past fastest. Pan with `EASE.inOut` while the figure walks, at most one slow push (+5%), and end with the last
subject at the frame centre, because that is where the curtains meet.

## Recipe

1. Write the story as light: which light comes on or goes out on which beat, and where the hour ramps. Lay it on a
   beat grid whose bars fill the film (96 BPM gives four 2.5 s bars in 10 s), and render `--beats` first.
2. Lay out the set along the street in world x (depth 1): houses (`SIL.house`), a lamp (`SIL.lamp`), the story's
   props (`SIL.cart(L, x, { load })`, a bare tree `SIL.tree` only if the story needs one), a fence (`SIL.fence`), a
   sign (`SIL.sign(x, y, s, t, SIL.emblems.pretzel)`). Work out the camera's last x so the final subject sits at the
   frame centre, and put the sun and moon (screen space) where nothing on the set will cover them.
3. Build the stack in `SIL.stage(t, { hour, cam, sky: { moon: [x, y, r], sun: [x, y, r] }, layers })`: a far ridge
   (`SIL.ridge`, depth about .12), the town (`SIL.town`, about .3, its windows waking through `wake: [t0, t1]`), the
   mid hills with round trees (`SIL.ridge` + `SIL.roundTree` at `SIL.ridgeY`, about .55), the street (1), and grass
   (`SIL.grass`, above 1). Layers are drawn sorted by depth, then by `z`.
4. Inside the street layer, draw back to front, explicitly: ground, back houses, fence and props, the hero house, sign,
   smoke, animals (`SIL.rooster` on a ridge, `SIL.flock` on `SIL.roofPerches` or `SIL.treePerches`), walking figures,
   then lamps nearest the viewer. A figure going through a door is drawn in that house's `inDoor` hook (after the
   doorway light, before the door panel). Switch it there by time, once it stands still in the open doorway.
5. Figures: `SIL.walker(t, { keys: [[t0, x0], [t1, x1, { accel, decel }], [t2, x1], [t3, x2, {...}]], h, step, y,
   look: { hat, coat, build, carry, scale, arms } })`; equal x in two keys is a pause. End each walk at
   `SIL.stopX(x0, x1, h, step)`. Make it act with `look.arms: { far: [th, bend, k] }` (th from hanging down, about
   1.45 straight ahead; k 0..1 blends from the swing; the near hand holds a lantern, so push, wave or give with the
   far one). For a figure at rest take `SIL.stand(h, { lean })` (a bow is lean .4-.5 from the hip, with
   `arms: { near: [-.35, 1.33], far: [-.95, .25] }` for a curtain call) and draw it with `SIL.figure(x, y, g, look)`;
   turn it with `look.dir: SIL.turn(t, t0, .3)`. A door that a figure pushes hinges on the far side from it
   (`door: { hinge: 'right' }` for one walking in from the left).
6. Drive window and lamp `on` from `SIL.light(t, on, off)` (it catches with a flicker). A door's `light` and a
   figure's `lanternOn` take any 0..1 ramp: the specimen warms the doorway as the lantern steps in and ties the
   lantern to the door as it shuts.
7. On top: `SIL.curtains(follow(t, keys, SIL.CURTAIN_SPRING))`, `SIL.card(t, [{ t, text, id }, ...], { y })`, then
   `SIL.finish()` (vignette and grain). Start the curtains opening just before t = 0, so frame 0 already shows the stage.
   Keep the close in one constant (`CLOSE`) used by the curtains and its sound cue; it must start at least 1.1 s before
   the end, and the last action must finish within about .5 s of it.
8. A longer film in acts: close the curtains (`[tA, 0]`), hold them shut for a beat, change what the layers draw by
   time (a new hour, a new street, a different camera x), and reopen (`[tA + 1.5, 1]`). Each act is still one stage;
   the card can flip during the closed beat. Cut nothing.
9. Declare sound cues from the same constants the picture uses (see the specimen's `SHOP_ON`, `OPEN`, `CLOSE`, the
   `CROW` it derives from the sun's curve, and `springAt` on the card and door springs).
10. Check: `--inspect --out=out/<film>/inspect.json`, `--determinism`, a `--strip` of each walk's stop cropped at full
   size, a strip of the ending at `--fps=10`, `--stills` of the last frame (the curtains shut), then `--clip`. The
   look is crisp cut paper, so sub-frames are optional.

## Failure modes and checks

- **Underexposed night.** The commonest fault in the atlas. The sky table keeps night indigo, and haze on the far
  layers carries the depth. Check the first night frame at full size, not on a sheet.
- **Black hides layer bugs.** A figure drawn behind a closed door looks fine until its lantern disappears. Draw it in
  front until it reaches the open doorway, then in `inDoor`. Stop drawing it once the door shuts, or its glow stays
  outside the house.
- **The sun never shows.** It sits behind the ridges, the far town's roofs and anything on the set. The first build
  rose it behind a lamp, a tree and then the closing curtain. Put it in clear sky, find the moment its disc clears the
  skyline (`SIL.ridgeY` at its x, and the town's roofs up to about 100 px above the town's base), and keep it clear for
  at least a second before the curtains reach it. Its opacity follows the hour, not its height.
- **The curtains close on the frame centre.** If the last action happens off-centre or late (a bow, a wave), the
  curtains hide it. The first build started its bow after the close and lost the rise; finish the action within
  about .5 s of `CLOSE`, at the centre.
- **Heads leave the doorway.** Black on a black wall vanishes. A figure bowing in a doorway must keep its head inside
  the lit arch: stand it to the side away from the bow.
- **Emblems and heads misread at film size.** The first pretzel read as spectacles, and the first head merged into
  the torso and read as a hooded column. Crop at 2x (`--sheet=... --crop=...`) and look.
- **Card text off-frame.** Text on a card that is still dropping counts as on screen. The kit registers it only once
  the card has landed and faces flat; keep that rule if you change the card. `--inspect` cannot see occlusion, so
  keep the card in front of the curtains.
- **Feet slide when a figure stops.** Fixed in the kit if the walk ends at `SIL.stopX`; any other end x can leave a
  wide stance that settles quickly. A step into a doorway is one more half stride with its own `accel` and a `decel`
  of about .45 s, so the trailing foot has time to come up.
- **Strobing wings.** Over about 6 wingbeats a second at 30 fps the flap aliases; keep `flap` at 6 or below.
- **Reading time.** One card face at a time, at least 2.3 s for four words. A flip takes .5 s, and inspect passes it
  because the text is only registered while the card faces flat.

## Sound palette

Sound design over a quiet bed, as in the atlas's narrative shorts: a music box or plucked strings, a soft pad, or
nothing but room tone. Use velvet swishes for the curtains, a paper tick when the card lands, a muffled wooden thud for
the door, two warm pops (or a match strike) as windows light, a slow swell under the sunrise, the rooster's crow (cued
as `chime`: use a real crow or a bright two-note in its place), a short wing flutter for the birds and a shop bell. No
footsteps, nothing on the loaves selling or the lamp going out. Leave near-silence in the dark beat between the door
shutting and the first window: it is the film's turn. The best example was mixed very quiet (mean -25.8 dB), so master
to -14 LUFS for feeds with -1.5 dBTP.
