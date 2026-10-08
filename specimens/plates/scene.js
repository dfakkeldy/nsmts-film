// plates specimen: "How big is the Earth?" in four numbered figures, one uncut take on cream paper (11.5 s, 30 fps).
// A stick at Alexandria casts a noon shadow; its angle, read through a loupe, is 7.2 degrees; a stick at Syene casts
// none at the same noon, so the ground between them must bend; the bend closes into the Earth, where the same angle,
// slid down to the centre, spans the 800 km between the sticks; fifty of them go round, so the Earth is 40,000 km.
//   FIG. 1 Alexandria, noon     0-2.2     the stick and its morning shadow, cast as the light arrives; the sun climbs
//                                         to noon and the shadow shortens
//   FIG. 2 7.2° from vertical   2.2-4.85  push in on the stick's top: the angle is too fine to read, so a loupe reads it
//   FIG. 3 Syene, noon          4.85-7.1  pull back: 800 km away a stick casts no shadow, so the ground must bend
//   FIG. 4 7.2° at the centre   7.1-11.5  pull back: the bend closes into the Earth; the angle slides to the centre,
//                                         alone, and spans the 800 km; fifty go round: 40,000 km, held 2 s
// World units are pixels at the last figure: the Earth's radius is 300 and a stick 9 tall (out of scale, as diagrams
// are). Strokes, hatching and type stay in screen pixels at every zoom (PLT's rule). The numbers here are 1080p.

const DEG = Math.PI / 180, R = 300, HS = 9, WS = .3, ANG = 7.2 * DEG, SS = R * ANG;   // Syene: 37.7 units of arc away
const UP = -Math.PI / 2, mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)], { add, dir } = PLT, ST = PLT.S;
// captions state the fact each figure adds; figure 1's name is already set on frame 0 (the poster frame)
const FIGS = [[0, 'Alexandria, noon', -.6], [2.2, '7.2° from vertical'], [4.85, 'Syene, noon'], [7.1, '7.2° at the centre']];

// ---------- the timeline (seconds) ----------
const TL = {
  key: [-.4, .55], beam: [0, .7], sun: [.6, 1.9],
  ext: [2.15, 2.5], scale: [2.3, 2.85], wedge: [2.4, 2.9], lensIn: [2.75, 3.25], lensOut: [3.95, 4.45], scaleOut: [4.3, 4.65], angle: [4.2, 4.55],
  sy: [5.0, 5.4], alex: [5.0, 5.4], syene: [5.15, 5.55], bend: [5.45, 6.3], dist: [6.2, 6.55], labelsOut: [6.7, 6.95],
  close: [6.85, 7.85], lead: [7.75, 8.1], radii: [7.9, 8.2], slide: [8.2, 8.7],           // the slide plays alone
  carry: [8.9, 9.4], trace: [8.9, 9.4], engrave: [8.85, 9.65], times: [9.3, 9.55], answer: [9.2, 9.55],
};
// the camera: [t, world point at the frame centre, zoom, move seconds, easing]
const CAM = [
  [0, [-2.38, -306.2], 42],                 // FIG. 1: the stick, its foot at (1060, 800)
  [1.95, [1.47, -311.95], 95, 1, ease],     // FIG. 2: in on the stick's top, at (820, 820)
  [4.6, [18.8, -302.4], 28, 1, ease],       // FIG. 3: both sticks
  [6.7, [200, 20], 1, 1.5, ease],           // FIG. 4: the Earth, its centre at (760, 520): 28x in 1.5 s, smoothstep
  [9.4, [192, 16], 1.035, 2.1, ease],       // settle: a slow push while the answer holds
];
const SUN_E = bezier(.42, 0, .18, 1);
const theta = t => lerp(62 * DEG, ANG, SUN_E(seg(t, ...TL.sun)));             // the sun's angle from the vertical
const bendAt = t => EASE.inOut(seg(t, ...TL.bend));
const camEnd = i => CAM[i][0] + CAM[i][3];                                  // when camera move i settles
const rWedge = t => kf(t, [[CAM[2][0], 520], [camEnd(2) - .2, 118], [CAM[3][0], 118], [camEnd(3) - .4, 60]], EASE.inOut);
const LIGHT = [.45, -.62, .66];                                              // toward the light, for the engraving
const AXIS = [.45, -.62, .66], POLAR = 80;                                  // the pole toward the light: its cap is the highlight
const GAP = 115;                                                             // px between the rays of a beam

// ---------- geometry (world) ----------
// the ground through Alexandria, bent by b (0 flat, 1 the Earth): the point s units of arc along it and its normal
function ground(s, b) {
  if (b < 1e-4) return { p: [s, -R], n: [0, -1] };
  const Rb = R / b, f = s / Rb; return { p: [Rb * Math.sin(f), -R + Rb * (1 - Math.cos(f))], n: [Math.sin(f), -Math.cos(f)] };
}
const stick = (s, b) => { const g = ground(s, b); return { foot: g.p, n: g.n }; };
const topOf = (st, g) => add(st.foot, st.n, HS * g);
// how far a ray from P along d travels before it meets the bent ground: a floor while flat, then a circle of radius R / b
const hitGround = (P, d, b) => b < 1e-4 ? PLT.hitLine(P, d, [0, -R], [0, 1]) : PLT.hitCircle(P, d, [0, -R + R / b], R / b);

// ---------- the loupe's path (screen) ----------
function loupe(t, apex) {
  if (t < TL.lensIn[0] || t > TL.lensOut[1]) return null;
  const rest = add(apex, dir(UP + ANG), 534), from = [W + 260, 160], kIn = EASE.glide(seg(t, ...TL.lensIn)), kOut = EASE.inOut(seg(t, ...TL.lensOut));
  const bulge = Math.sin(Math.PI * kIn) * 60, held = seg(t, TL.lensIn[1] - .1, TL.lensIn[1] + .4) * (1 - kOut);
  const x = lerp(from[0], rest[0], kIn) + noise(t * .8, 2) * 3.2 * held + 300 * kOut, y = lerp(from[1], rest[1], kIn) - bulge + noise(t * .8, 5) * 3.2 * held - 70 * kOut;
  return { x, y, lift: lerp(.6, .08, kIn) + .92 * kOut, alpha: 1 - seg(kOut, .5, 1) };
}

// ---------- drawing ----------
function drawStick(v, st, g) {
  if (g <= 0) return;
  const f = v.p(st.foot), tp = v.p(topOf(st, g)), tg = [-st.n[1], st.n[0]], w = Math.max(2.4, WS * v.z), h = w / 2;
  PLT.contact(f[0] - w * .45, f[1] + 1, w * 1.9, w * .55, .45 * Math.min(1, g * 2));
  const q = [add(f, tg, -h), add(f, tg, h), add(tp, tg, h), add(tp, tg, -h)];
  PLT.shape(q, { fill: ST.paper });
  if (w > 7) for (const [k, lw] of [[-.3, 1.4], [-.1, .8], [.12, .4]])     // engraved shade, away from the light
    line([add(f, tg, w * k), add(tp, tg, w * k)], ST.ink, lw, { cap: 'butt' });
  PLT.shape(q, { stroke: ST.ink, lw: 1.6 });
}

function film(t) {
  PLT.paper();
  const v = PLT.camera(t, CAM), z = v.z, sp = q => v.p(q), b = bendAt(t), th = theta(t), d = [-Math.sin(th), Math.cos(th)];
  const A = stick(0, b), Sy = stick(SS, b), gS = EASE.outExpo(seg(t, ...TL.sy));
  const At = topOf(A, 1), St = topOf(Sy, gS), apex = sp(At), O = sp([0, 0]), Rz = R * z, slideK = ease(seg(t, ...TL.slide));   // smoothstep: labels ride it
  const zk = clamp(Math.log(28 / z) / Math.log(28));        // 0 until the pull-back to the Earth, 1 once it is in frame

  // the globe's engraving (FIG. 4), laid down under the fifty arcs
  if (t > TL.engrave[0]) PLT.sphere(O, Rz, { p: seg(t, ...TL.engrave), light: LIGHT, axis: AXIS, polar: POLAR, outline: false, lines: 36 });

  // light: a narrow beam over each stick, each ray stopped by the ground or a stick, and the two key rays that graze
  // the sticks' tops (FIG. 3 has a beam per stick; Syene's fades as the pull-back brings the two together)
  const onGround = (P, dd) => hitGround(P, dd, b);
  const stop = PLT.stops(v, onGround, (P, dd) => PLT.hitSeg(P, dd, A.foot, At), gS > 0 ? (P, dd) => PLT.hitSeg(P, dd, Sy.foot, St) : null);
  const sKey = gS > 0 ? sp(St) : null, near = (Q, K) => K && Math.abs((Q[0] - K[0]) * d[1] - (Q[1] - K[1]) * d[0]) < 26;
  const bw = lerp(300, 360, seg(t, CAM[3][0], camEnd(3))), sA = .6 * (1 - seg(t, CAM[3][0], CAM[3][0] + .6));
  PLT.rays(t, d, apex, { p: seg(t, ...TL.beam), stop, gap: GAP, alpha: .6, band: [-bw, bw], skip: Q => near(Q, sKey) });
  if (gS > 0 && sA > 0) PLT.rays(t, d, sKey, { p: seg(t, TL.sy[0], TL.sy[0] + .6), stop, gap: GAP, alpha: sA, band: [-240, 240], skip: Q => near(Q, apex) });
  // a key ray, drawn on from the sun; returns how far its front has got from the stick's top to the ground (0..1)
  const keyRay = (top, alpha, p) => { if (alpha <= 0) return 0; const q = sp(top);
    const r = PLT.rays(t, d, q, { key: true, band: [0, 0], p, stagger: 0, lw: 1.5, col: ST.ink, alpha, pulseAlpha: .8, stop: PLT.stops(v, onGround) })[0];
    if (!r) return 0; const at = Math.hypot(q[0] - r[0][0], q[1] - r[0][1]), got = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]);
    return clamp((got - at) / Math.max(1, r[2] - at)); };
  const fA = keyRay(At, 1, seg(t, ...TL.key)), fS = keyRay(St, gS, 1);

  // the shade behind each stick, cast only as the front of its key ray passes the top: the hatching fills out from the
  // stick to the ray, and the shadow on the ground runs from the foot to the tip
  const shade = (st, top, g, f) => { if (g <= 0 || f <= 0) return; const L = hitGround(top, d, b); if (!isFinite(L)) return;
    const fp = sp(st.foot), tp = sp(top), tq = sp(add(top, d, L)); if (Math.hypot(tq[0] - fp[0], tq[1] - fp[1]) < 1.5) return;
    const gq = mix(fp, tq, f), rq = mix(tp, tq, f);
    PLT.hatch([tp, fp, gq, rq], -Math.PI / 4, 7, { anchor: fp, col: ST.graphite, alpha: clamp((z - 3) / 6) });
    line([fp, gq], ST.ink, 4.5, { cap: 'butt' }); };
  shade(A, At, 1, fA); shade(Sy, St, gS, fS);

  // the ground: bending as the figures need, closing into the Earth
  const ck = EASE.inOut(seg(t, ...TL.close)), sL = -lerp(46, Math.PI * R, ck), sR = lerp(64, Math.PI * R, ck);
  const pts = []; for (let i = 0; i <= 240; i++) pts.push(sp(ground(lerp(sL, sR, i / 240), b).p));
  PLT.ink(pts, { lw: 2 });
  const ha = clamp((z - 5) / 10);              // the ground symbol, a close-up convention, gone once the figure shrinks
  if (ha > .01) { const ds = 20 / z; CX.save(); CX.beginPath();
    for (let i = Math.ceil(sL / ds); i * ds <= sR; i++) { const g = ground(i * ds, b), p = sp(g.p); if (p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H + 20) continue;
      const tg = [-g.n[1], g.n[0]], sl = [(-g.n[0] - tg[0]) * .7071, (-g.n[1] - tg[1]) * .7071]; CX.moveTo(p[0], p[1]); CX.lineTo(p[0] + sl[0] * 13, p[1] + sl[1] * 13); }
    CX.strokeStyle = ST.graphite; CX.lineWidth = 1.1; CX.globalAlpha = ha; CX.stroke(); CX.restore(); }

  drawStick(v, A, 1); drawStick(v, Sy, gS);

  // FIG. 2: the stick's line carried up, the printed scale, the angle (too fine to read without the glass)
  const rw = rWedge(t), ext = EASE.outExpo(seg(t, ...TL.ext)), scaleA = 1 - seg(t, ...TL.scaleOut);
  if (ext > 0) PLT.construct([apex, add(apex, A.n, rw + 60)], ext, { alpha: 1 - slideK });
  if (t > TL.scale[0] && scaleA > 0) {
    PLT.scale(apex, rw, UP, 12, seg(t, ...TL.scale), { alpha: scaleA, size: 10 });
    const lp = add(apex, dir(UP + ANG), rw + 30); CX.save(); CX.globalAlpha = scaleA * seg(t, TL.lensIn[0], TL.lensIn[0] + .2);
    text(null, '7.2°', lp[0], lp[1], { family: ST.sans, weight: 600, size: 12, color: ST.red, align: 'center', base: 'middle' }); CX.restore();
  }
  // the angle: at the stick's top, then slid down to the centre, where its arc lies on the ground between the sticks
  const wp = seg(t, ...TL.wedge);
  if (wp > 0) {
    const arc = PLT.morph(PLT.arcPts(apex, rw, UP, UP + ANG, 24), PLT.arcPts(O, Rz, UP, UP + ANG, 24), slideK, 24), ap = mix(apex, O, slideK);
    if (slideK <= 0) PLT.angle(apex, UP, UP + ANG, rw, wp);
    else { PLT.shape([ap, ...arc], { fill: ST.red, alpha: .2 }); line(arc, ST.red, 2.6); line([arc[0], ap, arc[arc.length - 1]], ST.red, 1.3, { alpha: slideK }); }
  }
  // FIG. 4: the radii, and the angle's arc carried round the Earth fifty times
  const rk = EASE.inOut(seg(t, ...TL.radii));
  if (rk > 0) { PLT.construct([sp(A.foot), O], rk); PLT.construct([sp(Sy.foot), O], rk); }
  const tk = EASE.inOut(seg(t, ...TL.trace)), aEnd = lerp(UP + ANG, UP + TAU, tk);
  if (slideK >= 1) {
    if (tk > 0) { CX.save(); CX.beginPath(); CX.arc(O[0], O[1], Rz, UP + ANG, aEnd); CX.lineWidth = 2.6; CX.strokeStyle = ST.red; CX.stroke(); CX.restore(); }
    for (let i = 0; i < 50; i++) { const a = UP + i * ANG, k = i < 2 ? 1 : clamp((aEnd - a) / (ANG * 1.5)); if (k <= 0) continue;
      line([add(O, dir(a), Rz - 7 * k), add(O, dir(a), Rz + 10 * k)], ST.red, 1.6); }
  }

  // FIG. 3: the names, and the distance between them
  const lo = 1 - seg(t, ...TL.labelsOut);
  if (lo > 0 && t > TL.alex[0]) { CX.save(); CX.globalAlpha = lo;
    const am = sp(add(A.foot, A.n, HS * .58)), sm = sp(add(Sy.foot, Sy.n, HS * .58));
    PLT.leader('alexandria', 'Alexandria', am, add(am, [-96, -62]), seg(t, ...TL.alex), { side: -1, size: 36 });
    PLT.leader('syene', 'Syene', sm, add(sm, [104, -62]), seg(t, ...TL.syene), { side: 1, size: 36 });
    CX.restore(); }
  const dp = seg(t, ...TL.dist), dimA = 1 - seg(t, CAM[3][0], CAM[3][0] + .3);
  const dimPts = () => { const out = []; for (let i = 0; i <= 24; i++) { const g = ground(SS * i / 24, b); out.push(add(sp(g.p), g.n, -58)); } return out; };
  if (dp > 0 && dimA > 0) { CX.save(); CX.globalAlpha = dimA; PLT.dimPath(null, '', dimPts(), dp, { from: [sp(A.foot), sp(Sy.foot)], label: false }); CX.restore(); }

  // the answer (FIG. 4): a leader from the Earth's edge, the measure, and how it was made
  const to = add(O, [420, -92]), ansX = to[0] + 30 + 12, ansY = to[1] + 64 * .33;
  const ak = seg(t, ...TL.answer);
  if (ak > 0) PLT.leader('answer', '40,000 km', add(O, dir(-28 * DEG), Rz), to, ak, { side: 1, size: 64, weight: 500 });
  // "800 km": set under the dimension (FIG. 3); carried up beside the arc it measures as the camera pulls back, where a
  // fine leader draws to it; it waits there while the angle slides down onto that arc, then goes to the answer
  const k8 = EASE.punch(seg(t, TL.dist[0] + .25, TL.dist[1] + .2));
  if (k8 > 0) {
    const sub = { family: ST.sans, weight: 500, size: 34, color: ST.ink }, w8 = measure('800 km', sub), g = ground(SS / 2, b), m = sp(g.p);
    const below = add(add(m, g.n, -(58 + 48)), [-w8 / 2, 12]), at4 = add(m, g.n, 7), to4 = add(m, [86, -44]), beside = [to4[0] + 30 + 12, to4[1] + 34 * .33];
    const target = [ansX, ansY + 58], c8 = ease(seg(t, ...TL.carry)), up = EASE.inOut(seg(zk, .15, .95)), p8 = mix(mix(below, beside, up), target, c8);
    const lk = seg(t, ...TL.lead); if (lk > 0 && c8 < 1) { CX.save(); CX.globalAlpha = 1 - c8; PLT.leader(null, '', at4, to4, lk, { side: 1, dot: 0, label: false }); CX.restore(); }
    PLT.label(k8 > .9 ? 'dist' : null, '800 km', p8[0], p8[1], { ...sub, alpha: k8, blur: (1 - k8) * 8 });
    const xk = EASE.punch(seg(t, ...TL.times));
    if (xk > 0) PLT.label(xk > .9 ? 'times' : null, '× 50', p8[0] + w8 + 14, p8[1], { ...sub, color: ST.red, alpha: xk, blur: (1 - xk) * 8 });
  }
  // "7.2°": written once the loupe has read it, carried with the angle down to the centre
  const ag = EASE.punch(seg(t, ...TL.angle));
  if (ag > 0) {
    const q0 = add(add(apex, dir(UP + ANG), rw), [22, 12]), q1 = add(add(O, dir(UP + ANG / 2), 150), [18, 12]), q = mix(q0, q1, slideK);
    PLT.label(ag > .9 ? 'angle' : null, '7.2°', q[0], q[1], { family: ST.sans, weight: 500, size: 36, color: ST.red, alpha: ag, blur: (1 - ag) * 8 });
  }

  // the loupe, over everything drawn so far; the reading through it is registered for the checks
  const L = loupe(t, apex);
  if (L) {
    const res = PLT.lens(L.x, L.y, 190, { mag: 2.7, lift: L.lift, alpha: L.alpha });
    if (res && L.alpha > .5 && scaleA > .5) { const lp = add(apex, dir(UP + ANG), rw + 30), c = res.at(lp);
      if (Math.hypot(lp[0] - L.x, lp[1] - L.y) < 150) readable('~lens', '7.2°', c[0] - 32, c[1] - 14, 64, 28, L.alpha, 12 * res.m); }
  }

  // the plate: margins, the running head (set from frame 0), the caption
  PLT.margins();
  PLT.label('head', 'How big is the Earth?', 120, 124, { size: 40 });
  PLT.caption(t, FIGS, { y: H - 84 });
  PLT.finish();
}

// ---------- sound cues, from the same times the picture uses ----------
cue(TL.key[1], 'land', { weight: .35, id: 'first-shadow' });                         // the key ray reaches the ground
cue(TL.sun[1], 'tock', { weight: .5, id: 'noon' });                                   // the shadow settles at noon
cue(TL.lensIn[0], 'swish', { weight: .35, dur: TL.lensIn[1] - TL.lensIn[0], id: 'loupe' });
cue(TL.lensIn[1], 'land', { weight: .45, id: 'loupe-down' });                         // glass set down on the paper
cue(CAM[2][0], 'whoosh', { weight: .35, dur: CAM[2][3], id: 'pull-back' });
cue(TL.bend[1], 'tock', { weight: .65, id: 'no-shadow' });                             // the second shadow is gone
cue(CAM[3][0], 'swell', { weight: .6, dur: CAM[3][3], id: 'to-the-earth' });
cue(TL.slide[1], 'pop', { weight: .8, id: 'angle-at-centre' });
cue(TL.trace[0], 'riser', { weight: .5, dur: TL.trace[1] - TL.trace[0], id: 'fifty' });
cue(TL.answer[1] - .1, 'chime', { weight: .9, id: 'answer' });

shots([[0, t => film(t)]]);
