# Kinetic captions (`captions`)

A caption system, not a look: give it word timings from a voice and it draws them over any look in three modes.
`subtitle` sets broadcast subtitle cards by Netflix's rules. `kinetic` builds word-by-word pages, each word popping in
as it is spoken, with a highlight that rides to the active word. `keyword` lands marked words big in condensed caps and
keeps the rest small. The specimen captions one narrated line about a made-up reading lamp three ways, one mode a
sentence to show the range, while the lamp reacts to the same word times: its head leans toward the words while the
voice runs and eases back at each pause, its light swells with the voice, it dims on "dims", and its light changes in
the frame each of Bright, Warm and Dark lands.

- **Built:** yes. Module `looks/captions.js`, specimen `specimens/captions` (1920 x 1080, 30 fps, 10 s, not a loop;
  timings in `specimens/captions/words.json`, made by `specimens/captions/trim_pauses.py`). Measured on an M1 Pro:
  120 ms a frame with 4 sub-frames of motion blur, 42 ms without (10 s clip runs, including capture and encoding).
  A 9:16 check, `specimens/captions/feed` (1080 x 1920), captions the same voice in the feed's clear zone: 0 inspect
  errors.
- **Best for:** narrated explainers and product films, voice-over ads, TTS lectures, talking-head cuts, lyric-style
  text for a song, vertical social cuts watched with the sound off. Any length; any aspect (a 9:16 feed zone is built
  in and checked by `specimens/captions/feed`).
- **Engine:** canvas, drawn over whatever the look draws (call it last, outside any camera). Cost to add to a film: S
  (a timing file and a plan). Layer-order risk: low (captions draw last), but a caption can cover a face or a product:
  place it on purpose.
- **Atlas:** no look of its own: it is cross-cutting. Audio findings: 8 of 232 films carry speech (5 TTS, 3 real
  voices) and 2 a sung vocal; long TTS lectures leave about 1 s of silence after every sentence; on-screen text
  carries the message nearly everywhere else. Lessons: captions should say something exact, and type must be readable
  at delivery size. References: [gautam-mer1-2ae354](https://prompt-motion.com/gautam-mer1-2ae354) (7/10, a caption
  app's promo: word-by-word captions with a highlighted active word) and
  [samaote-5e2fc2](https://prompt-motion.com/samaote-5e2fc2) (8/10, a lyric video timed to the vocal, one placed line
  per phrase).

## What it is, and isn't

It turns a voice into readable text that keeps time with it, and nothing more. The words, their timing and their
breaks come from the voice: the module never invents emphasis the narration doesn't have, and the key words for
`keyword` mode are chosen by the film, not guessed. It isn't a title system (use the look's own type for titles and
supers), it isn't a typewriter (words appear when spoken, not letter by letter), and it isn't decoration: if the film
has no voice, it has no captions. Banned with it: karaoke bouncing balls, rainbow word colours, every word a different
size, captions that shake on every beat, and corner telemetry dressed as captions.

## Modes

- **`subtitle`**: cards of one or two lines of at most 42 characters, centred low in the frame on a plate. A card
  holds a sentence where it fits, breaks lines after punctuation or before a conjunction or preposition, never after
  an article or a preposition, and prefers a bottom-heavy pair. A card appears with its first word, stays up to 0.5 s
  after its last, at least 0.83 s and at most 7 s, and ends at least 2 frames before the next (a gap under 0.5 s
  closes to 2 frames, so cards chain instead of flickering).
- **`kinetic`**: pages of up to 5 words and 2 lines of 20 characters. A page always breaks on a pause of 150 ms or more
  and at a sentence end, and otherwise where `subtitle` would. Each word pops in on a spring at its start time (or
  blurs or rises in); a pill rides to the word being spoken, its two edges on different springs so it stretches as it
  travels, and the text under it changes colour exactly where the pill covers it. A page holds until the next one
  starts, or 1.2 s after its last word, then leaves with a short lift and blur.
- **`keyword`**: the same pages, with marked words (`keys` in `load`, `*word*` in the JSON, or `key: true`) on a row
  of their own in Barlow Condensed Black caps, landing with a scale-down slam; the other words stay small and rise in.
  The page breaker prefers one key a page and likes to end a page on a key.

A plan switches modes by time: `[[0, 'subtitle'], [4.2, 'kinetic', { size: 90 }], [8, null]]`. Each window holds the
words that start inside it, and its last card or page leaves by the next window's start.

## Rules

| | Subtitle | Kinetic | Keyword |
|---|---|---|---|
| A card or page | 1-2 lines of at most 42 characters | at most 5 words, 2 lines of 20 characters | at most 5 words; key words on their own row |
| Breaks | after punctuation, before a conjunction or preposition; never after an article or preposition; a sentence a card where it fits | always on a pause of 150 ms or more and at a sentence end; otherwise as subtitles | as kinetic; one key a page, a page likes to end on its key |
| On screen | from the first word; up to 0.5 s after the last; at least 0.83 s, at most 7 s | from the first word until the next page, or 1.2 s after the last word | as kinetic |
| Between | at least 2 frames; a gap under 0.5 s closes to 2 frames | the old page is gone before the next page's first word | as kinetic |
| Reading speed (`check()`) | at most 20 characters a second | at most 20 characters a second | at most 20 characters a second |

## Materials and palette

- Defaults: white text, a black plate at 62% for subtitles, a soft shadow for pages, a warm yellow pill (`#FFD447`)
  with near-black text on it. Over a flat look, set `edge: 'none'` and take the look's own ink and accent (the
  specimen: ink `#1D2230` on cream, an amber `#F2A93B` pill, cream type on the night wall). Two colours for captions,
  three with the highlight; never one colour per word.
- `plate: 'line'` (a box per line, touching, so a two-line card reads as one stepped block), `'block'` (one box) or
  `false`; `edge: 'shadow' | 'outline' | 'none'` when there is no plate.
- Positions: `'bottom'` (subtitles), `'lower'` (pages, the lower third), `'centre'`, `'top'`, or `[fx, fy]` as
  fractions of the frame. Safe areas: `'frame'` (5%, kit.js's default), `'title'` (10%), `'feed'` (a 9:16 feed's
  clear zone: 6% left, 12% top, 14% right, 28% bottom, clear of the tabs, the right-hand buttons and the caption
  block). For a feed, also set `PROJECT.safeRect` to the same zone so `--inspect` checks it: config.js loads before the
  engine, so write the numbers (`[65, 230, 864, 1152]` at 1080 x 1920; `captions.feedRect()` returns them at run time).
  `specimens/captions/feed` is a working example: `node render.mjs --project=specimens/captions/feed --inspect`.

## Type

Space Grotesk for subtitles and pages (600, 700 on pages), Barlow Condensed Black caps for key words. Sizes at 1080p,
scaled to the frame's short side: subtitles 52 px, kinetic pages 84 px (92 in the specimen), keyword small words 48 px
and key words up to 210 px. Every row is fitted to the width it has: a long line shrinks rather than leaving the safe
area. Words on a page are spaced 0.3 em apart, a little wider than the font's space, so each word reads as a unit as
it lands. For a 9:16 feed, drop subtitles to `lineChars: 30`: the feed zone leaves a row 812 px wide at 1080 x 1920,
and 32 characters of Space Grotesk 600 at 52 px measure 835 px (the feed check prints this), so about 31 fit before
the row shrinks. For bigger feed subtitles, `size: 60, lineChars: 26` (by the same measure; not rendered).

## Motion grammar

- Subtitles don't move: they cut on and off with a 0.07 s fade. A card that animates is harder to read.
- Words land at their start time minus 0.03 s, on springs from kit.js's family: a pop from 0.55x (`380/20`: it peaks
  near 1.07x) for kinetic words, a slam from 1.35x (`520/30`) for key words, an `outExpo` rise for small words.
- The pill uses `edges()`: the leading edge on a quicker spring (`420/32`) than the trailing one (`220/26`), so it
  stretches toward the next word and catches up. It grows in with the first word and fades from 0.3 s after the last
  word ends.
- A page leaves over 0.16 s on the `exit` curve, lifting 14 px with a little blur, and is gone before the next page's
  first word arrives.
- Pictures follow the same voice. `captions.level(t)` is a 0..1 envelope of the speech: it rises at each word and
  falls in the pauses (`attack` 0.08 s, `release` 0.35 s by default). `captions.active(t)` is the word being spoken.
  The specimen drives two things with it: the lamp's head leans 5.5 degrees toward the words with
  `level(t, { attack: .22, release: .26 })`, so it nods a little at a comma and fully at a full stop, and the light
  rises 20% with the default `level(t)`. Drive something large: a 6 px dot that reacts is invisible at delivery size.
- A picture event tied to a key word starts at the key word's in-time (its start minus `pre`, 0.03 s), when the
  previous page has just gone, so no frame shows the old caption over the new picture. The specimen's light switches
  this way.

## Recipe

1. Write the narration first: short sentences, room between them. Get word timings from the voice you will ship: a
   TTS alignment (ElevenLabs "with timestamps"), a speech-to-text word list (ElevenLabs Scribe) or whisper-cli DTW on
   the recording. video-sound's `sound.py words <input> -o words.json` converts any of them to
   `{ words: [{ w, start, end }] }`. For scratch timing only, `say -o line.aiff "..."` then `sound.py words line.aiff`;
   never ship a `say` voice.
2. Put the pauses and the script back. DTW gives each word the next word's start as its end, so pauses vanish and
   pages can't break on them; whisper also misspells names and loses full stops, and punctuation drives the breaks.
   `python3 specimens/captions/trim_pauses.py words.json voice.wav --script script.txt -o words.trimmed.json` ends
   each word where the first silence inside it begins (ffmpeg silencedetect at -38 dB, 0.1 s), restores the script's
   spelling and punctuation word for word, and prints the pauses it found. The specimen's `words.json` is its output
   on a scratch `say` line (not shipped).
3. At the top of a scene: `const VOICE = captions.load('path/words.json', { offset, keys: ['Bright', ...] })`. `offset`
   moves every time (the voice's start in the film).
4. Choose the plan. One mode for the whole film is the default: it is one organising idea, and viewers learn where to
   look. Switch only at a structural change (keyword captions for the payoff line or a chapter title, subtitles for a
   quoted voice), never sentence by sentence; the specimen does that only to show the range. Keep the caption's
   anchor where it was across a switch unless the composition calls for a move (the specimen's pages leave the
   subtitle line for the open wall beside the lamp, because 92 px pages and 236 px key words need that room).
   Put each window's start a hair (0.06 s) before its first word.
5. Call `captions.check(plan)` at load time: it prints every card or page faster than 20 characters a second, and for
   subtitles every card under 0.83 s, closer than 2 frames, over 42 characters a line or longer than 7 s. Fix fast
   pages with more words a page (`maxWords`), a slower read, or a subtitle mode for that stretch.
6. Draw last in the shot, outside any camera: `captions.draw(t, plan)`. When the picture changes under the captions,
   change their colour by page, not by frame: give the page its own window with its own style (the specimen's last
   page, "Dark for sleep.", has a window with cream type for the dark room). Start such a same-mode window 0.001 s
   before its first word, not 0.06 s: the previous window's last page leaves at the window's start minus `pre`, so a
   0.06 s lead would leave a 0.09 s hole between pages (keep the 0.06 s lead for mode changes). A colour that follows
   the frame flips mid-slam or passes through grey. Layout is cached by the fields that move things.
7. Cues from the same times: `captions.segments(plan)` gives every card and page with its `in` and `out` at load
   time, for a soft pop per page; key words for a heavier hit. Keep effects between lines where you can.
8. Check: `--sheet` across each mode change, `--strip` over a page change, `--inspect`, `--determinism`, then
   `--clip --subframes=4` (key-word slams step visibly at 3 sub-frames).

## Failure modes and checks

- `--inspect` warns "reading-time" on most captions, by design. Its rule (1 s plus 3 words a second) is for text
  nobody is saying; a caption is on screen exactly as long as the voice takes to say it, and the viewer hears it too.
  The specimen gets 6 such warnings (the subtitle card and every page but the last) and passes `captions.check()`,
  the caption standard (at most 20 characters a second), on all of them. Fix real errors (out of frame, collisions,
  tiny type); judge reading time with `check()`. Captions register as `@cap:...` ids: render.mjs `--inspect` judges ids that start `@` as voiced captions (at most 20
  characters a second, at least 0.83 s) rather than by the 1 s + 3 words a second rule for unvoiced text. Ids that start `~` (`ids: '~cap'`) skip the reading-time and size
  checks; use them only for a deliberately fast lyric stretch.
- DTW word times wander by about 0.1 s and sometimes stretch a short word (the specimen's "you" runs 0.42 s). Captions
  tolerate it; effects synced to a syllable should be checked by ear.
- Whisper writes what it hears: names come out misspelt and sentences come out as one comma chain (it heard "talk,
  say softer," for "talk. Say softer."). Restore the script's punctuation, or pages won't break at sentence ends.
- Captions under a camera move with it: draw them after `CX.restore()`.
- `load('path.json')` reads the file synchronously. render.mjs's Chrome may read local files; a browser opening
  `film.html` from disk may not: serve the engine folder over http, or pass the JSON object itself.
- Over busy footage, white text without a plate needs `edge: 'shadow'` or `'outline'`; check a still at full size.
- When the light changes under a caption, check the scenery too, at full size: in the specimen's first night room the
  navy book shaded to the wall's colour and vanished from the closing hold. Shade toward a tone the palette doesn't
  already use, and give dark objects a faint rim.

## Sound palette

The voice leads; captions add no sound of their own beyond the film's. A soft pop when a kinetic page lands (weight
0.3 or less, or none), a firmer hit or a click on a key word if the picture does something there (the specimen's lamp
switches), and nothing under subtitles. Put effects in the gaps between lines; video-sound's `mix --voice` ducks the
music under the narration and flags effects buried under a syllable. Master to -14 LUFS for feeds, with the voice at
least 6 dB clear of the bed.
