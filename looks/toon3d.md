# Toon-shaded 3D diorama (`toon3d`)

A small toy world built from primitives and lit like the end of a day: a floating island, a bench, a lamp, and one
character with a painted face who has a small job to do. Materials are toon-shaded in three hard bands with ink outlines.
A low golden-hour sun throws long soft shadows and a warm rim round every silhouette. At dusk a cool moon key takes over
so the bands stay. The sky is painted like an anime background (cumulus towers the sun sets behind, a cloud sea, stars
at dusk) and stays nearly sharp behind a soft middle ground. The camera floats round the set on springs with a shallow
depth of field. The character acts on twos while the camera, light and clouds move on ones.

- **Built:** yes. Module `looks/toon3d.mjs` (the three.js half) with `looks/toon3d.js` (the classic half: namespace,
  timing, camera rig, 2D bubbles and captions), specimen `specimens/toon3d` (1920 x 1080, 24 fps, 10 s, 4 bars at 96
  BPM, one take). Measured on an M1 Pro: 115 ms a frame in the clip run (240 frames in 52 s wall time, including the
  browser launch), no sub-frames. The first frame takes about 1 s while the shaders compile.
- **Best for:** mascot ads, micro-story ads where a product (or a character standing in for it) does one small job, a
  product given eyes and a mouth (`K.face`), kids' content, a warm brand ident, a cosy end card, a loopable "living
  diorama" for a site. 8-20 s; 16:9, or 4:5 and 9:16 with a closer camera.
- **Engine:** three.js 0.186.1 and postprocessing 6.39.5 as ES modules (film.html's import map), WebGL in headless
  Chrome on the GPU (`PROJECT.gpu = true`). Cost to make a film: L (block the set, the acting and the camera; the kit
  supplies the materials, outlines, light, sky, mascot, faces and props). Layer-order risk: medium. The depth buffer
  orders the 3D, but bubbles and captions are 2D on top and must be placed from projected points, and a shadow falling
  across the hero reads as the hero going see-through.
- **Atlas:** look 3, "Toon 3D diorama with an eyed mascot" (4 videos, average 6.0, top 8). Best example:
  [anas0ra-e57aea](https://prompt-motion.com/anas0ra-e57aea).

## What it is, and isn't

It is one small lit set, a character with a face, and one clear action that changes the light or the state of the set.
The warmth comes from the light and the acting, not from detail. It is not a cinematic 3D landscape (no realistic
materials, no lens flares), not a product-on-a-turntable hero shot, and not a full cartoon with blobby humans (the
atlas's weakest member). Keep the cast to one character, or two at most. Atlas tells to avoid: bloom on everything,
murky purple-on-black frames, the camera clipping into the set, a hero too small to find, text laid over the subject, a
lighthouse keeper (or a heroine called Mira), and "rendered live with three.js" credits.

## Materials and palette

- Toon materials: `MeshToonMaterial` on a 3-texel `NearestFilter` gradient map (`TOON.S.bands`, default
  `[.34, .7, 1]`), so direct light falls off in hard steps. Every toon material gets a hard-edged rim on the key's side
  (`S.rim`, .45 for props, 1.1 for the mascot). It follows whichever key is stronger: warm from the sun at golden hour,
  cool from the moon at dusk. When the sun is behind the subject the rim wraps the whole silhouette, which is what makes
  a backlit set read as golden hour.
- Ink: a warm plum (`#2B1D33`), never black. Outlines are inverted hulls pushed out in view space, so a line is
  `S.line` px wide (2.6 at 1080p) near and far. Hard-edged geometry has its vertices merged before the push, so the hull
  doesn't split at corners. `mesh(..., { line: .6 })` thins it for small props, and `line: false` turns it off.
  `inkPush` moves a hull back along the view ray, so a cluster of balls (a tree's canopy, which uses it by default)
  keeps its outer line and loses the arcs where its balls meet.
- Light: a directional sun with soft PCF shadows (`PCFShadowMap`, radius 3.2, 2048 map), a cool moon key (`#A9B4FF`,
  1024 map) placed by `K.moonAt(az, el)`, and a hemisphere fill. Both keys cast shadows all film long: switching
  `castShadow` mid-film recompiles every material. The sun disc in the sky and the light are placed together by
  `K.sunAt(az, el)`, but the light comes from 9 degrees higher (`lift`), so faces still catch it as the disc touches
  the horizon. Fog for depth.
- The day: `K.daylight(d)` blends a table from golden hour (0) through sunset (.5) to dusk (1): sky gradient, sun colour
  and strength, moon strength, fill colour and strength, fog, cloud colours and star strength. The moon is 0 until
  sunset and 2.2 at dusk, and the fill drops from 1.45 to .85, so a night frame keeps its bands and stays readable.
- Palette of the specimen: sage and teal greens (grass `#8CC06A`, foliage `#4F9A72`), terracotta and wood (`#C98B5F`,
  `#C2704A`), warm grey stepping stones (`#B9A48E`), a cream hero (`#FFF3E2`) with pink cheeks, plum ink, and one amber
  practical (`#FFC46B`). The sky carries the time: peach, gold and lavender, then violet and rose. Four families.
- The sky is painted, not built: a gradient, the sun disc and halo, high streaks, a streaked cloud sea below the horizon,
  two banks of cumulus on the horizon, and stars. The far bank has two rounded towers, and the sun sets between them.
  Its top edge is one continuous skyline in hard toon bands (lavender, a paler band that turns peach toward the sun, a
  thin warm rim). The near bank is one flat shade sunk toward the sea haze. Stars are drawn in the sky before the banks,
  so a bank hides the stars behind it. The depth of field gives the sky at most `S.dof.sky` px of blur (1.5 at 1080p),
  so the bands and stars read like a painted backdrop. `K.skyClouds({ bank, towers, streaks })` reshapes the clouds and
  `K.skyDrift(r)` slides them. `K.clouds()` makes 3D puffs. Use them only near the set (under a floating island), where
  parallax helps; they lose their sun side by dusk.
- Emissives: `K.glow(color, k)` pushes a colour past 1, so the bloom (threshold .92) catches only lit bulbs and the
  sun disc.
- Faces: painted once per key on a canvas and swapped by key, never repainted during a frame. Keys: `open`, `wow` and
  `grit` (determined: lids cut flat, a set mouth), each with a look `:l :r :u :d` (the eyes shift about a third of
  their spacing, so a glance reads on screen), plus `blink`, `shut` and `happy`. The default mascot paints them onto
  its ball. `K.face(parent, o)` puts the same faces on any object as a decal, and `K.paintFace(key, o)` returns one
  texture. Banned: realistic textures, metal and glass, bloom on toon colours, more than one practical light colour.

## Type

One book serif, Fraunces 600, for captions and dialogue alike (`TOON.caption`, `TOON.bubble`). Captions sit in clear
sky, never over the hero or a dark canopy, at 66 px (1080p). Their colour follows the light: plum ink with a cream glow
over a gold sky, cream with a plum shadow over dusk. Words land one by one (draw.js `words`) and the line eases out
over the next action. A line of four words needs about 2.4 s from its last word landing. Speech bubbles are cream with
a 3 px plum outline and Fraunces 700 at 46 px. They pop on a soft spring with their tail pointing at the speaker's head
(`K.project`) and keep 6% clear of every edge. One line per caption, at most five or six words, and something exact or
funny: "The sun clocks off." / "Someone has to do nights."

## Motion grammar

- Acting on twos: read every character pose at `TOON.two(t)` (a new drawing every 2 frames at 24 fps). Camera, light,
  clouds and foliage sway use raw `t`, so the world moves on ones and the acting snaps like stop motion.
- Hops are the locomotion: `TOON.hop(t, { t, dur, from, to, up, anticip })` gives the position and a squash-stretch
  `sy` (volume kept): crouch, stretch at take-off, a little hang at the apex, squash on landing, a settle of about .3
  s. Chain them with `TOON.hops(t, list)`. A leap over a prop, a jump for a cord, three hop-steps across the set with a
  stepping stone under each landing.
- Block the path toward the camera. A character hopping away from us is an egg with no face. Route it across the
  frame and slightly toward us, so it is seen 3/4 front (30-50 degrees off the camera) for the whole move.
- Turns ride `follow()` on the snappy spring over the pose clock. A turn of 150 degrees or more reads as "turns round".
- Gesture for the back view: when the hero has its back to us, give it an arm action (the specimen waves the sun off)
  and a sway, since its face can't act.
- Faces carry the beats: `open` while watching, `wow` on the surprise, `open:u` looking up at the goal with a lean back
  (`lean` negative, `sproutX` following), `grit:u` for the effort, `happy` on the payoff. Blink once or twice in a hold.
- Something alive in every shot: a sway, a nod on each beat (`pulse`), the sprout's lag (`sprout` follows `sy`), the
  canopy swaying on seeded noise, the sky drifting, the sun moving.
- Light is an actor. The specimen's organising idea is a handover: the sun sets, the creature lights the lamp, and the
  lamp becomes the light. A practical that flickers on (on, off, on, then a ramp) lands better than a fade.

## Camera

`TOON.rig(t, keys)` is a camera on a critically damped spring (`S.camSpring`, settling in about 1.5 s). Keys are
`{ t, az, el, dist, at, fov, spring }` in degrees, orbiting `at`, and a key may change one field (a push, a rise). A
key's own `spring` changes how it travels: a slow critically damped spring (`{ stiffness: 2.5, damping: 3.16 }`, about
3.7 s) turns a key into a push that lasts the whole shot instead of a move that is over in a second. A slow seeded drift
keeps a hold breathing. Plan one move per bar: a slow push and arc while the sun goes, an orbit round to meet the
action, a low angle looking up at the payoff (`el` below 0), and a pull back to a wide for the reveal, started early
enough that the settled wide holds for about 2 s. Focus: set `c.focus` each frame from the hero's continuous path (not
its twos), and blend a rack to the payoff object over it (`kf(t, RACK)`). The depth of field is the look's own
one-pass, depth-aware bokeh (`S.dof`: `range` world units held sharp, `blur` px, `sky` px for the backdrop). Keep the
camera near level whenever the sun is in shot: pitched down by 7 degrees, a sun 5 degrees up sits near the top of the
frame.

## Recipe

1. Write the story as four beats on the bar grid (96 BPM gives 2.5 s bars): a setup holding on the hero and the
   object that will matter, a turn (the light changes), the action, and a payoff with the reveal. Decide the organising
   idea before any code: what changes, and why it's the hero's job.
2. Manifest: `['looks/toon3d.js', 'specimens/<id>/scene.js', 'looks/toon3d.mjs']`. Config: `fps: 24`, `gpu: true`,
   `mode: 'canvas'`; override look settings with `PROJECT.toon3d`. The merge is shallow, so a nested group is replaced
   whole: write `dof: { range: 2.6, blur: 8, sky: 1.5 }`, not just `dof: { blur: 8 }`.
3. Block the set in `TOON.build(K => { ... })`: `K.island`, `K.tree`, `K.bench`, `K.lamp`, `K.bush`, `K.mascot`, and
   anything else from `K.mesh(K.G.box | ball | capsule | cyl | cone | lathe | rock, colour, { at, rot, scale, line })`.
   Derive every position the acting uses (where it sits, where it lands, where it stands under the cord) from the
   props' constants, so moving a prop moves the blocking with it. Keep the hero and the payoff object clear of each
   other on screen, and leave clear sky where the captions go. Seed scattered detail from `rnd(seed)`.
4. Light it: `K.moonAt(az, 40)` 45-90 degrees to one side of the camera for dusk (the specimen's moon, az 100, is
   44 degrees off the crossing camera and 74 off the end wide's).
5. A product with a face: `K.mascot({ shape, body })` takes any body (it gets feet, arms and a decal face), and
   `K.face(object, { at, size })` puts a face on a plain prop. This is the code that rendered the check frame:

   ```js
   const phone = K.mascot({ at: [-.75, 0, 0], ry: .25, r: .42, tall: 1.45, shape: K.G.box(2, 2, .7, .45), body: '#8FC8E8', sprout: false });
   const cup = K.mesh(K.G.lathe([[0, .6], [.44, .6], [.46, .55], [.4, 0], [0, 0]]), '#F4E6D4', { at: [.8, 0, .1], rot: [0, -.3, 0] });
   const eyes = K.face(cup, { at: [0, .33, .44], size: .26, body: '#F4E6D4' });
   // in the update: phone.pose({ face: 'happy', arms: [[.4, 0], [1.6, 0]] }); eyes.set('wow:u');
   ```

   Keep a decal under about .6 of its surface's radius of curvature, and pass `body` so the cheeks blend.
6. Return `t => { ... }` from the builder. In it, set every moving thing from `t`, every frame: `K.sunAt`,
   `K.daylight`, `K.skyDrift`, the props, `kid.pose(...)` from a pose function of `TOON.two(t)`, `lamp.set(on, pull)`,
   and `K.camera(TOON.rig(t, CAM))` with the focus set from the hero.
7. The shot: `shots([[0, t => { TOON.frame(t); TOON.caption(...); TOON.bubble(id, str, ...K.project(head), t, t0,
   t1); }]])`.
8. Declare cues from the same constants: `TOON.landsOf(HOPS)` for lands, the pull time for a click, the light-on time
   for a thump and a chime, `springAt(T_BUBBLE, .5, 'soft')` for the bubble pop.
9. Check: `--beats` (one frame per beat), `--strip` across a hop (poses must pair up on twos), full-size stills of each
   beat (captions against what is behind them; the hero's face during every move), `--inspect`, `--determinism`, then
   `--clip`. No sub-frames: the acting is on twos.

## Failure modes and checks

- Toon bands vanish when the sun is down. MeshToonMaterial bands only direct lights, and a hemisphere fill shades
  smoothly, so a dusk set with no key reads as flat colour and the hero as a pale egg. Keep a key light: the moon in
  the day table, placed to one side of the camera (a key from the camera's own direction shows no bands either).
- The hero seen from behind for a whole move. Whatever the light, a ball walking away from the camera has no face and
  no form. Block the path across and toward the camera (see Motion grammar), and check a full-size still mid-move.
- A caption over the 3D. `--inspect` only checks text against other text, so it can't see a plum caption sitting on a
  dark canopy. Check every caption's box against what is behind it on a full-size still, at the start and the end of
  any camera move under it.
- The hero looks see-through. A low sun behind the set throws soft shadows of a bench's slats, or of the hero's own far
  arm, across its body. The mascot casts shadows but receives none (`mascot({ receiveShadow: true })` to undo).
- Ghosting under depth of field. postprocessing's `DepthOfFieldEffect` adds its blurred far layer on top of in-focus
  subjects, so the set behind shows through the hero. The look replaces it with its own depth-aware bokeh. Don't swap it
  back.
- A sky that is all smear. Full blur on the backdrop wipes out the painted bands and every star. Keep `S.dof.sky` low.
- A seam across the frame: a pale band or rim on a low cloud bank under the horizon reads as a straight line cutting
  the background in two. The near bank is flat on purpose.
- A mesh that shows only its ink: a `LatheGeometry` profile given top-down has its faces pointing in. `K.G.lathe` takes
  the profile top-down and reverses it for you.
- Painted clouds with vertical seams or icicles: domes made of circles side by side. Use a continuous skyline (what
  `cloudBank` does). Far 3D clouds under depth of field read as stickers; paint them into the sky instead.
- Frame 0 renders an empty scene: a module-only look. The classic `toon3d.js` registers the ready gate with
  `whenReady()` before any module runs, and `toon3d.mjs` opens it after the builders and a warm-up render.
- A frame that depends on history: use `composer.render(0)` (with no argument it reads its own timer), no
  `AnimationMixer.update`, no `Clock`, and shadows on `autoUpdate`. The grain's seed is the frame index. Run
  `--determinism`; the specimen differs by 0/255.
- Bloom on everything: keep toon colours under 1 and push only emissives past it.
- Hero too small to find: at least 20-25% of the frame height in every acting shot; save the wide for the reveal.
- Ink arcs inside a canopy: give a cluster of balls one silhouette with `inkPush` (about .7 of the ball radius), which
  `K.tree` does by default.
- Feet lost on the ground: stepping stones or props the colour of the hero swallow the contact. Keep them a value
  apart (warm grey under a cream hero).
- The cord, the hand and the post on one line: hang the pull-cord from a corner (`lamp({ cordX })`) so a raised arm
  reads beside the post, not across it, from every camera that sees the grab.
- A glance nobody sees: a pupil shift of a few texels is sub-pixel on screen. The face keys move the eyes by a third of
  their spacing. Add a lean for looking up.
- A bubble on screen for one beat fails the reading-time check. Give two words about 1.7 s.

## Sound palette

Sound design rather than a bed, as in the atlas's best example: soft thumps on each hop's landing (`land`, heavier on
the big leap), a cord click and a lamp thump with a warm chime as the light comes on, a pop for the turn and for the
speech bubble, and a slow swell under the sunset and under the end line. If a bed is wanted, keep it small and
acoustic-feeling at 90-100 BPM (music box, kalimba, a soft pad) in the key of the chime (the specimen declares D major).
Leave half a second of near silence before the payoff, and master to -14 LUFS with headroom, not a 0 dBFS peak.
