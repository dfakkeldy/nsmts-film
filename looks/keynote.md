# Apple keynote light (`keynote`)

A product reveal on bright white. One device at a time, a phone or a laptop drawn in code and turned in real
perspective, with its app's UI on the screen, a soft studio shadow on the floor and glass that catches the light as it
turns. A big, quiet headline with room round it, one feature called out per beat with a thin leader line, one camera
that pushes in and pulls back to find the next product, a laptop lid that opens on the beat, a rack focus to say where
to look, and a calm end card.

- **Built:** yes. Module `looks/keynote.js`, specimen `specimens/keynote` (1920 x 1080, 60 fps, 10 s, 4 bars at
  96 BPM, one continuous take ending on a held end card). Measured on an M1 Pro: 0.13-0.16 s a frame for the final
  clip with 4 sub-frames of motion blur (0.15 s on average, 90 s for 600 frames with another render sharing the
  machine; 0.13 s alone), heaviest on the rack-in and on shots with two blurred devices. With several jobs holding
  render slots, budget up to 0.2 s. Single frames 0.04-0.09 s.
- **Best for:** app launches and feature films, including your own apps: a phone app, its desktop twin, the hand-off
  between them. Release notes as a 10-20 s film, a feature teaser, a README or App Store preview hero. 16:9 for a site
  or a keynote slide; 1:1 or 4:5 with the device larger and the headline above it.
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: M (lay out the shots on the beat grid, write a screen
  function per app view; the devices, camera, shadows, callouts and end card come from the module). Layer-order risk:
  low (one hero at a time; each device draws its own shadow, edge, face and screen in a fixed order, and a laptop works
  out from its lid angle whether the lid or the deck goes on top).
- **Atlas:** look 24, "Apple keynote light" (5 videos, 4 distinct, average 7.2 over 4 scored films, top 8). Best
  example: [rossaxbt-3085b7](https://prompt-motion.com/rossaxbt-3085b7). Its strongest frames lean on generated
  images; this look draws everything in code.

## What it is, and isn't

It is the product as the hero: one object on white, lit and turned so it feels physical, with its own UI as content
and type that explains one thing at a time. It isn't a screen recording in a browser frame, a wall of screenshots, a
bento grid of feature cards, or a dashboard. Leave out the atlas look's AI tells and Apple's trade dress: no glass
prompt bar with an iridescent halo, no typing caret as the opener, no macOS menu bar or traffic lights, no notch or
island (the phone has a plain camera dot), no glow wordmark on black, no logo alone in a white void, no cursor
clicking a call-to-action on the end card, no real brand marks on a device.

## Materials and palette

A white studio: `#FBFBFC` at the top of the sweep, `#F5F5F7` in the middle, `#ECECEF` at the floor, a soft pool of
light behind the product and a whisper of grain (`S.grain`) so the gradient doesn't band in H.264. Ink `#1D1D1F`, mute
grey `#86868B` for subheads and leader lines, one accent (`#F2612E`, persimmon) used for the app's own colour and its
hero dot. Screens run dark (`#0E0E10`) with a wash of the accent at the top, so the device reads strongly on white.
The phone is graphite with a lit edge; the laptop is aluminium with a black glass bezel, and shut it shows the
aluminium back of its lid, lit along the edge nearest the camera. Art inside the screens (book covers) is drawn in code
from the same three colours plus a cream. Override any of it with `P.keynote`: `accent`, `ink`, `mute`, `line`,
`body`, `alu`, `screen`, `font`, `mono`, `f` (perspective strength), `shadow`, `grain`.

## Type

Space Grotesk, the engine's grotesk, stands in for a system sans. Its y, a and t lean a little towards a start-up
voice rather than a neutral system face; for closer fidelity, add an OFL neutral grotesk (Inter) to `fonts/` and set
`P.keynote.font`. Headlines 100-124 px at 1080p, weight 600-700, tracking about -2% of the size, centred, one line; a
line under a family shot of two devices can drop to about 60 px. Subheads and taglines 40-46 px, weight 500-600, in
mute grey, under the headline (`KN.lockup`). Callout labels 40 px, weight 600, ink, set beside the device and never on
it. Screen UI uses the same face, and IBM Plex Mono Bold for times so digits don't jitter. Never a serif accent word,
never a two-tone headline, never a mono numbered eyebrow.

## Motion grammar

- The camera and the products move on critically damped springs (`follow()` with `KN.SPRING.reveal`, `cam`): a quick
  start and a long settle, no wobble. A move keyed a little before zero (`[-.3, ...]`) means the film opens already in
  motion.
- The reveal turns the device in from edge-on: yaw from about 1.3 rad to a three-quarter rest (-0.15 to -0.45), with
  the screen dark until it faces the viewer, then waking (fade and a 3.5% settle) on a beat.
- Features land one per beat: the leader line leads by .32 s (`EASE.outExpo`), the label blurs up onto the beat, the
  touched UI answers (a ring frames it, a button fills with the accent). The labels let go one after the other as the
  camera starts to move, each line drawing back into the device.
- A second product arrives with the camera: the pull-back finds it sliding in from off frame on the same spring,
  turning from three-quarter to face the hero, its lid shut. The lid opens on the next beat (`SPRING.lid`), and the
  screen lights from the lid angle (`KN.lidWake`) as it comes up, never before.
- Rack focus (`KN.focus`) says where to look: the opening racks in from 11 px, the device you are leaving softens to
  2-3 px while the next one takes the beat, and leaving devices soften as they speed away.
- Exits accelerate (`EASE.exit`) and are shorter than entrances. An icon blooms on `SPRING.bloom`.
- A through-line object helps: here the accent playhead dot rides the phone's scrubber, hops to the laptop's at the
  same second (`KN.flyDot`: an arc that swells towards the camera, with a tapered smear as long as its last 45 ms of
  travel) and lands as the dot in the icon.
- Something moves in every hold: the devices float (a few px, a few hundredths of a radian), the screen's clock and
  timers tick, the icon's dot keeps playing along its track.

## Camera

One camera frames every device. `cam = KN.camera(ax, ay, fx, fy, z)` puts world point (ax, ay) at frame point
(fx, fy), at z frame pixels per world pixel; pass `{ cam }` to `KN.phone`, `KN.laptop` and their maps, and their x, y
and s become world values. Put the anchor on the hero and key `[fx, fy, z]` with `follow()`: the hero then moves
exactly as keyed, and everything else in the world shares the move, so a pull-back that brings in a second product
reads as the camera pulling out, not as the hero stepping back. The family shot's frame makes a handy world (z 1 there);
in the specimen the reveal is at z 1.7-1.9 and the push-in at 2.3. Keep each device's yaw and float on the device: the
camera stays dead steady between keys. Headlines, callout labels and the end card stay in frame pixels (`dev.at()`
already returns frame points). `KN.push(z)` adds a slow whole-frame push (1% over the film, leaning in a further 2.5% on
the end card), and screen textures are sized for it. Perspective is real: `KN.rig` projects device points through a
pinhole (focal length `S.f`, 2800 pt for the phone, 2.2x that for the laptop, with the eye 520 pt above the hinge so the
deck is seen from above). Cut only between products; here the camera and a rack focus replace the cut.

## Recipe

1. Write the beat table first: reveal, features (one per beat, copy of 2-3 words), hand-off or second device, end
   card. At 96 BPM a 10 s film is 4 bars; give a callout 1 s plus a third of a second per word at full strength (a
   2-word label about 1.7 s). Render `--beats`.
2. Write each screen as a function of t returning a draw function: `B => KN.player(B, { wake, pos, knob, sleep, ... })`
   or your own UI with the kit (`KN.ui.status`, `rows`, `button`, `cover`, `track`, `skip`, `play`, `moon`, `list`,
   `toast`, `T`). Draw in screen points (phone 368 x 808, laptop 1152 x 716) with ordinary draw.js helpers; return the
   points you will call out.
3. Lay out the world and the camera: each device at its world place, then
   `const cam = KN.camera(heroX, heroY, ...follow(t, [[-9, [fx, fy, z]], [t1, [fx, fy, z], KN.SPRING.cam], ...]))`.
   Draw `KN.phone(x, y, s, yaw, screen, { cam })` and `KN.laptop(x, y, s, { yaw, lid }, screen, { cam })`. A laptop
   turns in like the phone (`yaw: follow(t, [[-9, .9], [t0, .15, KN.SPRING.reveal]])`; any yaw is exact); open it from
   shut with `lid: follow(t, [[-9, -Math.PI / 2], [t2, .2, KN.SPRING.lid]])` and give its screen `wake: KN.lidWake(lid)`.
   Wrap a device in `KN.focus(blurPx, () => ..., alpha)` to rack focus or fade. Both return `dev.at(u, v)` (screen
   point to frame) and `dev.ui` (what the screen function returned).
4. Put the words in the frame: `KN.headline(id, str, x, y, t, { t0, t1, size })` or `KN.lockup(id, head, sub, ...)`,
   and `KN.callout(id, label, t, { at: dev.at(...dev.ui.knob), label: x, t0, t1 })`. A label given as a plain x stays
   level with its anchor; leave out `t1` and the callout stays to the end of the shot. The anchor gets a white ring
   that frames the control without covering it; `dot: true` marks a bare point instead.
5. End on `KN.appIcon(x, y, size, springStep(t - t0, KN.SPRING.bloom), { track, pos })` with the name as a headline
   and the line under it; land a `KN.flyDot` on `KN.iconDot(x, y, size)` if a dot has been the through-line.
6. Frame it: `KN.stage(t)` first, everything inside `CX.save(); KN.push(z); ...; CX.restore()`, then `KN.finish()`.
7. Declare cues from the same times (`cue(t0, 'tick')`, `cue(springAt(t0, .5, KN.SPRING.bloom), 'pop')`).
8. Check: `--beats`; `--onion` across the reveal, each camera move and a laptop's arrival; `--inspect --every=0.1`;
   `--determinism`; then `--clip --subframes=4`.

## Failure modes and checks

- Fading or blurring a device by setting `CX.globalAlpha` or `CX.filter` round it shows its strips (they overlap by a
  pixel or two). Always go through `KN.focus(px, fn, alpha)`: one layer, one blur, one alpha.
- A laptop faded in from below the frame with its lid half open reads as a grey slab, and a lid tilt under the fade
  never reads. Bring it in sharp, shut, with the camera or from the side, and open the lid on its own beat.
- A near-shut lid with a lit screen shows specks of UI on a sliver of glass. Gate the screen on the lid
  (`wake: KN.lidWake(lid)`).
- Scale in a family shot: a phone standing taller than the laptop's lid looks wrong. Keep it about .8 of the lid.
- Keep the phone's |yaw| under about 1.35 rad (past that it is a sliver of edge). The laptop's screen is exact at any
  yaw (rows facing square on, a grid of cells once turned, a few ms more).
- A turned laptop swings its near front corner well out past its hinge position: while it slides in under a callout,
  check the label clears it (`--sheet` across the arrival) or let the label go a little earlier.
- Two parameters on one spring overshoot: keying the camera's centre and its zoom together makes the hero drift past
  its mark and back. Key the hero's frame point and the zoom (`KN.camera` with the anchor on the hero) instead.
- Screen text is decorative: registered with '~' ids, mapped to the frame, dropped when it leaves the safe area. At a
  family-shot scale it is 8-10 px, so the laptop's toast pill reads as a shape, not as words. Say anything that
  matters in a headline or a callout; pass `{ readable: true }` only for a close-up meant to be read.
- Callout labels belong beside the device: screen text still takes part in the collision check.
- A fast dot drawn as a plain disc stacks up as offset discs ("coins") under motion blur, however many ghosts trail
  it. `KN.flyDot` draws one tapered ribbon, stretches the head over its last 6 ms and softens its edge with its speed,
  so 4 sub-frames merge at the specimen's speed (about 50 px a frame at the peak). For a faster hop, render that range
  at 8: `--frames --range=5.9:6.6 --subframes=8`, delete `out/frames/frames.json`, then `--frames --subframes=4` for
  the rest (frames already there are kept) and `--encode`.
- Fast exits with 2 sub-frames show as double images. Soften them as they go (the specimen's `away()`) and render with
  4 sub-frames.
- Order-dependent frames: never size an offscreen canvas from the frame being drawn (textures here are allocated once
  at their largest size). `--determinism` catches it.
- A tiny logo alone on white for the last seconds: pair the icon with the name and a line, push in slowly, keep one
  thing moving.

## Sound palette

Sound design rather than a busy bed: a soft swell under the reveal, a glassy chime as the screen wakes, two soft ticks
for the callouts (the second a few semitones up), an airy whoosh on the pull-back, a small click as the laptop's lid
lifts on the beat, a swish and a pop for the dot's hop, a whoosh as the devices part, a rounder pop as the icon blooms
and a bell on the name. Under it, if anything, a slow pad or sparse piano at 96 BPM in a bright key (E major in the
specimen), with 100-300 ms of near-silence just before the end card. Master to -14 LUFS for feeds, with headroom.
