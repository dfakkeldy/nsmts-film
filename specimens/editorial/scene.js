// editorial specimen: "Dawn Chorus", a launch film for a fictional morning paper. 4 bars at 96 BPM (10 s),
// 1920 x 1080, 60 fps, one continuous shot. One wren carries the eye across four pages that rebuild on the bar lines,
// and every page change starts when the wren jumps or is crossed:
//   A  paper   "Good morning."             a rule over the headline; the wren hops in along it, down onto the d
//   B  light   "5 stories, before seven."  the wren leaps, the light page sweeps up, it lands in the saddle of the 5
//   C  deep    "Then we stop."             the wren leaps, the light page drains into one rule; it lands on it. On
//                                          beat 10 the rule runs out to the full measure and the wren jumps round
//   D  paper   "Dawn Chorus"               the deep sheet is pulled in two stages: its edge parks under the wren for a
//                                          beat (wren and rule split into two inks), then it goes, and the rule lifts
//                                          into the masthead; four more wrens arrive
const b = tb, G = ED.grid(), K = ED.C;
const INK = K.ink, PAPER = K.paper, DEEP = K.a, LIGHT = K.b;   // forest: racing green (paper type on it) and marigold (ink type on it)
const TA = b(4) - .48,   // the wren leaves the d: the light page sweeps up with it
      TC = b(8) - .6,    // the wren leaves the 5: the light page drains into a rule
      TX = b(10),        // the rule runs out to the full measure; the wren jumps round
      TP0 = b(11), TPH = b(11.5), TPX = b(12),   // the paper edge comes in, parks under the wren, and the sheet goes
      TR = TPX + .1;     // the rule lifts into the masthead once the sheet is on its way
const SB = 104;          // the wren's height in px
const T_RULE = -.5, T_GOOD = -.25;   // page A is already building on frame 0: the full rule and the first glyphs

// ---------- layout, measured on first use (after the fonts load) ----------
const LAY = ED.once(() => {
  const L = {};
  L.aSize = ED.fit('Good morning.', {}, G.w(10)); L.ruleA = [G.left, 372, G.measure, 10]; L.aBase = 690;   // a kicker rule over the headline
  const la = ED.setLine('Good morning.', { size: L.aSize }), dp = ED.perch(la, 3, .64, SB, 1);   // on the d's ascender
  L.dTop = [G.left + dp[0], L.aBase + dp[1]];
  const f100 = ED.setLine('5', { size: 100 }).glyphs[0]; L.fSize = Math.round(620 * 100 / f100.asc);
  const f = ED.setLine('5', { size: L.fSize }), g5 = f.glyphs[0]; L.fBase = 960; L.fX = G.left - g5.x;
  const fp = ED.perch(f, 0, .58, SB, -1); L.fTop = [L.fX + fp[0], L.fBase + fp[1]];   // in the saddle of the 5's flag
  L.wx = G.x(5); L.sSize = ED.fit('stories,', {}, G.w(6.5));
  L.sBase = L.fBase - g5.asc + ED.setLine('stories,', { size: L.sSize }).asc;   // tops aligned with the 5
  L.bSize = 108; L.bBase = L.sBase + 160;
  L.dotR = 30; L.dotGap = 22;
  L.cSize = 220; L.tBase = 400; L.wBase = 650;
  const ws = ED.setLine('we stop.', { size: L.cSize });
  L.cx = Math.round(G.left + ws.w + 142);                                // where the wren stands on page C, clear of the full stop
  L.ruleC = [G.left, L.wBase + ws.desc + 28, L.cx + 66 - G.left, 20];    // the drained page: a rule running on past the type
  L.ruleCF = [G.left, L.ruleC[1], G.measure, 20];                       // beat 10: it runs out to the full measure
  L.scrollX = G.x(8); L.scrollBase = L.ruleC[1] + L.ruleC[3] + 86;
  L.ruleD = [G.left, 360, G.measure, 14];
  L.mSize = ED.fit('Dawn Chorus', {}, G.measure); const lm = ED.setLine('Dawn Chorus', { size: L.mSize });
  L.mBase = L.ruleD[1] + L.ruleD[3] + 40 + lm.capAsc; L.mTop = L.mBase - lm.asc - L.mSize * .06;   // the masthead's slot top
  L.thinY = L.mBase + lm.desc + 34; L.deckBase = L.thinY + 92;
  L.hold = (W - L.cx - 6) / W;   // how far the deep sheet is pulled when its edge parks under the wren
  return L;
});

// ---------- the light page: it sweeps up, drains into a rule, runs out, and lifts into the masthead ----------
const DRAIN = [{ stiffness: 220, damping: 30 }, { stiffness: 200, damping: 29 }, { stiffness: 170, damping: 27 }, { stiffness: 260, damping: 33 }];
const RUN = { stiffness: 260, damping: 32 };   // critically damped: a printer's rule doesn't wobble
const YR = t => { const L = LAY(); return ED.rectSpring(t, [[0, [0, 0, W, H]], [TC, L.ruleC, DRAIN], [TX, L.ruleCF, RUN], [TR, L.ruleD, 'smooth']]); };
// the masthead rises only once the lifting rule has cleared its slot, so the rule never strikes through it
const T_MAST = ED.once(() => { const L = LAY(); let t = TR; while (t < DUR && YR(t)[1] + YR(t)[3] > L.mTop - 4) t += 1 / 240; return t; });
const sweepA = t => ED.sweep([0, 0, W, H], EASE.inOut(seg(t, TA, TA + .5)), 'bottom');   // the light page coming up
// the deep sheet, pulled left in two stages: in to the wren, parked for half a beat, then off
const pullC = t => ED.pull([0, 0, W, H], kf(t, [[TP0, 0], [TPH, LAY().hold, EASE.inOut], [TPX, LAY().hold], [TPX + .42, 1, EASE.exit]]), 'left');

// ---------- the wrens ----------
const PATH = [
  { t: 0, at: [-170, 372] },                                               // off the frame
  { t: b(1), at: [330, 372], dur: .5, arc: 110 },                          // hops in along the rule
  { t: b(2), at: () => LAY().dTop, dur: .42, arc: 80, looks: [b(3)] },    // down onto the d
  { t: b(4), at: () => LAY().fTop, dur: b(4) - TA, arc: 170, flap: true, looks: [b(4.75), b(6), b(6.5)] },   // into the 5's flag
  { t: b(8), dur: b(8) - TC, flap: true, looks: [b(9.5)], at: t => [LAY().cx, (t < b(8) ? LAY().ruleC : YR(t))[1]] },   // onto the rule
  { t: TX + .3, dur: .3, arc: 64, face: 1, looks: [TPH + b(.25), b(15) + .16], at: t => [LAY().cx, YR(t)[1]] },   // jumps round as the rule runs out; rides it up
];
// four more arrive on the masthead rule, spaced evenly about the wren
const CHORUS = ED.once(() => { const x = LAY().cx, s = 370;
  return [[x - 2 * s, b(13), [-150, 120], 86, 0], [x + 2 * s, b(13.5), [2080, 150], 92, 3], [x - s, b(14), [520, -160], 96, 1], [x + s, b(14.5), [1500, -160], 82, 2]]
    .map(([cx, t, from, s, k]) => ({ x: cx, t, s, path: [{ t: 0, at: from }, { t, at: tt => [cx, YR(tt)[1]], dur: .66, flap: true, arc: 70, looks: [b(15) + k * .08 + (k > 1 ? .08 : 0)] }] })); });

// ---------- the pages ----------
function pageA(t, L) {
  ED.rule(L.ruleA[0], L.ruleA[1], L.ruleA[2], ED.wipe(t, T_RULE, .8), { lw: L.ruleA[3] });
  ED.headline('good', 'Good morning.', G.left, L.aBase, t, { size: L.aSize, t0: T_GOOD, stagger: .024 });
}
function pageB(t, L) {   // the type drops back into its slots with the take-off crouch, before the page drains
  const out = TC - .2, a = 1 - seg(t, TC - .06, TC + .06), od = .3;   // empty as the wren crouches, gone before the drain cuts it
  ED.headline('five', '5', L.fX, L.fBase, t, { size: L.fSize, t0: TA - .02, dur: .46, t1: out, outDur: od, alpha: a });
  ED.headline('stories', 'stories,', L.wx, L.sBase, t, { size: L.sSize, t0: TA + .2, t1: out + .04, outDur: od, alpha: a });
  ED.headline('before', 'before seven.', L.wx, L.bBase, t, { size: L.bSize, weight: 300, t0: TA + .24, stagger: .018, dur: .45, t1: out + .08, outDur: od, alpha: a });
  const gone = EASE.exit(seg(t, out, out + .2));   // five dots, one per story, filled on sixteenths: full well before the leap
  ED.dots(L.wx, L.fBase - 2 * L.dotR, 5, L.dotR, L.dotGap, i => springStep(t - b(4.75 + i * .25), 'snappy') * (1 - gone),
    { on: DEEP, off: INK, lw: 4, ring: i => EASE.outExpo(seg(t, b(4) + .05 + i * .05, b(4) + .35 + i * .05)) * (1 - gone) });
}
function pageC(t, L) {   // no exits: the sheet carries its type away
  ED.headline('then', 'Then', G.left, L.tBase, t, { size: L.cSize, t0: TC + .22, color: PAPER });
  ED.headline('stop', 'we stop.', G.left, L.wBase, t, { size: L.cSize, t0: TC + .36, color: PAPER });
  ED.headline('scroll', 'Nothing to scroll.', L.scrollX, L.scrollBase, t, { size: 64, weight: 300, t0: b(8), stagger: .016, color: PAPER });
}
function pageD(t, L) {
  const m = T_MAST();
  ED.headline('mast', 'Dawn Chorus', G.left, L.mBase, t, { size: L.mSize, t0: m, stagger: .026 });
  ED.rule(G.left, L.thinY, G.measure, ED.wipe(t, m + .25, .8), { lw: 4, from: 'center' });
  ED.headline('deck', 'A morning paper', W / 2, L.deckBase, t, { size: 60, weight: 300, align: 'center', t0: m + .4 });
  const ear = { weight: 600, size: 44, stagger: .02 };   // newspaper ears, in the serif roman: no tiny tracked caps
  ED.headline('ear-l', 'No. 1', G.left, L.deckBase, t, { ...ear, t0: m + .55 });
  ED.headline('ear-r', 'Five stories', G.right, L.deckBase, t, { ...ear, align: 'right', t0: m + .62 });
}

// the page stack at t, back to front, with the motif's inks on each page (and the rule's, once it outlives its page)
function stack(t, L) {
  if (t < TC) {
    const A = { fill: PAPER, draw: () => pageA(t, L), col: INK, eye: PAPER };
    const B = { fill: LIGHT, draw: () => pageB(t, L), col: INK, eye: LIGHT };
    return t < TA ? [A] : t < TA + .5 ? [A, { ...B, r: sweepA(t) }] : [B];
  }
  if (t < TP0) return [{ fill: DEEP, draw: () => pageC(t, L), col: PAPER, eye: DEEP },
    { r: YR(t), fill: LIGHT, draw: t < TC + .75 ? () => pageB(t, L) : null, col: INK, eye: LIGHT }];
  const sh = pullC(t);
  return [{ fill: PAPER, draw: () => pageD(t, L), col: INK, eye: PAPER, rule: INK },
    { r: sh.r, dx: sh.dx, fill: DEEP, draw: () => pageC(t, L), col: PAPER, eye: DEEP, rule: LIGHT }];
}

shots([[0, t => {
  const L = LAY(), regs = ED.pages(stack(t, L));
  // once its page has gone, the rule stays with the wren, in the ink that reads on what is under it
  if (t >= TP0) { const R = YR(t); ED.knockout(regs, (c, e, g) => { CX.fillStyle = g.rule; CX.fillRect(R[0], R[1], R[2], R[3]); }); }
  const h = ED.hop(t, PATH);
  ED.knockout(regs, (col, eye) => ED.wren(h.x, h.y, SB, h.pose, { color: col, eye }));
  if (t >= TPX) for (const c of CHORUS()) { const k = ED.hop(t, c.path); if (k.y > -200 && k.x > -200 && k.x < W + 200) ED.knockout(regs, (col, eye) => ED.wren(k.x, k.y, c.s, k.pose, { color: col, eye })); }
  ED.finish();
}]]);

// ---------- sound cues, from the same times the picture uses ----------
cue(TA, 'whoosh', { weight: .6, dur: .5, id: 'page' });
cue(b(4), 'thump', { weight: .9, pan: -.5, id: 'five' });
cue(TC, 'suck', { weight: .7, dur: .6, id: 'drain' });
cue(b(8), 'land', { weight: .7, pan: .1, id: 'wren' });
cue(TX, 'swish', { weight: .45, dur: .3, pan: .4, id: 'rule-out' });
cue(TP0, 'swish', { weight: .5, dur: TPH - TP0, pan: .6, id: 'pull-in' });
cue(TPX, 'whoosh', { weight: .55, dur: .42, pan: -.4, id: 'pull-off' });
// the chorus lands at the CHORUS times; pans follow their slots (the wren sits near the centre of the frame)
[[b(13), -.75], [b(13.5), .75], [b(14), -.38], [b(14.5), .38]].forEach(([t, pan], k) => cue(t, 'pop', { weight: .55, pitch: [0, 2, 4, 7][k], pan, id: 'chorus' }));
cue(b(15), 'chime', { weight: .6, id: 'masthead' });

// the layout grid over any frame of the film: node render.mjs --project=specimens/editorial --loop=grid --stills=3.9
LOOPS.grid = t => { SHOTS[0][1](t, t, DUR); ED.showGrid(G, .14); }; LOOPS.grid.len = DUR;
