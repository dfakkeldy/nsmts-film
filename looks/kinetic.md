# Self-demonstrating type (`kinetic`)

Words that do what they say, on full-bleed flat colour: "crack" cracks the frame open, "whisk" swirls in, "stack" piles
up letter by letter and topples, a struck word gets struck. One yolk-coloured dot carries the film from word to word (an
i's dot, a thing tossed off the top of the frame, a full stop, the pen that strikes a word out), the fields flip colour
on the beat instead of cutting, and over half a second of nothing comes before the strike-out.

- **Built:** yes. Module `looks/kinetic.js`, specimen `specimens/kinetic` (1080 x 1080, 60 fps, 11 s, 5.5 bars at
  120 BPM, not a loop). Measured on an M1 Pro: about 0.14 s a frame with 12 sub-frames of motion blur (0.10 s with 8,
  0.01-0.02 s without).
- **Best for:** idents and logo reveals, title sequences, 10-15 s social ads, a manifesto or one-line promise, a launch
  teaser, the opening of a showreel. Square or 9:16 for feeds; 16:9 with smaller fits (see Recipe step 9).
- **Engine:** canvas (`mode: 'canvas'`). Cost to make a film: S (the copy and a cue sheet; the performances are in the
  module). Layer-order risk: low (flat fields, words, one dot drawn over them).
- **Atlas:** look 8, "Self-demonstrating type on flat colour" (5 videos, average 7.4, top 8). Best example:
  [zheke-38deff](https://prompt-motion.com/zheke-38deff); also gdgtify-287ddf (a sentence built into architecture) and
  1littlecoder-9fef89 (a dot that becomes the punctuation).

## What it is, and isn't

Type is the only actor. Each word acts out its own meaning, so the copy is the shot list: pick verbs (or nouns with a
physical behaviour) that can perform. One recurring object, the dot, is the continuity; the ending calls back to it
(the specimen's last landing repeats its first: the yolk becomes an i's dot). It isn't a word slam reel (no count-ups,
no flashes, no strobes), and it isn't the HUD showreel template: no corner telemetry, no "every frame is code", no
name card of one bold word with an orange full stop. The dot is a full stop at most once in a film, never after every
word, and never on the last frame. Don't open on a bouncing ball: open on a word.

## Materials and palette

Four colours for the whole film: cream `#F2EADB`, ink `#16120E`, cobalt `#2836CC`, and yolk `#FFA914` for the dot and
the strike only (a typewriter caret, if there is one, takes the note's tint, never the accent). One field colour per
card, flipped hard on the beat; type is ink on cream and cream on cobalt or ink; a quiet note is the cream dimmed toward
its field (`mixCol(C.cream, C.ink, .15)`: a tint, not a new colour). Nothing else: no gradients, shadows, glows, grain
or texture. Set `P.kinetic` in the config for another palette (forest green and gold, terracotta and cream, cobalt and
lavender all suit it); keep the accent for the dot.

## Type

- Three faces, three jobs (`face`): `'display'`, Barlow Condensed Black, for the words that perform; `'sans'`, Space
  Grotesk Bold, for the voice (the punchline); `'mono'`, IBM Plex Mono Bold, for a dry note. All ship with the engine
  under the OFL. A line changes face only when its job changes.
- Lowercase, so the i's have dots the yolk can play (`dotless: [index]` clips the real tittle off).
- Fit performing words to 70-80% of the frame width on a square or 9:16 frame (`fit: W * .72`); the note is 58 px at
  1080 (`58 * KIN.SC`); nothing under 28 px.
- Letters are drawn one by one from prefix widths, so kerning survives; tracking stays at zero.
- A word is never stretched while it is read, except when the distortion is the meaning (pancakes on a pile: `stack`
  keeps `flat: [1.6, .8]`); keep that distortion constant while it reads. There is no italic serif accent word.

## Motion grammar

- Every performance is an act, a pure function of `(t, t0)`, and a word's acts compose: offsets add, scales multiply.
  So one word can drop in, squash when the dot lands on it, get struck and roll out, all from one list.
- Falls accelerate (gravity, `p²`) and stretch a little; landings squash and ring out on the land spring (an impulse
  response: two visible wobbles, then still). A landing knocks the letters beneath it a little too.
- Swirls (`orbit`) unwind on the whisk spring with a small back-swing; letters swirling into a point go nearest first,
  like a whirlpool.
- Halves part on the door spring (critically damped); swaps roll letter by letter on the roll spring, like a
  split-flap, with the incoming word .12 s behind the outgoing one. A strike fades piece by piece just before its
  letters roll, so the swap carries no debris.
- Transitions are motivated: the split reveals the next field, an impact flips it, a swallow empties the frame on the
  flip. Every field change lands on a beat, and something is already moving on the flip frame (the next word's first
  letter falling in, the dot being thrown).
- One silence: at least .4 s of total stillness, and no sound, before the strike (the specimen has .75 s with no sound
  from the full stop's pop to the strike). Then the strike is fast (outExpo, .32 s) and the dot draws it.
- The dot hops in arcs, falls accelerating, is thrown (sideways speed first, then rising and slowing), rides a moving
  point (the strike's head), and lands with a squash anchored at its bottom, so it sits on what it lands on.
- Holds get a slow push (2.5-3.5% over the hold) or a tremble before a break, nothing that competes with reading.

## Camera

Locked. The fields flip instead of cutting, and nothing moves the frame; a push is the word scaling, not a camera.

## Recipe

1. Write the copy first: four to six words that can perform, in an order that tells something (the specimen: crack,
   whisk, stack, then "share", struck out, "mine", "serves 1"). Budget 1.5 s per word, entrance included: the reading
   check needs at least 1.35 s for one word, and a performance that scrambles the letters doesn't count. The last line
   needs 1 s plus 3 words a second after its last character appears and before the film ends.
2. Lay a cue sheet on the beat grid (`const AT = { crack: tb(2), split: tb(2.5), ... }`), with the silence before the
   strike written in. Scale every pixel constant by `KIN.SC` (1 at 1080 px on the short side). Render `--beats` as the
   first check.
3. Write each word: `{ id, text, face, fit | size, x, y, mid, dotless, acts: [[t0, 'drop', o], ...] }`. The acts:
   `drop` (in, from above), `fall` (out, through the floor), `squash` (a knock, or a ripple from `o.at`), `stretch`,
   `shiver` (a tremble that grows), `push` (a slow scale), `orbit` (`mode: 'in'` swirls into the line, `'out'` spirals
   into a point), `flip`, `stack` (tossed onto a pile at `o.base`, `flat: [sx, sy]` once landed, `fall0` to have the
   first letter in view on its flip), `tilt` (a sway or a topple about a pivot), `strike` (`from: 'right'` draws it
   back across; `fade: [t1, t2], fadeStagger` before a swap), `roll` (pair them with `KIN.swap(t0, { lag: .12 })`),
   `type` (a typewriter; `caret: false` or the note's tint), `split` (the frame cracks and parts).
4. An act of your own is a function with the same signature, `(t, t0, c, o) => r | null`. `c` is the placed word:
   `c.L` (size, glyphs with `x`, `adv`, `asc`, `desc`; `w`, `xh`), `c.n`, `c.x0`, `c.y` (baseline), `c.cx`, `c.cy`,
   `c.home(i)` (letter i's baseline centre). `r` may hold `letter(i, T)` returning `{ dx, dy, sx, sy, rot, a }` for
   letter i (`T` is its transform from the acts before this one; offsets add, scales and alpha multiply, rotations
   add), `after(tr, c)` to draw over the letters, `legible` (false while the act scrambles the word), `clip`
   (`[x, y, w, h]`) and `halves` (the split's own).
5. Put the words on cards: `[{ t, until, field, ink, top, words }]`. A card's field shows from its `t`; it stays live
   until `until` so its exit can run over the next field. A splitting card needs `top: [t0, t1]` to draw over the next.
6. Write the dot's keys: `{ t, at, r, how, dur, h, land, pop, pulse, spin }`, with `at` a point or an anchor from the
   words (`KIN.tittle(t, WORD, i, r)`, `KIN.top`, `KIN.stop`, `KIN.strikeHead`), so it sits on letters as they move.
   When the target letter is still arriving during the hop, aim at where it will be:
   `t => KIN.tittle(Math.max(t, AT.stop2), MINE, 1, R)`.
7. Declare sound cues from the same times (`cue(AT.crack, 'snap')`, one `tock` per landing).
8. `KIN.shots(CARDS, { dot: DOT })`: one shot per card, so motion blur never averages two fields across a flip. Check:
   `--inspect --every=0.1`, strips at `--fps=30` across each performance, `--onion` on a landing, the closing line by
   hand (step 1), `--determinism`, `--events`, then `--clip --subframes=12` (8 is the minimum: the swirls and the
   topple step visibly at 4).
9. Other frames. 9:16 (1080 x 1920) runs as the square specimen does (0 errors, 0 warnings at `--every=0.1`); raise
   `FLOOR` to about `.75 * H` so the pile and its topple clear a feed's bottom caption zone, and move the end card up
   with it. 16:9 (1920 x 1080) also passes the checks, but width-based fits make the words fill half the frame height
   and the dot look small: fit performing words to about `W * .5`, the pile to about `.2 * H`, and set `R` near 5% of
   the voice's size.

## Failure modes and checks

- A word on screen too briefly to read. `--inspect` at its default .25 s sampling can pass a word that reads for about
  1.2 s; run it with `--every=0.1`. Acts report when a word is legible, and the word is registered only then.
- A closing line that can't be read: `--inspect` exempts the text still on screen at the end from the reading-time
  check, so it passes a last line that finishes typing .7 s before the film ends. Time it by hand from the cue sheet
  (the specimen's "serves 1" is done at about 9.05 s of 11).
- An exit cut off by the next flip: a card's words stop drawing at `until`, and over a new field of the same colour as
  the type they vanish. Make the exit finish on the flip (the specimen's swallow is timed back from it: `tb(7) - .28`).
- A one-frame glitch at a split's first frame: the halves must carry their own field from the frame the split starts.
- A frame with nothing but the dot after a flip reads as a dropped frame. Have the next word already moving on the
  flip frame (`stack`'s `fall0: .5` puts the first letter in the top of the frame on the flip).
- Two moving things crossing: a thrown dot rising through a falling letter reads as a collision. The `toss` leads with
  its sideways travel; check the frames after a flip with `--strip`.
- A swap that drags the strike with it (a staircase of yellow pieces climbing with the letters). Fade the strike just
  before the roll (`fade: [AT.swap - .06, AT.swap + .04], fadeStagger: .04`) and lag the in-roll .12 s.
- An anchor on the word it moves (an orbit centred on the dot that sits on the same word) recurses: freeze it at the
  act's start (`() => TIT(AT.swallow)`).
- A roll clips to its line band; it must not clip before it starts, or a word still landing loses its top.
- Letters drawn one by one collide with each other in the checks if registered one by one: register the word once.
- The full stop after every word, a final card of one bold word and an orange full stop, a struck-out tool name
  replaced by "code", a block caret blinking in mono, a corner HUD: the atlas's tells. Avoid.

## Sound palette

One sound per physical event, caused by the picture: a snap for the crack, a pop when the dot lands, a suck for the
swallow, a tock for each letter landing on the pile (rising a tone each), a thump when it topples, a soft pop for the
full stop, then nothing for .75 s, a swish for the strike, a land for the last landing. The specimen declares 13 cues in
11 s (11.8 per 10 s); with no music bed that density is fine, and it is the most the film should take. Sound design
alone reads as more premium than a bed; if there is a bed, drop it out for the silence. Master to -14 LUFS for feeds.
