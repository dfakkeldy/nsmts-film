// diagram specimen: why a retry can charge you twice, taught on one stage in four steps (12.5 s, 96 BPM: five bars of
// 2.5 s). 1 (one bar) the reply is lost and the client's timer runs out; 2 (one bar) the obvious fix, a retry, charges
// the £20 twice; 3 (two bars) the mechanism: rewind, and the first charge turns out to be filed under the client's key,
// which PAYMENTS saves in KEYS; then the retry carries the same key, PAYMENTS looks it up, finds it and sends back the
// saved reply; 4 (one bar) the trade-off: every key has to be kept, for a day. The £20 request is the through-line
// object, and every message wears its sender's colour (client butter, payments sky, keys mint); coral only ever means
// "wrong". Poster frame: 9.9 s (all three boxes, the key in each, ALREADY PAID, the client PAID).
const b = tb, S = DIA.S;

// ---------- the cast, on the 60 px grid ----------
const CLIENT = DIA.cell(2, 8, 7, 5), SERVER = DIA.cell(13, 5, 8, 7), KEYS = DIA.cell(24, 8, 6, 6);
const REQ = DIA.elbow(DIA.pin(CLIENT, 'r', 10), DIA.pin(SERVER, 'l', 7), { at: 640 });    // the request: up and right
const REP = DIA.elbow(DIA.pin(SERVER, 'l', 9), DIA.pin(CLIENT, 'r', 12), { at: 690 });    // the reply: nested inside it
const LOOK = DIA.elbow(DIA.pin(SERVER, 'r', 9), DIA.pin(KEYS, 'l', 11), { at: 1350 });    // payments <-> keys
const LOOK_BACK = LOOK.slice().reverse();

// ---------- the timeline (every time below drives both the picture and the cues) ----------
const A2 = bar(1), A3 = bar(2), A4 = bar(3), A5 = bar(4);   // bar lines: 2.5, 5, 7.5, 10
const WAIT = 1.8;                                             // the client's timeout
// 1: the reply is lost (half way down the wire, between the boxes)
const IN_C = -.6, IN_S = .22, DRAW_REQ = [.3, .6], DRAW_REP = [.38, .68];
const SEND1 = A2 - WAIT, ARR1 = b(2), OUT1 = ARR1 + .12, BACK1 = OUT1 + .85, LOST1 = OUT1 + .4;   // .7, 1.25, 1.37, lost 1.77; it times out at 2.5
// 2: the obvious fix: a retry, and a second charge
const SEND2 = A2 + .15, ARR2 = b(5), OUT2 = ARR2 + .08, BACK2 = OUT2 + .45, STAMP2 = ARR2 + .28;
// 3a (bar 3): rewind, pull out, and where the key comes from, one beat apart once the camera has settled
const IN_K = A3 + .15, DRAW_LK = [A3 + .3, A3 + .6], KEYC = b(9) + .12, KEYL = b(10) + .05, SAVE = b(11) - .1, SAVED = SAVE + .35;
// 3b (bar 4): the keyed retry, one event a beat: send, look up, the verdict, the saved reply
const SEND3 = A4, ARR3 = SEND3 + .5, LOOK3 = b(13), HIT3 = LOOK3 + .3, BACKK = HIT3 + .05, ANS3 = BACKK + .3;
const STAMP3 = ANS3 + .02, OUT3 = ANS3 + .25, BACK3 = OUT3 + .45;
// 4: the trade-off: more payments, more keys, each kept for a day
const MORE = [A5 + .3, A5 + .95, A5 + 1.575], NOTE = A5 + .625, LAND = MORE.map(m => m + .3);

const STEPS = [
  { t: -.2, n: 1, title: 'THE REPLY GETS LOST', col: S.coral },   // already sliding in on frame 0
  { t: A2, n: 2, title: 'SO, JUST RETRY?', col: S.coral },
  { t: A3, n: 3, title: 'RETRY WITH A KEY', col: S.mint },
  { t: A5, n: 4, title: 'COST: KEEP EVERY KEY', col: S.mint },
];
// The camera holds the two boxes, pulls out as the third arrives (to zoom 1.04, not 1: the boxes' pop-in dips 4% under
// full size, and 28 px type needs the headroom), then leans in to KEYS for the cost and leaves the client behind.
const CAM = [[0, [690, 495, 1.3]], [A3 - .05, [965, 560, 1.04], 'smooth'], [A5 - .1, [1300, 572, 1.3], 'heavy']];

// ---------- the client ----------
const CLIENT_STATUS = [[SEND1, 'WAITING', S.butter], [A2, 'TIMED OUT', S.coral], [BACK2, 'PAID', S.mint], [A3, 'TIMED OUT', S.coral], [BACK3, 'PAID', S.mint]];
// the timeout ring: { on: when this timer takes over, t0, stop, from: its level at t0 }. Step 3 rewinds to the moment
// the first timer ran out, then the keyed retry starts a fresh one.
const TIMERS = [{ on: 0, t0: SEND1 }, { on: SEND2, t0: SEND2, stop: BACK2, from: 0 }, { on: A3, t0: A3 - WAIT }, { on: SEND3, t0: SEND3, stop: BACK3, from: 0 }];
function clientBody(r, t, live) {
  DIA.say(live ? 'client:pay' : null, 'PAY £20', r.x + 24, r.y + 76, { size: 44 });
  const tm = TIMERS.filter(x => t >= x.on).pop();
  DIA.ring(r.x + r.w - 58, r.y + 60, 38, t, tm.t0, WAIT, tm);
  const kk = backOut(seg(t, KEYC, KEYC + .32));
  if (kk > 0) { const x = r.x + 24, y = r.y + 168; CX.save(); CX.translate(x, y); CX.scale(kk, kk); CX.translate(-x, -y);
    DIA.tag(live && t > KEYC + .32 ? 'client:key' : null, 'KEY k-42', x, y, { fill: S.mint, size: 30 }); CX.restore(); }
}

// ---------- the payments server: a ledger of charges ----------
const LEDGER = [
  { t: ARR1, id: 'charge1', cells: [{ s: '#1', x: 0, col: S.mute }, { s: '£20.00', x: 70 }, { s: 'k-42', x: 'right', tag: S.mint, at: KEYL }] },
  { t: ARR2, id: 'charge2', fill: mixCol(S.white, S.coral, .22), hatch: S.coral, strike: A3, cells: [{ s: '#2', x: 0, col: S.mute }, { s: '£20.00', x: 70 }] },
];
function serverBody(r, t, live) {
  DIA.say(live ? 'server:head' : null, 'CHARGES', r.x + 20, r.y + 46, { size: 28, color: S.mute });
  DIA.list({ x: r.x, y: r.y + 62, w: r.w, h: r.h - 62 }, LEDGER, t, { size: 36, rowH: 60, top: 0, live });
}

// ---------- the keys table, and its count (the number moves with the rows it counts) ----------
const KEYROWS = [
  { t: SAVED, id: 'key42', flash: HIT3, cells: [{ s: 'k-42', x: 0 }, { s: 'PAID', x: 'right', tag: S.mint }] },
  ...['k-87', 'k-91', 'k-95'].map((k, i) => ({ t: LAND[i], id: `~key${i}`, cells: [{ s: k, x: 0 }, { s: 'PAID', x: 'right', tag: S.mint }] })),
];
const KEYN = [[0, 0], [SAVED - .05, 1], ...LAND.map((l, i) => [l - .05, i + 2])];   // a hair early: the snappy spring passes the half a beat later
const keysBody = (r, t, live) => DIA.list(r, KEYROWS, t, { order: 'prepend', size: 32, rowH: 54, live });
const keysHead = (h, t, live) => DIA.count(live ? 'keys:n' : null, h.x + h.w - 54, h.y + h.h / 2 + 2, t, KEYN, { spring: 'snappy', tag: S.white, align: 'right', size: 34 });

// where the first reply fell off the wire, and when the retry's reply passes that spot (the cross goes as it does)
const LOSTP = EASE.inOut(seg(LOST1, OUT1, BACK1)), LOSTXY = DIA.along(REP, LOSTP);
let PASS2 = OUT2; while (PASS2 < BACK2 && EASE.inOut(seg(PASS2, OUT2, BACK2)) < LOSTP) PASS2 += 1 / 240;

// ---------- the frame ----------
shots([[0, t => {
  CX.save(); cam(...DIA.view(t, CAM)); DIA.paper();
  // wires first: everything else sits on them
  DIA.wire(REQ, { p: EASE.outExpo(seg(t, ...DRAW_REQ)) });
  DIA.wire(REP, { p: EASE.outExpo(seg(t, ...DRAW_REP)) });
  DIA.wire(LOOK, { p: EASE.outExpo(seg(t, ...DRAW_LK)), head: 'both', dash: true, t });
  // the cast; the client leaves the story (and the frame) as the camera leans in for step 4
  DIA.node(CLIENT, { t, at: IN_C, label: 'CLIENT', fill: S.butter, hits: [BACK2, BACK3], status: CLIENT_STATUS, draw: clientBody, read: t < A5 - .1 });
  DIA.node(SERVER, { t, at: IN_S, label: 'PAYMENTS', fill: S.sky, hits: [ARR1, ARR2, ARR3, ANS3], shakes: [STAMP2],
    led: [[0, S.mint], [ARR2, S.coral], [A3, S.mint]], draw: serverBody });
  DIA.node(KEYS, { t, at: IN_K, label: 'KEYS', fill: S.mint, hits: [SAVED, HIT3, ...LAND], led: S.mint, draw: keysBody, head: keysHead });
  const ca = 1 - seg(t, PASS2 - .05, PASS2 + .25);
  if (t >= LOST1 && ca > 0) { CX.save(); CX.globalAlpha *= ca; DIA.cross(LOSTXY[0], LOSTXY[1], 30, EASE.outExpo(seg(t, LOST1, LOST1 + .22))); CX.restore(); }
  // the messages: each slides into its receiver through the wall
  DIA.packet(REQ, t, SEND1, ARR1, { label: '£20', fill: S.butter, into: SERVER });
  DIA.packet(REP, t, OUT1, BACK1, { label: 'OK', fill: S.sky, lost: LOST1, drift: 140 });   // hops off half way down
  DIA.packet(REQ, t, SEND2, ARR2, { label: '£20', fill: S.butter, into: SERVER });
  DIA.packet(REP, t, OUT2, BACK2, { label: 'OK', fill: S.sky, into: CLIENT });
  DIA.packet(LOOK, t, SAVE, SAVED, { dot: true, fill: S.sky, into: KEYS });                // payments files k-42
  DIA.packet(REQ, t, SEND3, ARR3, { label: '£20', key: 'k-42', fill: S.butter, into: SERVER });
  DIA.packet(LOOK, t, LOOK3, HIT3, { dot: true, fill: S.sky, into: KEYS });                // seen k-42?
  DIA.packet(LOOK_BACK, t, BACKK, ANS3, { dot: true, fill: S.mint, into: SERVER });        // yes: paid
  DIA.packet(REP, t, OUT3, BACK3, { label: 'OK', fill: S.sky, into: CLIENT });             // the saved reply
  MORE.forEach((m, i) => DIA.packet(LOOK, t, m, LAND[i], { dot: true, fill: S.sky, into: KEYS }));   // other payments' keys
  // the verdicts, on the same spot of the ledger
  DIA.stamp('stamp:twice', 'CHARGED TWICE', 1020, 640, t, STAMP2, { off: A3 + .2 });                   // the rewind lifts it
  DIA.stamp('stamp:paid', 'ALREADY PAID', 1020, 640, t, STAMP3, { fill: S.mint, rot: 4 });   // stays: the last frame holds the whole lesson
  // the cost
  DIA.note('note:ttl', 'KEPT 24 H', KEYS.x, KEYS.y + KEYS.h + 42, t, NOTE, { ring: [NOTE + .3, 5] });
  CX.restore();
  DIA.caption(t, STEPS);
}]]);

// ---------- sound cues, from the same times ----------
cue(SEND1, 'click', { weight: .6, pan: -.45, id: 'send' });
cue(ARR1, 'pop', { weight: .7, pan: -.1, id: 'charge' });
cue(LOST1, 'drop', { weight: .8, pan: -.25, id: 'lost' });
cue(A2, 'tock', { weight: 1, pan: -.5, id: 'timeout' });
cue(SEND2, 'click', { weight: .6, pan: -.45, id: 'retry' });
cue(ARR2, 'pop', { weight: .7, pan: -.1, pitch: 2, id: 'charge' });
cue(STAMP2, 'thump', { weight: 1.2, pan: .05, id: 'charged-twice' });
cue(KEYC, 'snap', { weight: .45, pan: -.55, id: 'key' });
cue(SAVED, 'tick', { weight: .5, pan: .55, id: 'key-saved' });
cue(SEND3, 'click', { weight: .6, pan: -.45, id: 'retry-key' });
cue(HIT3, 'tick', { weight: .6, pan: .55, pitch: 3, id: 'key-found' });
cue(STAMP3, 'land', { weight: 1, pan: .05, id: 'already-paid' });
cue(BACK3, 'chime', { weight: .8, pan: -.45, id: 'paid' });
// nothing on the pop-ins, the wires or the last step: the cost should land in quiet

// ---------- the gauges the film doesn't use, on the same stage (render.mjs --loop=parts) ----------
// A lease that drains steadily (kf with linear) with the seconds left, and a pour that rises on springs against ticks,
// with its millilitres: each number is driven by the same keys as its bar.
const LEASE = [[0, 1], [.3, 1], [3.6, 0], [4, 0]], POUR = [[0, 0], [.4, .45], [1.6, .82], [3.1, 0]];
LOOPS.parts = t => {
  DIA.paper();
  DIA.say('parts:lease', 'LEASE', 240, 400, { size: 34 });
  DIA.meter(240, 430, 720, 64, t, LEASE, { ease: linear, ticks: 10, fill: S.sky, limit: .2, bad: 'below' });
  DIA.count('parts:sec', 960, 400, t, LEASE, { ease: linear, map: v => v * 30, fmt: v => `${v} S`, align: 'right', size: 34 });
  DIA.meter(1280, 260, 180, 520, t, POUR, { dir: 'up', ticks: 10, units: 4, fill: S.butter, limit: .75 });
  DIA.count('parts:ml', 1370, 860, t, POUR, { map: v => v * 200, fmt: v => `${v} ML`, align: 'center', tag: S.white, size: 40 });
};
LOOPS.parts.len = 4;
