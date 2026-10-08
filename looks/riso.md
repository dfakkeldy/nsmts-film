# Print-process simulation (`riso`)

A risograph on cream stock: two or three spot inks, each printed from its own plate. Grey on a plate prints as halftone
dots, every plate lands a few pixels off register and shifts again on every print (on twos), and the inks multiply where
they overlap, so pink over blue makes purple and pink, yellow and a blue tint make coffee brown. Type is set in the
inks (or printed as an open outline that takes its ink later), panels are thick-bordered boxes with a hard offset
shadow, and a rubber stamp closes the argument.

- **Built:** yes. Module `looks/riso.js`, specimen `specimens/riso` (1920 x 1080, 30 fps, 10 s, 5 bars at 120 BPM:
  "how a moka pot makes coffee", a title page, a print pass on beats 6-8, then a cutaway whose labels take their inks
  bottom to top). Measured on an M1 Pro: 84 ms a frame on the `--clip` run, no sub-frames (112 ms on a re-run while
  another render and Blender shared the machine). The post pass (`RISO.post`) on the uimorph specimen (1440 x 1440):
  about 0.13 s a frame against 0.035 s without it (measured in the first build).
- **Best for:** explainers with personality, manifestos, product stories, editorial ads, a cultural or historical
  story, a brand intro that should feel made by hand. 10-30 s; 16:9, square or 4:5.
- **Engine:** canvas (`mode: 'canvas'`) for drawing, plus a WebGL2 shader that composites the plates (screens, grain,
  offsets, multiply). Without WebGL2 (or with `P.riso.flat`) it prints flat: multiply and offsets, no screens. Cost to make a film: M (draw
  each element on the plates it should print on). Layer-order risk: low (plates are flat; order only matters within one
  plate, for knockouts).
- **Atlas:** look 15, "Print-process simulation" (3 videos, average 7.7, top 8). Best example:
  [polydao-7a572b](https://prompt-motion.com/polydao-7a572b).

## What it is, and isn't

It is print: flat inks, dots, paper, registration that never quite lines up. Gradients, glows, drop shadows with blur,
photographs and 3D lighting break it. A photo or a screenshot belongs in it only after the post pass has separated it
into the inks. It is also not a slide deck: no plate numbers, deck headers, page counters or mono numbered eyebrows
(the atlas's AI tells for this look), and registration marks once at most, never in all four corners. Nor is it the
reference film's chrome: no title-bar window buttons unless the film is about software (`win` draws none by default),
and no halftone blobs parked in the corners. A blob has a job: a cast shadow, the heat round a flame, steam.

## Materials and palette

- **Paper:** cream stock (`#F3EEE3`) with a fibre texture. Plain draw.js calls inside `RISO.print` paint the paper,
  so a coloured stock or a desk under the sheet is possible.
- **Inks:** two or three of Riso's spot colours. The default set is yellow `#FFE800`, fluorescent pink `#FF48B0`
  and blue `#0078BF`, printed lightest first. Overprints: pink + yellow = red-orange, pink + blue = deep purple-navy,
  blue + yellow = green, all three = near-black. Brown is pink + yellow under a blue tint of 40-55%: above about 60%
  the blue multiplies the red-orange to a green-black, and a pink tint under it leaves holes where blue on yellow
  prints green, so keep the pink and yellow solid. `RISO.INKS` lists more (federal blue, teal, black, orange, green,
  purple, aqua, sunflower, mint); set `P.riso.inks` and `P.riso.key`. The key ink (the darkest) carries type,
  outlines and panel borders.
- **On a plate only darkness counts.** Black prints solid. `RISO.tone(k)` is the grey that prints tint k as dots. White
  or transparent prints nothing. `RISO.tint(k, fn)` draws at tint k and keeps the darker where tints overlap.
  `RISO.knock(fn)` erases from the plate, so paper shows through.
- **The press:** a halftone cell of 10 px with a different screen angle per ink (5, 75, 15 and 45 degrees), white
  specks where the drum starved, fine density noise, slow mottling and about 1 px of edge wobble. A standing offset per
  plate (about 3 px) plus 1.6 px of jitter is drawn fresh for every print. All of it lives in `RISO.S` and
  `P.riso`.
- Banned: soft shadows, gradients outside a halftone, soft glows, more than three inks plus paper, deck chrome.

## Type

Barlow Condensed Black in caps for display (ultra-condensed caps are the look's voice), Space Grotesk 600 for body,
IBM Plex Mono Bold for panel captions. `RISO.type` sets a line on one plate or overprints it on several (`inks`,
`tones`), with an offset shadow on another plate (`shadow`; `shadow.knock` erases the letters from the shadow's
plate, so a pink word over a yellow shadow stays pink instead of turning red-orange), knocked out (`knock`), or as an
open outline (`outline: 3.5`, px), a word waiting for its ink. It registers the line for the checks once, not once
per plate. Body text sits at 40 px and panel captions at 30 px. The specks thin small type, so nothing goes under
28 px. Overprinted display words look best at 110 px and up, where the misregistered fringes read as intent, not blur;
a three-ink word keeps its blue at 55% or less (see Inks).

## Motion grammar

- **Print-in:** a shape or a word arrives by tint: `RISO.printIn(t, t0, dur)` takes tint from 0 to 1, so its dots
  grow until they merge into solid ink. Use it instead of a fade.
- **Stamp slam:** `RISO.slam`/`RISO.stamp` fall large and faint (scaled 1.5, tint .12-.45, ease in) for .14 s, land
  in full ink at t0 with a small squash, and jolt the sheet a few pixels (`print(..., { shake })` with `kick`). Scale a
  wide block about its left edge and start it smaller (`from`: the specimen's 600 px title block falls from 1.3, its
  1,000 px slab from 1.1), or while it falls it runs off the frame or across its neighbour.
- **Print pass:** `RISO.sweep` is the transition. A slanted edge crosses the sheet; behind it the new page is printed,
  and each plate's edge trails the previous one by `stagger` px, so the inks change one by one (yellow, then pink, then
  blue). It runs on `RISO.PASS`, a near-linear curve (`bezier(.15, 0, .85, 1)`), for about a second: an ease-in-out
  spends its first and last quarter crossing bare paper and the bands blur into a plain wipe in the middle. Trim the
  leading edge's travel to the content with `from` and `to`, so the first band reaches ink on the beat the pass starts
  (the specimen: beat 6 to beat 8). The new page must have ink on every plate where the old one has it, so each band
  lays new ink as it lifts old ink; otherwise the pass reads as the page being erased.
- **Outline, then ink:** a label printed with its page as an open outline (`outline`) takes its inks by `printIn` when
  its step happens, and can drop back to a tint when the step is over (the specimen's HEAT, once the flame dies).
- **In-place diagram builds:** line art draws itself (`lineTo`), parts print in, liquids rise under a surface moving
  on twos, and leader lines (dotted, `dash: [.5, 11]`) draw out to the part they name.
- **On twos:** jitter and grain step every second frame (`S.on`). Draw hand-animated things (a flame, steam) at
  `RISO.held(t)` so they step with the press. Moves that should feel mechanical (the pass, a slam) stay smooth at 30 fps.
- Something changes on most beats; big events (a slam, a pass, a stamp) land on beats.

## Camera

None: the sheet stays still, as paper does. The only movement of the whole frame is the few-pixel jolt when a stamp
lands. If a film needs to travel, cut or sweep to a new sheet instead of panning across one.

## Recipe

1. Write the organising idea and give each ink a meaning (in the specimen: heat is pink + yellow, water is blue,
   coffee is all three). Decide which plates each element prints on before any code.
2. Config: `riso: { paper, inks: [...], key }`, `palette: { ink: '#000000' }` (so draw.js's default ink prints
   solid), 30 fps. Add the look first in the manifest.
3. Draw a page as a function of t: `R.on('pink', () => ...)` per plate. Use draw.js helpers inside it (`text`, `rr`,
   `line`, `lineTo`, `circle`) and the look's helpers: `type`, `blob` (a halftone blob), `win` (a printed panel with
   a caption bar, which returns its inner rect), `hatch` (engraving lines), `stipple`, `arrow`, `reg` (a registration
   mark on every plate), `distress` (stamp wear), `stamp`.
4. Shots: `shots([[0, t => R.print(t, pageA)], [T, t => R.print(t, tt => R.sweep(tt, T, 1, pageA, pageB, { from,
   to }))], [T + 1, t => R.print(t, pageB)]])`, with T on a beat. During a sweep a line of text counts for the checks
   only while it is wholly printed on its plate (page A's until that plate's edge reaches it, page B's once the edge
   has passed it). This covers draw.js `text()` calls on the plates and on the paper as well as the look's helpers.
5. Declare cues from the same times: `cue(t0, 'thump')` on each slam, a `swish` over the pass, a `riser` into the
   big change, a `pop` on the payoff, a `bell` on the last stamp.
6. To riso-ify another look's frames instead, add `looks/riso.js` to that project's manifest and call
   `RISO.post({ white: <its background>, inks: [...], minTone: .15 })` once from a scene. Use `['pink', 'black']` or
   `['blue', 'pink']` for dark UI: with three light inks, black separates into a three-ink near-black. Keep source
   text at 36 px or more (at 1080p): the screens and specks make smaller UI type unreadable. `minTone` drops tints
   below it, so light-grey hairlines and soft shadows print nothing instead of scattering into sparse dots; a border
   that must survive needs to be darker in the source.
7. Check: `--beats`, `--strip` across the pass and each slam, a full-size `--stills` crop of type (specks and
   fringes), `--inspect`, `--determinism`, then `--clip` without sub-frames.

## Failure modes and checks

- **A print pass that reads as a wipe:** too fast, too little stagger, or an ease-in-out. Keep the per-frame travel
  well under the stagger (the specimen: about 2,360 px of travel in 1 s, at most about 95 px a frame, against a
  260 px stagger), and give the new page ink on the first plate so the first band shows.
- **A print pass that reads as an eraser:** the new page is bare where the old one had ink, so the bands lift ink and
  lay none (the first build of this specimen had 0.15 s of nearly blank frames and 1.2 s of a half-empty sheet). Put
  the new page's display line, labels or key-plate outlines where the old page's type was. Check a `--strip` across
  the pass: every band should cross new ink.
- **A ring at the edge of a soft shape:** the plates must upload premultiplied (the look does this). If you write
  your own compositor, straight-alpha filtering darkens every edge.
- **Tints vanish:** yellow below 20% hardly shows on cream. Use pink or blue for light tints, yellow for solids.
- **Mud:** three inks at full strength over large areas go near-black. Keep one ink as a tint (the coffee is 50% blue,
  its label 55%, the grounds 40-50%).
- **Readability:** specks and jitter thin small type. Keep body text at 36-40 px, put it on one plate in the key
  ink, and save overprinted fringes for display sizes.
- **Motion blur:** don't render with `--subframes`. Averaging sub-frames smears the on-twos jitter into a double image,
  and print has no motion blur.
- **Determinism:** the jitter and grain seeds come from the print index (`RISO.printAt(t)`), never from kit's `T` or
  history. With `PROJECT.loop` set, the index wraps at the film's length, so the seam frame prints like frame 0; keep
  anything you animate with `RISO.held(t)` periodic too.
- **Text during a sweep:** text registers only while wholly printed on its plate, so `--inspect` sees no
  half-wiped words, and a frame in mid-pass can have an empty registry (the specimen at 3.4 s). That is correct, not
  a sign the checks are blind; the registry is filled again once the last band has passed the new page's type.
- **Drawn before a panel:** `win` knocks its interior out of every plate, so anything drawn earlier on the same page
  under the panel vanishes. Draw the panel first, then what goes inside it (the specimen's heat glow is drawn in
  `cutaway()`, after `win`).
- **No WebGL2** (a software renderer, an old browser), or `P.riso.flat: true` to see it: the look prints flat, with a
  console warning. Each plate multiplies on as flat ink at its offset: misregistration and overprints survive, but
  there are no screens, specks or paper fibre, tints print as flat pale ink, and blobs as smooth gradients. The post
  pass needs the shader, so without it `RISO.post` leaves the frame unprinted (one warning). Check the `GPU:` line
  that `--stills` prints.

## Sound palette

Paper and press sounds, not synths: a dull thump per stamp or slam, a paper swish over the print pass, small clicks if
the plates step visibly, a riser while something builds, a pop or a bell on the payoff. A dry, mid-tempo bed (100-120
BPM, brushed drums, a bass and an upright piano or a vibraphone) suits the paper; a four-on-the-floor bed fights it.
Leave half a beat of near-silence before the final stamp. Master to -14 LUFS for feeds.
