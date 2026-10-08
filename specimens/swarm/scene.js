// swarm specimen: one flock of 7,500 strokes carries an 11 s data story with no cuts. A murmuration rolls across a dusk
// sky; the flock spreads into an estuary map whose five roosts are joined by flight lines converging on one; it stacks
// into a histogram of arrivals after sunset (built left to right, the way the evening runs); it settles into the
// wordmark. One bird in the accent colour is in every picture: a straggler that reaches the chosen roost after the
// flock, marks the chart's peak, and is the last one home, perching on the wordmark's l.
// 108 BPM, five bars. Every morph takes two beats; the map, which carries five names, holds for a full bar.
const N = 7500, b = tb, ACC = SW.S.accent, INK = SW.S.ink;

// ---------- 1. the murmuration ----------
const flock = () => SW.formation([SW.ribbon(N, { cx: 950, cy: 435, len: 980, amp: 100, width: 235, lobe: .55, lobePhase: -.6, fold: 34, stray: .015, speed: .2, pins: [[.16, .05, 1]], seed: 21 })]);

// ---------- 2. the estuary: coast, a creek, engraved water, five roosts, flight lines ----------
const coastY = x => 735 - .06 * (x - 960) + 44 * Math.sin(x / 240 + .5) + 18 * Math.sin(x / 90 + 1.7) + 7 * noise(x / 26, 5)
  - 55 * Math.exp(-(((x - 1060) / 170) ** 2));    // a shallow bay below Old Pier
const COAST = Array.from({ length: 161 }, (_, i) => { const x = -60 + i * 2040 / 160; return [x, coastY(x)]; });
const HATCH = [16, 31, 48, 68].map(d => COAST.map(([x, y]) => [x, y + d]));
// the creek: two banks that flare into a mouth on the coast east of North Fen and meet at its source, every point at
// least 120 px inside the frame after the camera's 3% push-in (world x <= 1770)
const RX = 1734, MOUTH = 19, CREEK = s => [RX + 17 * Math.sin(s * 6.5) + 6 * s, coastY(RX) - 270 * s];
const bank = (side, s0, s1) => Array.from({ length: 21 }, (_, i) => { const s = lerp(s0, s1, i / 20), [x, y] = CREEK(s), hw = MOUTH * (1 - Math.pow(s, .7)) + 1.2;
  return s ? [x + side * hw, y] : [RX + side * MOUTH, coastY(RX + side * MOUTH)]; });
const BANKS = [bank(-1, 0, .62), bank(1, 0, .62), bank(-1, .62, 1), bank(1, .62, 1)];   // the upper reach is fainter, towards its source
const COAST_W = COAST.filter(([x]) => x < RX - MOUTH).concat([[RX - MOUTH, coastY(RX - MOUTH)]]);
const COAST_E = [[RX + MOUTH, coastY(RX + MOUTH)]].concat(COAST.filter(([x]) => x > RX + MOUTH));
const ROOSTS = [
  { name: 'Old Pier', x: 960, dy: -128, r: 64, share: .34 },    // the one they choose tonight (accent)
  { name: 'Reedbank', x: 330, dy: -170, r: 42, share: .16 },
  { name: 'Saltings', x: 640, dy: -330, r: 42, share: .16 },
  { name: 'Alder Carr', x: 1330, dy: -330, r: 42, share: .17 },
  { name: 'North Fen', x: 1630, dy: -175, r: 42, share: .17 },
].map(r => ({ ...r, y: coastY(r.x) + r.dy }));
const R = ROOSTS, PIER = R[0];
// flight lines: every roost sends birds to Old Pier; two side links make it a network rather than a star
const trim = (a, b, ra, rb) => { const d = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d; return [[a.x + ux * ra, a.y + uy * ra * .7], [b.x - ux * rb, b.y - uy * rb * .7]]; };
const LINKS = [[1, 0, .14], [2, 0, -.12], [3, 0, .12], [4, 0, -.16], [1, 2, -.18], [4, 3, .2]];
const map = () => {
  const [nW, nE, nB0, nB1, nB2, nB3, h0, h1, h2, h3, nRoost, nFlow] = SW.shares(N - 1, [.117, .013, .015, .015, .0075, .0075, .068, .053, .037, .024, .42, .223]);
  const roostN = SW.shares(nRoost, R.map(r => r.share)), flowN = SW.shares(nFlow, LINKS.map(l => l[1] === 0 ? 1.2 : .7));
  return SW.formation([
    SW.still(SW.one(PIER.x, PIER.y), { len: 0, jiggle: 0 }),
    SW.still(SW.linePoints(COAST_W, nW, { spread: 1.3, seed: 11 }), { angle: 'tangent', len: 9, jiggle: .3 }),
    SW.still(SW.linePoints(COAST_E, nE, { spread: 1.3, seed: 14 }), { angle: 'tangent', len: 9, jiggle: .3 }),
    ...BANKS.map((pl, i) => SW.still(SW.linePoints(pl, [nB0, nB1, nB2, nB3][i], { spread: 1, seed: 12 + i }), { angle: 'tangent', len: 7, jiggle: .3, a: i < 2 ? .7 : .42 })),
    ...[h0, h1, h2, h3].map((n, i) => SW.still(SW.linePoints(HATCH[i], n, { spread: .8, jitter: .3, seed: 40 + i }), { angle: 'tangent', len: 13 - i * 2, jiggle: .4, a: 1 - i * .16 })),
    SW.orbit(R.map((r, i) => ({ x: r.x, y: r.y, r: r.r, n: roostN[i] })), { speed: .6, squash: .62, seed: 5 }),
    SW.stream(LINKS.map(([a, c, bow], i) => { const [p0, p1] = trim(R[a], R[c], R[a].r * .9, R[c].r * .9); return { pts: SW.arc(p0, p1, bow, 28), n: flowN[i] }; }), { speed: 150, spread: 4, len: 9, seed: 9 }),
  ]);
};

// ---------- 3. arrivals per minute after sunset, a bar per minute ----------
const BAR0 = 312, BARW = 44, BARSTEP = 66, BASE = 792, PEAK = 9;
const BARS = Array.from({ length: 20 }, (_, m) => { const v = .075 + .925 * Math.exp(-(((m - PEAK) / (m < PEAK ? 3.2 : 1.7)) ** 2)) * (m === PEAK ? 1 : .97 + .06 * hash(m * 3.3));
  const h = 470 * v; return [BAR0 + m * BARSTEP, BASE - h, BARW, h]; });
const BAR1 = BARS[19][0] + BARW, TOPX = BARS[PEAK][0] + BARW / 2, TOPY = BARS[PEAK][1] - 14;
const chart = () => { const [nBars, nAxis] = SW.shares(N - 1, [.955, .045]);
  return SW.formation([
    SW.still(SW.one(TOPX, TOPY), { len: 0, jiggle: 0 }),
    SW.still(SW.rectPoints(BARS, nBars, { seed: 17 }), { angle: Math.PI / 2, turn: .3, len: 7, jiggle: .5 }),
    SW.still(SW.linePoints([[BAR0 - 24, BASE + 14], [BAR1 + 24, BASE + 14]], nAxis, { spread: .6, seed: 18 }), { angle: 'tangent', len: 8, jiggle: .2 }),
  ]); };
// a dense source (Old Pier holds about 1,070 birds in a 64 px disc, with four streams arriving) must not leave all at
// once, or its crossing paths knot into a scribble. It unspools from the outside in (outer ring first, core last)
// while the chart still builds left to right. Both terms are 0..1 before they are mixed.
const PIER_SPAN = PIER.r * 2.4;
const unspool = (X, Y, sx, sy) => .6 * clamp((X - BAR0) / (BAR1 - BAR0)) + .4 * (1 - clamp(Math.hypot(sx - PIER.x, (sy - PIER.y) / .62) / PIER_SPAN));

// ---------- 4. the wordmark ----------
const MARK = { x: 960, y: 600, size: 300, family: 'Fraunces', weight: 800 }, HOP = b(18.5);
// the perch is a custom part: { n, at(j, t, tRef, out) } like any other; the bird settles with one small hop
const perch = (x, y) => ({ n: 1, at(j, t, tRef, out) { out.x = x; out.y = y - 11 * Math.sin(Math.PI * seg(t, HOP, HOP + .3)); out.ang = NaN; out.len = 0; out.a = 1; } });
const mark = () => { const l = SW.charBox('gloaming', 1, MARK), tp = SW.textPoints('gloaming', N - 1, { ...MARK, seed: 31 });
  return SW.formation([perch(l[0] + l[2] / 2, l[1] - SW.S.tagR - 1), SW.still(tp, { angle: -1.05, turn: .45, len: 6, jiggle: .25 })], { box: tp.box }); };

// ---------- the system: every morph two beats ----------
const KEYS = [
  { t: 0, f: flock },
  { t: b(4), land: b(6), f: map, stagger: 'radial', from: [950, 450], bend: .3, drift: 40, tag: { start: b(4.4), land: b(7), bend: .4 } },   // the straggler reaches Old Pier a beat after the flock
  { t: b(10), land: b(12), f: chart, stagger: unspool, bend: .16, drift: 28, tag: { start: b(10.1), land: b(11.4), bend: .35 } },        // and marks the peak before the flock arrives
  { t: b(14), land: b(16), f: mark, stagger: 'radial', from: [960, 520], bend: .26, drift: 36, tag: { start: b(14.4), land: b(17), bend: .5 } },
];
const SYS = SW.system(N, KEYS, { tags: 1 });

// ---------- type: captions bottom left, labels on the picture ----------
const CAPS = [['cap:0', 'Forty thousand starlings.', .2, b(4.7)], ['cap:1', 'One roost tonight.', b(4.7) + .2, b(10.6)], ['cap:2', 'All at once.', b(10.6) + .2, b(15.9)]];
const inOut = (t, a0, a1, b0, b1) => ease(seg(t, a0, a1)) * (1 - ease(seg(t, b0, b1)));

// ---------- sound, from the same key times (video-sound's anchors: a whoosh peaks on t, a swell and a riser end on it)
// wings bloom in and stop as the first caption has landed (its last word's .32 s rise, .05 s apart)
cue(CAPS[0][2] + 2 * .05 + .32, 'swell', { weight: .4, dur: .55, id: 'wings' });
// the re-formations are the film's only moves: a soft whoosh at the mass's velocity peak (mid-window) for the first
// two; the riser below carries the third
KEYS.slice(1, 3).forEach((k, i) => cue((k.t + k.land) / 2, 'whoosh', { weight: .5, pan: [-.3, .25][i], id: `flight-${i + 1}` }));
cue(KEYS[1].land, 'land', { weight: .6, id: 'map' });
cue(KEYS[1].tag.land, 'tick', { weight: .4, id: 'straggler' });
cue(KEYS[2].land, 'land', { weight: .7, id: 'chart' });
// tension into the wordmark: the riser runs through the flight and stops .2 s before the hit (near-silence, then the turn)
cue(KEYS[3].land - .2, 'riser', { weight: .5, dur: KEYS[3].land - .2 - KEYS[3].t, id: 'to-mark' });
cue(KEYS[3].land, 'hit', { weight: .75, id: 'mark' });
cue(KEYS[3].tag.land, 'pop', { weight: .8, id: 'perch' });
cue(HOP + .3, 'tick', { weight: .35, id: 'hop' });

shots([[0, t => {
  SW.sky(ease(seg(t, 0, DUR)));
  CX.save(); cam(W / 2, H / 2, 1 + .03 * EASE.inOut(t / DUR));
  // the wordmark settles into ink under its particles once they have landed
  const ink = .7 * EASE.outExpo(seg(t, b(16), b(17.5)));
  if (ink > .002) text(null, 'gloaming', MARK.x, MARK.y, { ...MARK, align: 'center', color: INK, alpha: ink });
  SW.draw(t, SYS);
  // map labels: up as the roosts gather, gone as the flock leaves
  const am = inOut(t, b(4.9), b(5.5), b(10.2), b(10.6));
  // labels sit where no flight line arrives: above the inland roosts, below the others
  R.forEach((r, i) => { const below = i === 0 || i === 1 || i === 4;
    SW.label(`roost:${r.name}`, r.name, r.x, below ? r.y + r.r * .62 + 44 : r.y - r.r * .62 - 22, i ? am * .82 : am, i ? { align: 'center' } : { align: 'center', color: ACC, weight: 600 }); });
  // chart labels
  const ac = inOut(t, b(11), b(11.5), b(14.3), b(14.7));
  SW.label('axis:start', 'sunset', BAR0, BASE + 62, ac * .82);
  SW.label('axis:end', '+20 min', BAR1, BASE + 62, ac * .82, { align: 'right' });
  const [tx, ty] = SW.at(SYS, 0, t), ap = inOut(t, b(11.1), b(11.5), b(14.3), b(14.7));
  if (ap > .01) SW.label('peak', '+9 min', tx + 22, ty + 10, ap, { color: ACC, weight: 600 });
  // the particle wordmark registers with the checks once nearly every particle has landed
  if (SW.landed(SYS, 3, t) > .93) SW.read('wordmark', 'gloaming', SW.formationOf(SYS, 3).box, 1, MARK.size);
  CX.restore();
  for (const [id, s, t0, t1] of CAPS) SW.caption(id, s, t, t0, t1);
  words('tagline', 'The evening, counted.', W / 2, 800, b(16), t, { family: SW.S.font, weight: 500, size: 44, color: INK, align: 'center', stagger: .06, rise: 14, blur: 10 });
  grain(.035);
}]]);
