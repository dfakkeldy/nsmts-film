# Terminal, CRT and ASCII (`terminal`)

A believable shell session on a phosphor tube: IBM Plex Mono on one character grid, one phosphor colour, commands
typed with a human cadence, output landing line by line, a full-screen tool on the alternate screen, ASCII art
rasterised from shapes drawn with ordinary canvas calls, and a CRT pass (curvature, scanlines, bloom) that a camera can
push in on.

- **Built:** yes. Module `looks/terminal.js`, specimen `specimens/terminal` (1920 x 1080, 30 fps, 10 s, 5 bars at
  120 BPM, not a loop). Measured on an M1 Pro: about 82 ms a frame for the clip run (CRT pass included, no
  sub-frames). `render.mjs --loop=modes` renders the kite as a fill, as a fill with edge characters, and in braille.
- **Best for:** CLI and developer-tool launches, agent and build-tool demos, changelog teasers, a hacker-ish beat inside
  a longer film. 8-20 s; 16:9, or 1:1 with a narrower grid.
- **Engine:** canvas (`mode: 'canvas'`) plus one WebGL2 post pass (falls back to a 2D pass without curvature). Cost to
  make a film: S (write the session as a log; the art is a draw function or two). Layer-order risk: low (one grid; art
  and text share cells).
- **Atlas:** look 33, "Terminal, CRT and ASCII" (5 videos, average 6.2, top 7). Best example:
  [robvjourney-ce3e1a](https://prompt-motion.com/robvjourney-ce3e1a).

## What it is, and isn't

It is a terminal someone could have recorded: a real-looking prompt and path, flags that parse, plausible numbers
and timings, output that answers the command. A made-up tool is fine and usually better; fake hacking is not. Banned:
the `> connecting...` cold open or an empty prompt with a blinking caret as the first frame (start mid-session, with
output already landing), scrolling hex or gibberish, `ACCESS GRANTED`, `sudo` theatre, corner telemetry (BPM,
timecode, frame counts), glitch slices nobody can read, an RGB split, a window frame with traffic-light buttons. The
ASCII art must be the tool's own output (a TUI, a progress view, a printed receipt), not an insert pasted over the
screen.

## Materials and palette

One phosphor on its own tube black: amber `#FFB23F` on `#0D0905` (the specimen), green `#4DFF88`, lime `#C6FF3D` or
white `#E4ECFF` (`P.terminal.phosphor`, or any hex). Four levels of that one colour do all the work: `hi` (commands,
numbers, the art), `fg` (output), `dim` (prompts, units, secondary text), `faint` (rules, the ground line). Inverse
video (`inv`) is the accent: a status bar, a selection, the one bright slab that resets attention. No second hue.
Block elements, box drawing and braille are drawn as shapes, not font glyphs, so bars and boxes tile without seams;
anything else must be in IBM Plex Mono Bold, or the frame throws rather than fall back to a system font.

## Type

IBM Plex Mono Bold only, on one grid for the whole film: `TERM.grid()` makes a 38 px, 1.3 line-height grid of 71 x 17
cells at 1920 x 1080, with the cell width taken from Plex's 600/1000 em advance. Never mix font sizes on screen. Make
text larger with the camera, which also magnifies the tube. Text a viewer must read is registered line by line, or
segment by segment when part of a line changes every frame (`[text, style, id]`, with a `~` id on the counter). The
typed command registers with a `~` id until its last key lands. Segment ids register whether or not the line has an
`id` of its own; pass `id: null` (or `ghost`) to register nothing. Links use the `link` style: bright, with the dotted
underline terminals give OSC 8 hyperlinks.

## Motion grammar

- Typing comes from `TERM.keys()`, a seeded model of a fluent typist: about 13-15 keys a second (`o.cps`, default 13), log-normal jitter,
  quicker common pairs, a pause at word gaps, a reach for `-` `/` `.`, a breath before a flag's value, and `\b` for
  a correction after a realisation pause. The cursor stays solid while keys land, then blinks 530 ms on, 530 ms off.
  Put Enter on a beat; the prompt line holds without a cursor while the command runs.
- Output lands line by line at irregular, believable intervals. Lines that push the screen up scroll smoothly on a
  stiff spring, and the top line fades as it leaves.
- In-place updates (progress, counters, spinners) rewrite their line every frame: a LOG entry
  `{ t, live: tt => segs, until, final: true, id }` is redrawn until `until` and then frozen, registered under a `~` id
  while it changes and under its own id once it settles (`final`). The specimen opens on one, the `links` check still
  counting with a braille spinner. Progress bars fill in eighth blocks, so they never step a whole cell.
- A full-screen tool takes the alternate screen: the screen clears and `TERM.repaint()` paints it top to bottom,
  the way a slow link draws, and unpainted text is dropped from the checks. Pass `{ cursor: true }` so the write head
  shows: over empty rows the paint is otherwise invisible. Leaving the tool restores the shell
  instantly, as a real terminal does, and the receipt prints under the command.
- ASCII art moves within the grid, so its characters change as it moves. `TERM.persist()` redraws it at two earlier
  instants, fainter, for a phosphor afterglow, which reads better than motion blur on glyphs.
- Big moments use inverse video and the bell: the status bar turns into a full-width slab with a short flare.

## Camera

A push-in on the tube, not a zoom of the text. `TERM.camera(t, keys)` gives `[cx, cy, zoom]` on a spring, with zoom
moving in log space. Draw the content through `cam(...v)` and pass the same `v` to `TERM.crt({ view: v })`, so
curvature, scanlines and the tube's edge are magnified with the content while the text stays sharp. `TERM.fit()`
frames a block of cells, and a key like `V(c, r, zoom)` (the scene's helper) centres any cell point. The specimen's
grammar: close on the shell (1.6-1.66x, so the type is 61-63 px) with the check still landing in the lower third,
drifting down with the output and pushing in a little while the command is typed, every row whole; a critically
damped pull-back on Enter that reveals the tube as the tool opens; a slight lean in on the landing; back to the
shell; then a push-in (1.69x) that settles on the receipt with the URL centred, the prompt under it and the frame's
top edge between two rows. A push-in crops the screen on purpose: draw those shots with `shell(..., { inView: true })`
so lines outside the safe area are drawn but not checked, and register scrollback the viewer has already read under
`~` ids in the shot that crops it.

## Recipe

1. Write the session first as a `LOG`: enough history at `t <= 0` to fill the opening frame (the specimen has seven
   lines and a check still counting), output with times, `{ prompt, cmd, type, enter, cps, seed }` for each command,
   and `{ live: tt => segs, until, final, id }` for lines rewritten in place (frozen at `until`; `final: true` gives
   the settled line its own id for the reading-time check). Time Enter, the tool's start, its result and its exit on
   the beat grid (`tb(n)`), and compute Enter from `TERM.typedEnd()` so typing always finishes first. Keep the LOG
   within `G.rows` lines unless you want the screen to scroll, and take the rows you frame from the LOG
   (`LOG.indexOf(cmd)`), not from hard-coded numbers.
2. `const G = TERM.grid()`. Draw the shell with `TERM.shell(t, G, LOG)`. Draw a tool's screen with `TERM.line(G, c,
   r, segs, { id })` per row, `TERM.barSegs(p, w)` for progress and `TERM.cursorBlock()` where the cursor sits.
3. ASCII art: `TERM.asciiFrom(c => draw(c), G, [c0, r0, cols, rows], o)` rasterises ordinary canvas drawing (white,
   frame pixels; grey or alpha means partial ink), and `TERM.art(G, res, { style })` draws it. Pick the mode by
   subject. Big shapes: the default `shape` mode with `edges: true`, which fills with density characters and draws
   outlines in `/ \ | - _` from the ink gradient (two panels at different inks give you a free `|` where they meet).
   Thin lines, strings, plots and traces: `braille` (2 x 4 dots a cell). Pixel art: `blocks`. Pure tone: `ramp`.
   `TERM.over(a, b)` merges two results cell by cell. Keep moving art whole inside its rectangle (clamp its position
   with `rubberLo`/`rubber`, so a gust or a bounce can't push it into the rectangle's edge) and clip trailing parts
   (a kite's tail) yourself where they should disappear.
4. Shots: one per screen (shell, tool, shell). Wrap each in the camera:
   `TERM.screen(G); CX.save(); cam(...viewAt(t)); draw(); CX.restore();`, and
   `post((c, t) => TERM.crt(c, t, { view: viewAt(t) }))`. Pass `inView: true` to `shell()` in shots the camera crops,
   and `{ cursor: true }` to `repaint()`.
5. Cues from the same times: one `key` per command (`dur` = its typing time, not one per keystroke), `click` on Enter,
   `swish` when the tool takes the screen, a `riser` under the work, `bell` on the result, `snap` on exit, `tick` on
   the receipt.
6. Check: `--beats` (or a sheet), `--strip` across Enter, the art's biggest move and the exit (every frame must read
   as the thing it is), `--inspect --every=0.1` (camera moves can push text out of frame), `--sheet --crop` on edge
   text whenever `curve` is above .06 (the checks see text before the CRT warp), `--determinism`, then `--clip`.

## Failure modes and checks

- Shape-matched characters without `edges` turn diagonal edges into `" \` ^ ~` noise. Use `edges: true` for fills,
  braille for thin lines, and draw shapes at least 10 cells across; anything smaller reads as a blob.
- The edges pass reads direction from a coarse 3 x 4 sample of each tall cell, so an edge much shallower than about
  35 degrees comes out as `_` and one within about 20 degrees of vertical as `|`. A diamond kite tilted 23 degrees
  turns into a pennant (one side a column of `|`), and one with shallow shoulders loses its point as soon as it tilts.
  Give shapes steep edges (the specimen's kite has 44-degree shoulders), keep tilts under about 12 degrees, and put
  big gestures into position rather than rotation. A shape lying almost flat (the first build launched the kite at
  76 degrees) reads as a hull or a loaf.
- Art that rises or swings into the edge of its `asciiFrom` rectangle is cut flat there (the kite's tip under the
  header in a gust). Clamp the position softly so the whole shape stays a row inside.
- Thin lines lying along a rule (a kite's tail and string on the ground) read as dirt. Clip them out until they lift,
  and keep strings taut near their anchor.
- Soft blobs (clouds, smoke) never read as ASCII at this grid size; they come out as stray dots or rules. The
  specimen leaves the sky empty.
- A camera move that is still zoomed when a tool paints its bottom row pushes registered text out of frame
  (`--inspect` error). Pull back on a stiff, critically damped spring that settles before the paint reaches the bottom.
- A push-in on the shell crops the lines above, and a slow spring that hasn't settled leaves half a line at the top
  edge of the last frame. Use `inView`, choose the final framing so the frame's edge falls between two rows, and use a
  spring that settles a few frames before the end (the specimen's crit(20) from 8.4 s).
- The opening frame needs to be full: with five lines of history in the top half and an empty tube below, the first
  half second is weak. Seven lines and a check still counting fill it.
- A blinking cursor can be off on the last frame. Time the final prompt so the blink is on at the end (it shows from
  `since + .5 + 1.06k + .53`).
- A typed command reads as it is typed, but `--inspect` counts only the time after its last key. The specimen keeps
  this one justified warning (`cmd:up`, 0.32 s; the line is back on screen in the receipt from 8 s to the end). Don't
  pad the hold to silence it.
- A status line with a counter fails reading-time unless the counter has its own `~` segment id.
- Glyphs outside Plex Mono throw (by design). Use `◊ ✓ ↑ → … ·` (all present), or draw the glyph.
- `--inspect` checks text boxes before the CRT warp. Keep curvature small (`curve` .06) and text inside the safe area,
  and with any larger curve, crop the frame's edges on a sheet (`--sheet=t --crop=x,y,w,h`) to see what the warp hides.
- Grain and scanlines are fine detail: the specimen encodes at about 15 Mbit/s (CRF 18). For feeds, set
  `grain: 0` and keep `period` at 4 px or more.

## Sound palette

Diegetic first: a dry keyboard run per command (soft, close, no reverb), a heavier Enter, a short swish as the tool
takes the screen, a low riser under the work that stops dead on the result, a single terminal bell (a clean 2-3 kHz
ping, not a chime) on success, a breath of wind on the gust, a soft snap on exit, a tick as the receipt prints. A bed
is optional: a slow 120 BPM pulse or a faint CRT hum (15.7 kHz whine filtered low, mains hum at 50 or 60 Hz, kept
very quiet) works better than a four-on-the-floor loop. Leave a beat of near-silence before the bell. Master to
-14 LUFS for feeds.
