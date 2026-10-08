// kinetic specimen: Sunday pancakes in four verbs and a change of heart. 1080 x 1080, 60 fps, 11 s, 120 BPM (a beat
// is .5 s; tb(n) is beat n). "crack" shivers, cracks and splits the frame, and the yolk pops out; "whisk" swirls out of
// the gap under it, the yolk landing as its i's dot; the letters spiral into the yolk, which is tossed off the top on
// the flip; "stack" is tossed in letter by letter, pancakes on a pile; the yolk drops back on top; the pile sways and
// topples; "share" slams in and the yolk lands after it as a full stop. Over half a second of nothing. The yolk changes
// its mind and strikes the word out on its way back; "mine" rolls in and the yolk lands as its i's dot, a callback to
// "whisk". "serves 1" types itself under it, and the end holds two seconds so the kicker reads.
const b = tb, C = KIN.S, SC = KIN.SC;          // SC: 1 at 1080 px on the short side; every pixel constant scales by it
const R = 34 * SC, FLOOR = H - 112 * SC, PILE_SIZE = 268 * SC;

// ---------- the cue sheet: every time below is a beat (or a fraction of one) ----------
const AT = {
  crack: b(2),            // the crack runs through the word
  split: b(2.5),          // the halves part; the yolk pops out
  whiskIn: b(2.5),        // the letters swirl out of the gap
  tittle: b(3.5),         // the yolk lands as the i's dot
  swallow: b(7) - .28,    // the letters spiral into the yolk, the last one gone on the flip
  toss: b(7),             // the field flips; the yolk is tossed out of the top, and the first letter is already falling
  stackIn: b(7.5) - .3,   // the first letter lands on b(7.5), the rest on triplets after it
  butter: b(9.5),         // the yolk drops back onto the pile
  sway: b(9.7),           // the pile starts to sway, more and more
  topple: b(11.5),        // over it goes
  impact: b(12.5),        // it hits: the field flips, "share" slams in
  stop1: b(13),           // the yolk lands after it: "share."
  strike: b(14.5),        // after over half a second of nothing, it strikes back across the word
  swap: b(16),            // "share" rolls out, "mine" rolls in
  stop2: b(17),           // the yolk lands as mine's i's dot
};
AT.type = AT.stop2 + .15;            // "serves 1" types itself once the yolk has landed: done by about 9.05 s
const ST = BEAT / 3, FALL = .3;      // the pile: one letter per triplet eighth, .3 s in the air
AT.leave = AT.topple + .18;          // the yolk is flung off the falling pile
const SWAP = KIN.swap(AT.swap, { lag: .12 });   // the in-roll trails the out-roll, so the two overlap less

// ---------- the words ----------
const off = () => (KIN.place({ text: 'share', face: 'sans', fit: W * .7 }).L.size * .1 + 2 * R) / 2;   // "share." centres as a unit, dot included
const CRACK = { id: 'crack', text: 'crack', face: 'display', fit: W * .8, x: W / 2, y: H / 2, mid: true, acts: [
  [0, 'shiver', { until: AT.crack, amp: 5 * SC, stop: AT.split }],
  [0, 'push', { amt: .025, until: AT.split }],
  [AT.crack, 'squash', { amt: .06 }],
  [AT.split, 'split', { line: AT.crack, color: C.cobalt, seed: 7 }],
] };
const WHISK = { id: 'whisk', text: 'whisk', face: 'display', fit: W * .72, x: W / 2, y: H / 2 + 36 * SC, mid: true, dotless: [2], acts: [
  [AT.whiskIn, 'orbit', { mode: 'in', turns: 1.1, stagger: .045, r0: .06 }],
  [AT.tittle, 'squash', { amt: .12, at: 2 }],
  [AT.tittle, 'push', { amt: .035, until: AT.swallow }],
  [AT.swallow, 'orbit', { mode: 'out', c: () => TIT(AT.swallow), turns: 1, dur: .24, stagger: .025, order: 'near' }],
] };
const STACK = { id: 'stack', text: 'stack', face: 'display', size: PILE_SIZE, x: W / 2, y: FLOOR, acts: [
  // the first letter in falls .5 s instead of .3 (it has furthest to go), so it is already in view on the flip
  [AT.stackIn, 'stack', { base: [W / 2, FLOOR], stagger: ST, fall: FALL, fall0: .5, hits: [[AT.butter, .22]], flat: [1.6, .8], seed: 3 }],
  [AT.sway, 'tilt', { pivot: [W / 2, FLOOR], angle: t => .05 * easeIn(seg(t, AT.sway, AT.topple)) * Math.sin(TAU * 2 * seg(t, AT.sway, AT.topple)) * (t < AT.topple ? 1 : 0) }],
  [AT.topple, 'tilt', { pivot: [W / 2 + .34 * PILE_SIZE, FLOOR], angle: t => Math.PI / 2 * seg(t, AT.topple, AT.impact) ** 2 }],
] };
const SHARE = { id: 'share', text: 'share', face: 'sans', fit: W * .7, x: () => W / 2 - off(), y: H / 2 - 40 * SC, mid: true, acts: [
  [AT.impact, 'drop', { from: -150 * SC, fall: .09, stagger: 0, squash: .34 }],
  [AT.stop1, 'squash', { amt: .08, at: 4 }],
  // drawn back from the full stop by the yolk; each letter's piece fades just before that letter rolls away
  [AT.strike, 'strike', { from: 'right', left: .98, right: c => R / c.L.xh, overR: c => c.L.size * .1 + R, overL: c => c.L.size * .05, lw: R * 1.15, dur: .32, color: C.yolk,
    fade: [AT.swap - .06, AT.swap + .04], fadeStagger: .04 }],
  SWAP.out,
] };
// "mine" sits centred on its own (no full stop: the yolk is its i's dot), same size and line as "share"
const MINE = { id: 'mine', text: 'mine', face: 'sans', fit: W * .7, fitText: 'share', x: W / 2, y: () => KIN.place(SHARE).y, dotless: [1], acts: [
  SWAP.in,
  [AT.stop2, 'squash', { amt: .14, at: 1 }],
  [AT.stop2, 'push', { amt: .025, until: DUR }],
] };
const SERVES = { id: 'serves', text: 'serves 1', face: 'mono', size: 58 * SC, x: W / 2, y: () => KIN.place(SHARE).y + 160 * SC, color: mixCol(C.cream, C.ink, .15), acts: [
  [AT.type, 'type', { cps: 20, caret: false }],
] };

// ---------- the cards: a field each, flipped on the beat ----------
const CARDS = [
  { t: 0, until: AT.split + .7, field: C.cream, ink: C.ink, top: [AT.split, AT.split + .7], words: [CRACK] },
  { t: AT.split, until: AT.toss, field: C.cobalt, ink: C.cream, words: [WHISK] },
  { t: AT.toss, until: AT.impact, field: C.cream, ink: C.ink, words: [STACK] },
  { t: AT.impact, until: AT.swap + .6, field: C.ink, ink: C.cream, words: [SHARE] },
  { t: AT.swap, field: C.ink, ink: C.cream, words: [MINE, SERVES] },
];

// ---------- the yolk: where it is, from the same anchors the words use ----------
const MID = () => { const c = KIN.place(CRACK); return [c.cx, c.y - c.L.xh * .55]; };
const TIT = t => KIN.tittle(t, WHISK, 2, R);
const PILE = t => KIN.top(t, STACK, 0, R);
// mine's i is still rolling in during the hop: aim at where its dot will be when the yolk lands, then ride it
const MINE_TIT = t => KIN.tittle(Math.max(t, AT.stop2), MINE, 1, R);
const DOT = [
  { t: 0, at: MID, r: 0 },
  { t: AT.split, at: MID, r: R, pop: true },                                       // out of the crack
  { t: AT.tittle, at: TIT, how: 'hop', dur: AT.tittle - AT.split - .04, h: 210 * SC, land: .45 },
  { t: AT.toss - .03, at: () => TIT(AT.swallow), pulse: .45 },                     // swells as the letters go in
  { t: AT.toss + .32, at: [W * .82, -R * 3], how: 'toss', dur: .32, spin: 1.5 },   // tossed out of the top, on the flip
  { t: AT.butter - .42, at: [W / 2 + 6 * SC, -R * 3] },                             // (out of frame: line it up)
  { t: AT.butter, at: PILE, how: 'fall', dur: .4, land: .55 },                      // back on top, riding the pile
  { t: AT.stop1, at: t => KIN.stop(t, SHARE, R), how: 'hop', dur: AT.stop1 - AT.leave, h: 170 * SC, land: .45 },
  { t: AT.strike + .32, at: t => KIN.strikeHead(t, SHARE, SHARE.acts[2]), how: 'ride', dur: .32 },
  { t: AT.stop2, at: MINE_TIT, how: 'hop', dur: .42, h: 320 * SC, land: .5 },        // a high arc, clear of the swap
];

// ---------- sound cues, from the same times ----------
cue(AT.crack, 'snap', { weight: 1, id: 'crack' });
cue(AT.tittle, 'pop', { weight: .8, id: 'tittle' });
cue(AT.swallow, 'suck', { weight: .6, dur: .3, id: 'swallow' });
for (let i = 0; i < 5; i++) cue(AT.stackIn + i * ST + FALL, 'tock', { weight: .5, pitch: i * 2, id: 'stack' });   // each letter landing, rising
cue(AT.butter, 'pop', { weight: .7, id: 'butter' });
cue(AT.impact, 'thump', { weight: 1.1, id: 'topple' });
cue(AT.stop1, 'pop', { weight: .5, id: 'stop1' });
// nothing from the full stop to the strike: .75 s of silence is the set-up
cue(AT.strike, 'swish', { weight: .9, dur: .32, id: 'strike' });
cue(AT.stop2, 'land', { weight: 1, id: 'stop' });

KIN.shots(CARDS, { dot: DOT });

// ---------- a model sheet of the acts the film doesn't use: render.mjs --loop=acts ('~' ids: performances repeated fast on purpose) ----------
LOOPS.acts = t => {
  bg(C.cream);
  KIN.word(t, { id: '~m:stretch', text: 'stretch', face: 'display', fit: W * .42, x: W / 2, y: H * .22, mid: true, acts: [[.3, 'stretch', { k: 1.5, anchor: 'left', hold: .6 }]] });
  KIN.word(t, { id: '~m:flip', text: 'flip', face: 'display', fit: W * .3, x: W / 2, y: H * .5, mid: true, acts: [[.5, 'flip', { stagger: .06 }], [2, 'flip', { stagger: 0, turns: .5 }], [2.6, 'flip', { stagger: 0, turns: .5 }]] });
  KIN.word(t, { id: '~m:fall', text: 'fall', face: 'sans', fit: W * .36, x: W / 2, y: H * .8, mid: true, color: C.cobalt, acts: [[.1, 'drop', { order: 'mid' }], [2.4, 'fall', {}]] });
};
LOOPS.acts.len = 3.2;
