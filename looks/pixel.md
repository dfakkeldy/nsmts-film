# 16-bit pixel diorama (`pixel`)

A small game world drawn at 320 x 180 and shown at 6x with nearest-neighbour: one palette of 32 colours, sprites and
tiles written as string maps, dithered skies, three parallax layers, a bitmap font, and game UI (a HUD, a caption box,
a dialogue box with a portrait, hearts). The frame holds palette indices, not colours, so light, water reflections,
fades and a night-to-dawn change all happen the way the hardware did them.

- **Built:** yes. Module `looks/pixel.js`, specimen `specimens/pixel` (1920 x 1080, 30 fps, 10 s, 5 bars at 120 BPM;
  drawn at 320 x 180, scaled 6x). Measured on an M1 Pro: about 62 ms a frame end to end for the clip, encoding
  included. No sub-frames (see Failure modes).
- **Best for:** game launches and teasers, playful brand stories, a history told in pixels (one scene, one action per
  era), festive greetings, chiptune pieces. 8-30 s; 16:9 (320 x 180 at 6x) or square (180 x 180 at 6x).
- **Engine:** canvas (`mode: 'canvas'`): an index buffer drawn in plain JavaScript and presented through a palette.
  Cost to make a film: M (the character, its portrait and any props are drawn by hand as string maps; the scenery is
  parameters). Layer-order risk: medium (draw order is the only depth, and a caption or a light drawn at the wrong
  point covers or recolours the character).
- **Atlas:** look 7, "16-bit pixel diorama" (5 videos, average 6.2, top 7). Best example:
  [pluginplay-3d4006](https://prompt-motion.com/pluginplay-3d4006).

## What it is, and isn't

It is one world on one pixel grid: every element, type included, sits on the same 320 x 180 grid and takes its colour
from the same palette. Mixed pixel sizes (a sprite scaled 2x beside one at 1x), smooth zoom or rotation, antialiased
TrueType text, smooth gradients, blur, glow and motion blur all break it. A camera that scrolls belongs to the look; a
camera that zooms doesn't (cut or iris instead). Draw your own characters and props; never use real game assets,
logos or people.

## Materials and palette

- **The palette:** 32 entries, one character each, so a sprite is readable as text. Fixed entries keep their colour
  all day: `k` ink, `w` warm white, `s S` skin, `h b` browns, `c C` teal, `y Y` gold, `r` red, `f F o` fire,
  `m M` metal. The environment entries have a `NIGHT` and a `DAWN` colour: `0-3` sky ramp, `4 5` far mountains,
  `6 7` near hills, `8 9` dirt, `a A` grass, `d e E` water, `n` stars. `PIX.mix(PIX.NIGHT, PIX.DAWN, k)` moves between
  them in 4 steps. Override with `P.pixel = { night: {...}, dawn: {...} }`.
- **Two to four hue families on screen:** here indigo, teal and gold at night; magenta and amber at dawn. Change the
  palette only for a story reason (time of day, a flash, a fade).
- **Ramps** (`PIX.RAMPS`) define what light and shadow do: `PIX.LIT` moves each colour one step up its ramp, `PIX.DIM`
  one step down, and `PIX.REFL` turns whatever water mirrors into the three water colours. Fire and hair are never
  relit; if they were, red hair would turn yellow next to a flame.
- **Dithering:** ordered Bayer 4 x 4 only (`dither`, `gradient`, the soft edge of `light`), never noise. Skies are flat
  bands with dithered seams (`gradient(y0, y1, '0123', { band: .55 })`).
- **Materials in the module:** a meadow tile set (grass, dirt, a dithered transition into deep dirt, bank edges), pines,
  cattails and tufts for parallax layers, hearts, a speech bubble, a three-frame flame, a twinkling spark and birds.
- **Banned:** neon glow, bloom, smooth gradients, random damage numbers, corner telemetry
  (timecode, frame counts). A HUD is allowed when it counts something in the story.

## Type

- One bitmap font from the glyph data in `pixel.js`: 5 x 7, proportional, uppercase (lowercase is drawn as uppercase),
  digits and common punctuation. Never a TrueType font in this look.
- Two sizes: body at 1x (42 px tall on a 1080 frame) and `big: true` for titles (each font pixel a 2 x 2 block, a 1 px
  ink outline, a gradient by font row such as `'ffyyyYY'`, a drop shadow; 84 px tall).
- House styles (`PIX.UI`): captions are ink on a gold box, dialogue is white on ink with a gold border, the HUD is a
  dark panel with a slate edge.
- `text()` registers each line for the checks with its box in frame pixels and its size as font rows x scale. Keep text
  at least 16 px (low-res) from the sides and 9 from the top and bottom, which is the 5% safe area.

## Motion grammar

- Positions are computed as floats from t (springs, easing curves, `PIX.walk`) and floored only when a pixel is
  written, so everything moves in whole pixels and slow things step.
- Sprite cycles run at 8-12 fps (`fr(t, fps, n)`). A walk cycle is chosen by distance travelled, not by time, so feet
  don't slide when the character speeds up or slows down.
- Walks use a trapezoid speed profile (`PIX.walk(u, a)`): speed up, cruise, slow down. Jumps are parabolas over the
  distance they cover.
- Parallax in whole pixels per layer: stars .03, clouds .08, far mountains .18, near hills .45, ground 1, foreground
  1.5.
- One repeated action per beat, which is the atlas's grammar for this look: here, a lamp lit on a beat, each time with
  the same tip of the pole, a two-frame white flash, a burst (`burst`) and a light pool that blooms over three frames.
- Boxes unfold in 4 steps (`unfold`); their text appears once they are open. Dialogue types at 16-20 characters a
  second while the portrait's mouth alternates at 8 fps, then the portrait blinks and the arrow blinks.
- Palette changes are the big transitions: a fade moves in 4 steps on beats, and a flash lasts two frames.
- A title drops on a `bouncy` spring rounded to whole pixels and lands with a two-frame, 1 px shake.
- Openings and closings: `iris` (in whole-pixel steps) or `mosaic`.

## Camera

Scroll only, in whole pixels. Follow the character with a clamp (`round(clamp(x - 100, 0, max))`) so the camera stops
when they stop; an eased pan is fine when it is motivated (here, toward the horizon she is looking at). Never zoom or
rotate: a change of scale needs a cut or an iris, and a portrait in a dialogue box stands in for a close-up.

## Recipe

1. Write the beat list as comments before any code: the one action that repeats, what the HUD counts, what each
   caption says (exact or funny, 1 s plus 3 words a second on screen), and the payoff. Render one frame per beat with
   `--beats`.
2. Config: a frame that is a whole multiple of the buffer (1920 x 1080 for 320 x 180 at 6x), 30 fps,
   `mode: 'canvas'`. Manifest: `looks/pixel.js`, then the scene.
3. Draw the character, its portrait and props as string maps, one palette character per pixel, `.` for transparent. A
   character that isn't in the palette is a slot coloured at draw time (`sprite(LAMP, x, y, { remap: { L: 'f' } })`),
   so one map serves a lamp lit and unlit. Mirror half-rows for a front-on portrait. Check them on a model sheet (the
   specimen's `LOOPS.sheet`: `--loop=sheet --stills=0`).
4. Draw each frame back to front: `PIX.begin('0')`; sky `gradient`, `stars`, `cloud`; `ridge` with a `heightFn` for
   far and near hills (a `valley` makes room for a rising sun); `stamps` for trees; water as `rect` + `reflect` +
   `sparkle`; `tiles` for the ground; props and characters with `sprite` and `line`; `light` for every light (a lamp,
   the flame being carried, the moon, the sun with `clip` so it stays in the sky); then what burns (flames, sparks),
   drawn after the light so it keeps its shape; `burst`; foreground `stamps`; UI (`panel`, `caption`, `dialog`,
   `hearts`, `emote`, `text`); `iris`; and finally `PIX.present(PIX.mix(PIX.NIGHT, PIX.DAWN, k), { shake })`.
5. Declare sound cues at the top level of the scene from the same times the picture uses: each ignition, the moment the
   character crosses the jump's start and end (`whenAt(x)` in the specimen), the typing span, the title's
   `springAt(t0, 1, 'bouncy')`.
6. Check: `--loop=sheet`, `--stills` (crispness: every 6 x 6 block one colour), `--strip` across each repeated
   action, `--inspect`, `--determinism`, then `--clip` without `--subframes`.

## Failure modes and checks

- **Mixels:** anything scaled by other than whole low-res pixels, or text drawn with `draw.js`'s `text()`. Draw
  everything into the buffer.
- **Sub-frames blur the pixels:** `--subframes` averages frames and softens every edge. Don't use it; stepped motion
  is the look.
- **Light recolours what it shouldn't:** with fire colours in a ramp, red hair next to the flame turned yellow. Keep
  fire and hair out of `RAMPS`, and draw flames after the light pass so they keep their shape.
- **A glow spills onto water:** mid-fade, a sky glow on water reads as a grey blob. Clip sky glows to the sky
  (`light(..., { clip: [0, 0, W, horizon] })`) and add a smaller glow on the water once the palette has turned.
- **Reflections in the wrong place:** `reflect()` mirrors whatever is already drawn above the waterline. Draw sky and
  land, then the water, then anything that stands in front of it.
- **Caption boxes over the character** (the atlas's main risk for this look): keep boxes in the sky and the character
  in the lower third.
- **Typed text fails the reading-time check:** `dialog` registers the line as `~id` while it types and as `id` once
  complete, and the complete line must stay up for 1 s plus 3 words a second.
- **A title that enters from off frame** fails the out-of-frame check while it is outside: register it (pass an id)
  only once it has landed.
- **A slot with no colour** throws an error naming the slot; pass `remap`.
- **A near-static scene** (an atlas risk): something has to move on every beat, such as a flame, twinkling stars,
  water sparkle, fireflies, a portrait blink or birds.
- **Contact sheets downscale:** pixel edges look soft in `--sheet`. Judge crispness from `--stills` or a `--crop`.

## Sound palette

Chiptune, or sound design without music: a pop on each ignition (pitched up a step for the second), a swish and a soft
land for the jump, one text blip spread over the typing, a whoosh for the throw, a chime and a slow swell when the sun
lights, a pop for the heart, and a thump on the title's landing. That is 12 cues in 10 s. A chiptune bed suits it:
square-wave arpeggios, a triangle bass and noise-channel hats at 120-140 BPM, dropping to near silence for the beat
before the payoff. Master to -14 LUFS for feeds.
