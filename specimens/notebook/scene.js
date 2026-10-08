// notebook specimen: one page of a flight-test notebook, 10 s at 30 fps, 120 BPM (5 bars), one continuous take.
// A pen draws a paper plane; it comes alive, launches, stalls and crashes, and its onion skin stays on the page. A
// sticky note asks why; the wrong answer is written and struck out, the right one written in blue. The plane rewinds
// along its own path, a paperclip clips onto its nose, and the second flight glides until its nose rests on the X. The
// answer is highlighted, the landing ringed, and the camera pulls back to the whole page: the two flight records side
// by side are the conclusion.
const INK = NB.S.ink, RED = NB.S.red, BLUE = NB.S.blue, RAD = Math.PI / 180;
const pan = x => +clamp((x - W / 2) / (W / 2) * .6, -.8, .8).toFixed(2);

// ---------- times (the beat grid is 120 BPM: tb(n) = n / 2 s) ----------
// Pen marks sit at least NB.minGlide(distance) apart (.2 s or more), or the module inks them late and warns. The strike
// runs right to left, from where the pen finished writing, so the three notes can follow each other closely.
const T_SKETCH = .1, T_ALIVE = .85, T1 = tb(2.5), T1E = tb(5), T_STICKY = 2.8, T_ARROW = 2.92, T_W1 = 3.4, T_STRIKE = 4.1,
  T_W2 = tb(9), TR = 5.05, TRE = 5.85, T_CLIP = TRE + .05, T2 = tb(12.5), TOUCH = tb(15);   // T2E, T_HL, T_RING follow from TOUCH

// ---------- the protagonist: a paper plane, its two flights and the rewind between them ----------
const SIZE = 190, HOME = { x: 360, y: 720, a: -14 * RAD }, FLOOR = 880;
const R1 = NB.route([[360, 720], [460, 616], [565, 492], [655, 395], [730, 342], [782, 356], [818, 430], [850, 560], [880, 690], [905, 790]]);
const REST = [1617, FLOOR - NB.PLANE.w[1] * SIZE];   // where flight 2 stops: belly on the floor, nose on the X
const R2 = NB.route([[360, 720], [520, 636], [720, 604], [950, 630], [1180, 690], [1350, 758], [1440, 812], [1500, REST[1] - 1], [1560, REST[1]], REST]);   // the last 120 px are the skid
const fracNear = (R, [x, y]) => { let best = 0, bd = Infinity; const L = [0];
  for (let i = 1; i < R.pts.length; i++) L.push(L[i - 1] + Math.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]));
  R.pts.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = L[i] / L[L.length - 1]; } }); return best; };
const UP1 = fracNear(R1, [730, 342]);   // the stall: where the first flight runs out of speed
const nose = q => [q.x + SIZE * .5 * Math.cos(q.a), q.y + SIZE * .5 * Math.sin(q.a)];
const belly = q => Math.max(...NB.planePts(q.x, q.y, q.a, SIZE).map(p => p[1]));   // the plane's lowest point
// flight 1: fast off the hand, slowing to nothing at the top with the nose held up (the stall), a sharp pitch-over, then
// a dive that rocks from side to side. The heading is set against fixed attitudes, not added to the path's tangent.
function flight1(tt) {
  const k = seg(tt, T1, T1E), A = .5;
  const u = k < A ? UP1 * (1 - (1 - k / A) ** 2) : UP1 + (1 - UP1) * ((k - A) / (1 - A)) ** 2, q = R1.pose(u);
  // climbing it follows its path; at the top the nose is held up while the path tops out (the stall), then it pitches
  // over to a fixed nose-down attitude and falls rocking from side to side, about three times
  const d = k - .55, rock = d > 0 ? .35 * Math.sin(d * 24) * clamp(d * 8) * Math.exp(-d * 2) : 0;
  const a = k < .5 ? lerp(q.a, -72 * RAD, Math.exp(-(((k - .5) / .115) ** 2))) : lerp(72 * RAD + rock, -72 * RAD, Math.exp(-(((k - .5) / .19) ** 2)));
  return { x: q.x, y: q.y, a: lerp(HOME.a - .06, a, ease(seg(k, 0, .07))) };   // it leaves the hand at the wound-up angle
}
const NOSE1 = nose(flight1(T1E));
// after the crash it tips over on its nose
const crashed = tt => { const a0 = flight1(T1E).a, a = lerp(a0, 34 * RAD, springStep(tt - T1E, 'soft')); return { x: NOSE1[0] - SIZE * .5 * Math.cos(a), y: NOSE1[1] - SIZE * .5 * Math.sin(a), a }; };
// flight 2: the weighted plane glides long, slowing all the way, levels out, touches down with speed to spare and
// skids to a stop with its nose on the X. The touchdown is computed from the pose (the belly reaching the floor), and
// the flight is timed so it falls on TOUCH.
const G2 = k => 1 - (1 - clamp(k)) ** 1.5;
const pose2 = k => { const q = R2.pose(G2(k)); return { x: q.x, y: q.y, a: lerp(HOME.a - .06, lerp(q.a, 0, ease(seg(k, .6, .8))), ease(seg(k, 0, .07))) }; };
const K_TOUCH = (() => { for (let k = 0; k <= 1; k += 1 / 2000) if (belly(pose2(k)) >= FLOOR - 2) return k; return 1; })();
const T2E = T2 + (TOUCH - T2) / K_TOUCH, T_HL = T2E - .05, T_RING = T_HL + .32 + .3;
const flight2 = tt => pose2(seg(tt, T2, T2E));
// a throw: the hand draws back a little before letting go
const windUp = (tt, t0) => { const k = EASE.inOut(seg(tt, t0 - .32, t0)) * (tt < t0 ? 1 : 0); return { x: HOME.x - 18 * k * Math.cos(HOME.a), y: HOME.y - 18 * k * Math.sin(HOME.a), a: HOME.a - .06 * k }; };
const forward = tt => tt < T1 ? windUp(tt, T1) : tt <= T1E ? flight1(tt) : crashed(tt);
// the rewind: flight 1 from where it lies back to the hand, re-timed by distance so it runs at an even pace (playing
// forward() backwards in time would hang at the stall and jump through the dive), the crash's tip-over undone first
const BACK = NB.retrace(forward, TR, T1, { turn: SIZE * .45 }), back = t => BACK(NB.cruise(seg(t, TR, TRE), .2));
// the heading is averaged over the neighbouring frames, so the replayed pitch-over turns no faster than the real one
const rewind = t => { const q = back(t); let a = 0; [1, 2, 3, 2, 1].forEach((w, j) => a += w * back(t + (j - 2) / 30).a);
  return { ...q, a: lerp(a / 9, HOME.a, ease(seg(t, TRE - .12, TRE))) }; };
function planeAt(t) {
  if (t < TR) return forward(t);
  if (t < TRE) return rewind(t);
  if (t < T2) return windUp(t, T2);
  return flight2(t);
}
const CLIP_SPRING = 'snappy', CLIP_IN = springAt(T_CLIP, .97, CLIP_SPRING);
function drawPlane(t) {
  // the record of each flight stays on the page: a dotted path and ghosts at fixed times (pure functions of t)
  NB.trail(t, flight1, { from: T1, to: T1E, every: .05, minGap: SIZE * .5, s: SIZE, col: INK, rest: .3, fresh: .7, lw: 2.2, dots: 16, dotA: .3 });
  NB.trail(t, flight2, { from: T2, to: T2E - .3, every: .05, minGap: SIZE * .7, s: SIZE, col: BLUE, rest: .38, fresh: .75, lw: 2.2, dots: 16, dotA: .35 });
  if (t < T_ALIVE) return;
  // a fast frame leaves a faint smear of where the plane just was (a drawn motion blur: the throws and the rewind)
  const q = planeAt(t), q1 = planeAt(t - 1 / 30), sp = clamp((Math.hypot(q.x - q1.x, q.y - q1.y) - 22) / 40);
  if (sp > 0) for (let j = 3; j >= 1; j--) { const tj = t - j / 90; if (tj < T_ALIVE) continue; const p = planeAt(tj); NB.plane(p.x, p.y, p.a, SIZE, { alpha: sp * .2 * (1 - j / 4) }); }
  const k = backOut(seg(t, T_ALIVE, T_ALIVE + .22), 2.2);
  NB.plane(q.x, q.y, q.a, SIZE, { k: lerp(.82, 1, k), alpha: clamp((t - T_ALIVE) / .1) });
  if (t >= T_CLIP) {   // the paperclip slides onto the nose and rides with it
    const s = springStep(t - T_CLIP, CLIP_SPRING), off = lerp(110, 0, s) - 50, [nx, ny] = nose(q);   // it ends flush with the nose
    CX.save(); CX.globalAlpha *= clamp((t - T_CLIP) / .06); NB.clip(nx + off * Math.cos(q.a), ny + off * Math.sin(q.a), 104, q.a); CX.restore();
  }
}

// ---------- the page ----------
const BOIL = 1.8;   // px of line boil (the strokes re-drawn 10 times a second, on threes) on the drawn marks, never on the writing
const W1 = { kind: 'write', id: 'wrong', str: 'throw it harder', x: 1120, y: 330, size: 74, t: T_W1, cps: 26 };
const W2 = { kind: 'write', id: 'answer', str: 'weight the nose', x: 1120, y: 450, size: 74, t: T_W2, cps: 26, col: BLUE };
const X_AT = nose({ x: REST[0], y: REST[1], a: 0 });
const MARKS = [
  { kind: 'path', d: 'M 100,880 L 1960,876', t: -1, dur: .1, pen: false, lw: 4.5, seed: 5, boil: BOIL },       // the floor
  { kind: 'cross', x: X_AT[0] + 22, y: X_AT[1] + 2, s: 50, t: -1, dur: .1, pen: false, col: RED, lw: 5, seed: 8, boil: BOIL },   // the target
  { kind: 'path', pts: NB.planeOutline(HOME.x, HOME.y, HOME.a, SIZE), t: T_SKETCH, dur: T_ALIVE - T_SKETCH - .05, lw: 4, seed: 2, boil: BOIL, out: T_ALIVE + .05, outTo: .28, outDur: .5 },
  { kind: 'path', pts: [[[NOSE1[0] - 40, NOSE1[1] - 22], [NOSE1[0] - 64, NOSE1[1] - 40]], [[NOSE1[0] + 4, NOSE1[1] - 36], [NOSE1[0] + 6, NOSE1[1] - 64]], [[NOSE1[0] + 38, NOSE1[1] - 20], [NOSE1[0] + 62, NOSE1[1] - 38]]],
    t: T1E + .02, dur: .12, pen: false, lw: 4, seed: 6, boil: BOIL },                                // the crash
  { kind: 'draw', t: 0, fn: drawPlane },
  { kind: 'sticky', t: T_STICKY, x: 370, y: 225, w: 360, h: 300, rot: -4, lines: ['why did it', 'stall?'], size: 62, id: 'question' },
  { kind: 'arrow', from: [575, 212], to: [745, 268], bend: -.3, t: T_ARROW, dur: .2, col: RED, seed: 4, boil: BOIL },
  W1,
  { kind: 'strike', of: W1, t: T_STRIKE, dur: .2, col: RED, rtl: true, boil: BOIL },
  W2,
  { kind: 'highlight', of: W2, t: T_HL, dur: .32 },
  { kind: 'ring', box: [REST[0] - SIZE * .52, REST[1] - 40, SIZE * 1.02 + 54, 80], t: T_RING, dur: .4, col: RED, seed: 3, boil: BOIL },
];
// the camera opens close on the pen, pulls back for the throw so the X is in view, keeps every note in frame once it is
// written, and ends wide on the whole page
const CAM = [
  [0, [600, 640, 1.42]],
  [1.0, [940, 540, 1.06], 'smooth'],   // the pull-back rides the throw, so the X is in view as it leaves the hand
  [2.5, [900, 450, 1.1]],
  [5.0, [920, 480, 1.08]],
  [6.1, [1000, 500, 1.08]],
  [8.0, [995, 478, 1]],                // wide: the whole page
  [8.9, [990, 486, 1.02], { stiffness: 6, damping: 5, mass: 1 }],   // and a slow lean in over the last second
];

// ---------- sound cues, from the same times the picture uses ----------
cue(T1, 'whoosh', { weight: .7, pan: pan(HOME.x), id: 'launch' });
cue(T1E, 'thump', { weight: .9, pan: pan(NOSE1[0]), id: 'crash' });
cue(springAt(T_STICKY, .9, { stiffness: 380, damping: 19, mass: 1 }), 'snap', { weight: .6, pan: pan(370), id: 'sticky' });
cue(T_STRIKE, 'swish', { weight: .45, pan: pan(1360), id: 'strike' });
cue(TR + 1 / 60, 'suck', { weight: .6, dur: TRE - TR, pan: pan(600), id: 'rewind' });
cue(CLIP_IN, 'click', { weight: .7, pan: pan(HOME.x), id: 'clip' });
cue(T2, 'whoosh', { weight: .8, pan: pan(HOME.x), id: 'launch' });
cue(TOUCH, 'land', { weight: .8, pan: pan(REST[0]), id: 'land' });
cue(T_HL + .32, 'chime', { weight: .6, id: 'answer' });
cue(T_RING, 'swish', { weight: .45, pan: pan(REST[0]), id: 'ring' });

shots([[0, t => NB.page(t, MARKS, { cam: CAM })]]);

// a model sheet of the kit, every helper in immediate mode: render.mjs --project=specimens/notebook --loop=kit --stills=0.9
const KIT_ROUTE = NB.route([[1180, 860], [1330, 800], [1480, 790], [1640, 830]]);
const kitPose = tt => { const q = KIT_ROUTE.pose(EASE.inOut(seg(tt, 0, .8))); return q; };
LOOPS.kit = t => {
  NB.paper();
  ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789 .,!?:;-+=/()% → ✓ ×'].forEach((str, i) => NB.write(null, str, 90, 110 + i * 100, 1, { size: 60 }));
  NB.write(null, 'ring', 120, 470, 1, { size: 60, col: BLUE }); NB.ring([112, 420, 132, 64], 1, { col: RED });
  NB.write(null, 'under', 360, 470, 1, { size: 60 }); NB.underline(352, 530, 488, 1, { double: true, col: BLUE });
  NB.write(null, 'scribble', 620, 470, 1, { size: 60 }); NB.strike([612, 425, 220, 60], 1, { scribble: true, col: RED });
  NB.write(null, 'marked', 920, 470, 1, { size: 60 }); NB.highlight([912, 425, 200, 60], 1);
  NB.tick(1180, 455, 54, 1, { col: BLUE }); NB.cross(1270, 455, 44, 1, { col: RED }); NB.highlighter(1560, 330, { lift: .3 });
  NB.arrow([1340, 480], [1560, 420], 1, { col: INK, bend: .3 });
  NB.typeOn(null, 'a typeset caption, wiped on', 1240, 600, .8, { size: 40 });
  NB.drawOn('M 100,640 C 220,560 300,720 420,640 C 540,560 600,600 700,650', 1, { lw: 6 });
  NB.drawOn('M 100,640 C 220,560 300,720 420,640', .6, { col: RED, lw: 3, seed: 9 });
  NB.sticky(860, 680, 260, 230, 1, { rot: 3, lines: ['sticky', 'note'], size: 54, id: null });
  NB.tape(860, 572, 170, 1, { rot: -6 });
  NB.clip(1080, 660, 120, -.3);
  NB.trail(t, kitPose, { from: 0, to: .8, every: .04, n: 6, s: 120, col: BLUE });
  const q = kitPose(t); NB.plane(q.x, q.y, q.a, 120);
  NB.pen(1700, 700, { col: RED });
};
LOOPS.kit.len = 1;
