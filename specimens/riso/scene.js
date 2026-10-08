// riso specimen: "How a moka pot makes coffee". 10 s, 30 fps, 5 bars at 120 BPM, three inks on cream stock.
// Page 1: the title stamps on beside the pot printed whole (a yellow silhouette over a halftone shadow). On beat 6 a
// print pass lays page 2 over it plate by plate: a pink headline with a yellow shadow, three labels printed as open
// outlines in the key ink, and the pot cut in half inside a printed panel. The process then runs bottom to top and
// each label takes its own overprint as its step happens: heat is pink + yellow, water is blue, coffee is all three
// inks. When the flame dies the heat label drops back to a tint, and a stamp lands on the panel.
const R = RISO, b = tb;

// ---------- the times the picture and the sound both hang on ----------
const L1 = b(1), L2 = b(2), SHADE = b(3);      // the title block lands, then the slab, then the pot's pink shading prints
const SWEEP = b(6), SWEEP_DUR = b(8) - b(6), B0 = SWEEP + SWEEP_DUR;   // the print pass to page 2, beat 6 to beat 8
const DRAW = B0 - .2;                          // the pot's insides draw themselves and the water prints in
const FIRE = b(9), PUSH = b(11), BREAK = b(13) + .1, STAMP = b(16);

// ---------- the pot, in its own units: origin at the screw joint, y down ----------
const PX = 1390, PY = 610, PS = .94;           // where it stands on both pages, and its scale
const toFrame = ([x, y]) => [PX + x * PS, PY + y * PS];
const potSpace = fn => { CX.save(); CX.translate(PX, PY); CX.scale(PS, PS); try { fn(); } finally { CX.restore(); } };
const cHW = y => lerp(112, 148, (-12 - y) / 290);   // collector (top chamber) half-width, y from -12 up to -302
const bHW = y => lerp(122, 156, (y - 12) / 288);    // boiler (bottom chamber) half-width, y from 12 down to 300
const path = (pts, close = true) => { CX.beginPath(); pts.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y)); if (close) CX.closePath(); };
const mirror = pts => pts.map(([x, y]) => [-x, y]);
const COLL = [[-cHW(-302), -302], [cHW(-302), -302], [cHW(-12), -12], [-cHW(-12), -12]];
const BOIL = [[-bHW(12), 12], [bHW(12), 12], [bHW(292), 292], [bHW(300) - 8, 300], [-bHW(300) + 8, 300], [-bHW(292), 292]];
const COLL_IN = [[-cHW(-296) + 7, -296], [cHW(-296) - 7, -296], [cHW(-22) - 7, -22], [-cHW(-22) + 7, -22]];
const BOIL_IN = [[-bHW(20) + 7, 20], [bHW(20) - 7, 20], [bHW(294) - 7, 294], [-bHW(294) + 7, 294]];
const SPOUT = [[-cHW(-302) + 3, -302], [-210, -318], [-cHW(-256) + 3, -256]];
const HANDLE = [[cHW(-280), -280], [222, -286], [236, -264], [208, -100], [188, -84], [cHW(-78), -78]];
const KNOB = [[-30, -318], [-22, -350], [22, -350], [30, -318]];
const FUNNEL = [[-104, 14], [-92, 64], [-13, 72], [-13, 282]];       // left half; the right is its mirror
const GROUNDS = [[-98, 20], [-88, 60], [88, 60], [98, 20]];
const COLUMN = [[-15, -20], [-15, -212], [-23, -222]];
const FACET = (hw, y0, y1) => [[-hw(y0), y0], [-.4 * hw(y0), y0], [-.4 * hw(y1), y1], [-hw(y1), y1]];

// ---------- the process, as functions of t ----------
const LEVEL0 = 128;                                                                       // filled to just under the valve
const waterLevel = t => lerp(LEVEL0, 262, EASE.inOut(seg(t, PUSH, PUSH + 2.4)));         // falls as it is pushed up
const tubeLevel = t => t < PUSH ? LEVEL0 : lerp(LEVEL0, 66, EASE.inOut(seg(t, PUSH, PUSH + .6)));
const columnTop = t => lerp(-20, -216, EASE.inOut(seg(t, BREAK - .3, BREAK)));            // coffee climbs the column
const coffeeLevel = t => lerp(-22, -170, EASE.inOut(seg(t, BREAK + .05, STAMP - .25)));    // and fills the top
const COFFEE = [['pink', 1], ['yellow', 1], ['blue', .5]];   // coffee is all three inks: red-orange darkened by a half-tone of blue
const coffee = fn => COFFEE.forEach(([n, k]) => R.on(n, () => R.tint(k, fn)));

function fillBelow(poly, level, th, amp) {   // a liquid: everything under a gently moving surface, inside poly
  CX.save(); path(poly); CX.clip(); CX.beginPath(); CX.moveTo(-220, 330);
  for (let x = -220; x <= 220; x += 8) CX.lineTo(x, level + amp * Math.sin(x * .045 + th * 7) + amp * .5 * Math.sin(x * .11 - th * 5));
  CX.lineTo(220, 330); CX.closePath(); CX.fill(); CX.restore();
}
function bubbles(t, lv) {   // knocked out of the water tint once the heat is on; seeded, rising at fixed speeds
  if (t < FIRE + .3) return;
  R.on('blue', () => R.knock(() => { CX.save(); path(BOIL_IN); CX.clip();
    for (let i = 0; i < 18; i++) { const r = rnd(300 + i), x = (i % 2 ? 1 : -1) * (28 + 74 * r()), sp = .7 + .7 * r(), ph = r(), st = FIRE + .3 + r() * 1.4, rad = 3 + 5 * r();
      if (t < st) continue; const y = 290 - frac((t - st) * sp + ph) * (290 - LEVEL0); if (y < lv + rad + 2) continue;
      CX.beginPath(); CX.arc(x, y, rad, 0, TAU); CX.fill(); }
    CX.restore(); }));
}
function grounds(t, k) {   // roasted: solid yellow and pink under a blue tint (brown), with a sparse blue stipple for the grains;
  const w = R.printIn(t, PUSH + .45, .45);   // wet, the blue tint deepens. (A pink tint would leave holes where blue on yellow prints green.)
  R.on('yellow', () => R.tint(k, () => { path(GROUNDS); CX.fill(); }));
  R.on('pink', () => R.tint(k, () => { path(GROUNDS); CX.fill(); }));
  R.on('blue', () => { CX.fillStyle = R.tone(k); R.stipple([-100, 18, 200, 44], 60, 2.4, 21, () => path(GROUNDS));
    R.tint((.4 + .1 * w) * k, () => { path(GROUNDS); CX.fill(); }); });
}
function spurt(t, cl) {   // droplets thrown over the column's lip, falling into the coffee below
  if (t < BREAK) return;
  coffee(() => {
    const dome = clamp(seg(t, BREAK, BREAK + .15)) * (1 - seg(t, STAMP - .5, STAMP - .3));
    if (dome > 0) { CX.beginPath(); CX.ellipse(0, -218, 16, 12 * dome, 0, Math.PI, TAU); CX.fill(); }
    for (let i = 0; i < 30; i++) { const r = rnd(500 + i), t0 = BREAK + i * .05, dt = t - t0; if (dt < 0 || t0 > STAMP - .45) continue;
      const vx = (i % 2 ? 1 : -1) * (40 + 100 * r()), vy = -(70 + 120 * r()), x = vx * dt, y = -220 + vy * dt + 650 * dt * dt;
      if (y > cl - 3 || Math.abs(x) > cHW(y) - 10) continue;
      CX.beginPath(); CX.arc(x, y, 4 + 3 * r(), 0, TAU); CX.fill(); }
  });
}
function tongue(x, base, w, h) { CX.beginPath(); CX.moveTo(x - w / 2, base); CX.quadraticCurveTo(x - w * .55, base - h * .45, x, base - h);
  CX.quadraticCurveTo(x + w * .55, base - h * .45, x + w / 2, base); CX.closePath(); }
const fireK = t => springStep(t - FIRE, 'snappy') * (1 - easeIn(seg(t, STAMP - .55, STAMP - .1)));   // the flame's strength
function glow(t) {   // the heat as a pink halftone glow round the burner, under the pan support: it grows and dies with the flame
  const k = fireK(t); if (k <= .01) return;
  R.on('pink', () => { CX.save(); CX.beginPath(); CX.rect(-270, 306, 540, 92); CX.clip(); R.blob(0, 358, 260, .6 * k, { ry: 84, power: 1.3 }); CX.restore(); });
}
function flame(t) {   // hand-animated on twos: the tongues flicker from print to print
  const k = fireK(t); if (k <= .01) return;
  const th = R.held(t), F = [];
  for (let i = 0; i < 9; i++) F.push([lerp(-124, 124, i / 8), (52 + 18 * noise(th * 6 + i * 3.1, 4)) * k * (1 - .3 * Math.abs(i - 4) / 4)]);
  R.on('yellow', () => { CX.fillStyle = R.SOLID; for (const [x, h] of F) { tongue(x, 352, 30, h); CX.fill(); } });
  R.on('pink', () => { CX.fillStyle = R.SOLID; for (const [x, h] of F) { tongue(x, 352, 30, h); CX.fill(); } R.knock(() => { for (const [x, h] of F) { tongue(x, 354, 13, h * .5); CX.fill(); } }); });
}
function steam(t) {   // halftone puffs from the spout once it is ready: each grows and thins out (its dots shrink) as it rises
  if (t < STAMP) return;
  const th = R.held(t), [wx, wy, ww, wh] = [(1006 - PX) / PS, (164 - PY) / PS, 768 / PS, 814 / PS];
  R.on('blue', () => { CX.save(); CX.beginPath(); CX.rect(wx, wy, ww, wh); CX.clip();
    for (let i = 0; i < 5; i++) { const t0 = STAMP + .08 + i * .4, a = th - t0, life = 1.8; if (a < 0 || a > life) continue;
      // they drift away from the pot more than they climb, so each has thinned to nothing well below the caption bar
      const u = a / life, x = -222 - 70 * easeOut(u) + 14 * noise(a * 1.5 + i * 1.7, 7), y = -330 - 60 * easeOut(u);
      R.blob(x, y, 26 + 32 * easeOut(u), .58 * Math.pow(Math.sin(Math.PI * u), .7), { power: .9 }); }
    CX.restore(); });
}

// ---------- page 1: the pot printed whole, the title stamped on ----------
function silhouette(t, k, ks = k) {
  potSpace(() => {
    R.on('yellow', () => { R.tint(k, () => { for (const p of [COLL, BOIL, SPOUT]) { path(p); CX.fill(); } rr(-134, -12, 268, 24, 6); CX.fill(); rr(-156, -320, 312, 20, [10, 10, 2, 2]); CX.fill(); });
      R.knock(() => { CX.lineWidth = 4; for (const s of [-1, 1]) { path([[s * .4 * cHW(-300), -300], [s * .4 * cHW(-14), -14]], false); CX.stroke(); path([[s * .4 * bHW(14), 14], [s * .4 * bHW(298), 298]], false); CX.stroke(); } }); });
    R.on('pink', () => R.tint(.45 * ks, () => { path(FACET(cHW, -302, -12)); CX.fill(); path(FACET(bHW, 12, 300)); CX.fill(); }));
    R.on('blue', () => R.tint(k, () => { path(KNOB); CX.fill(); line(HANDLE, CX.fillStyle, 22); }));
  });
}
const TA = 'HOW A', TB = 'MOKA POT', TC = 'MAKES COFFEE', TF = { family: 'Barlow Condensed', weight: 900 };
// slammed(t, t0, x, cy, from, fn): a block that slams on at t0, scaled about its LEFT edge, so while it falls it
// grows into its own column, never off the frame or across the pot
function slammed(t, t0, x, cy, from, fn) { const s = R.slam(t, t0, { from }); if (!s) return; CX.save(); CX.translate(x, cy); CX.scale(s.scale, s.scale); CX.translate(-x, -cy); fn(s); CX.restore(); }
function pageA(t) {
  const k = R.printIn(t, -.15, .55);   // part-printed on the first frame; the pink plate comes later
  R.on('blue', () => R.blob(PX + 8, PY + 300 * PS + 16, 280, .34 * k, { ry: 30, power: 1.2 }));   // its shadow on the table, a squashed halftone
  silhouette(t, k, R.printIn(t, SHADE, .5));
  // three lines: two stamped as one block, then the slab. Sized so the widest fits beside the pot.
  const s = Math.min(186, fitSize(TC, TF, 950)), cap = s * .7, pad = 24, x = 150;
  const yA = 436, yB = yA + cap + 34, slabTop = yB + 36, yC = slabTop + pad + cap, wC = measure(TC, { ...TF, size: s });
  slammed(t, L1, x, (yA + yB) / 2 - cap / 2, 1.3, k => {
    const sh = { ink: 'pink', dx: 10, dy: 10, tone: k.tone };
    R.type(k.landed ? 'title:a' : null, TA, x, yA, { size: s, tone: k.tone, shadow: sh });
    R.type(k.landed ? 'title:b' : null, TB, x, yB, { size: s, tone: k.tone, shadow: sh });
  });
  slammed(t, L2, x - pad, yC - cap / 2, 1.1, k => {   // the slab is ~1000 px wide: any bigger and it falls across the pot
    R.on('pink', () => R.tint(k.tone, () => CX.fillRect(x - pad, slabTop, wC + pad * 2, cap + pad * 2)));
    R.type(k.landed ? 'title:c' : null, TC, x, yC, { size: s, tone: k.tone });
  });
}

// ---------- page 2: the cutaway ----------
const WIN = [1000, 104, 780, 880];
const HEAD = 'IT RUNS UPHILL'; let HS = 0;
const headSize = () => HS || (HS = Math.min(150, fitSize(HEAD, TF, 800)));   // a constant, measured once
const ROWS = [   // COFFEE's label takes 55% blue (the liquid 50%): at 42% the screen prints navy polka dots through the letters, and over
                 // about 60% blue on red-orange multiplies to a green-black
  { t: FIRE, word: 'HEAT', note: 'builds pressure below', y: 916, inks: ['pink', 'yellow'], tones: [1, 1], to: toFrame([-118, 344]) },
  { t: PUSH, word: 'WATER', note: 'is pushed up the funnel', y: 690, inks: ['blue'], tones: [1], to: toFrame([-13, 196]) },
  { t: b(13), word: 'COFFEE', note: 'rises into the top', y: 462, inks: ['pink', 'yellow', 'blue'], tones: [1, 1, .55], to: toFrame([-96, -112]) },
];
function rows(t) {
  const off = R.printIn(t, STAMP - .5, .4);   // when the flame dies, the heat label and its leader drop back to a tint
  for (const r of ROWS) {
    const dim = r.word === 'HEAT' ? 1 - .65 * off : 1, k = R.printIn(t, r.t, .4) * dim;
    // the label is printed with the page as an open outline in the key ink; it takes its own inks when its step happens
    const m = R.type('row:' + r.word, r.word, 150, r.y, { size: 124, outline: 3.5 });
    if (k > 0) R.type(null, r.word, 150, r.y, { size: 124, inks: r.inks, tones: r.tones.map(v => v * k) });
    const k2 = R.printIn(t, r.t + .15, .4);
    if (k2 > 0) R.type(k2 > .9 ? 'note:' + r.word : null, r.note, 153, r.y + 58, { family: 'Space Grotesk', weight: 600, size: 40, tone: k2 });
    const p = EASE.inOut(seg(t, r.t + .25, r.t + .8));
    if (p > 0) R.on('blue', () => R.tint(dim, () => { const y0 = r.y - 44, x0 = 150 + m.w + 28;
      lineTo([[x0, y0], [970, y0], r.to], p, R.tone(dim), 4.5, { dash: [.5, 11], cap: 'round' });
      if (p > .97) circle(r.to[0], r.to[1], 8, R.tone(dim)); }));
  }
}
function cutaway(t) {
  const pd = EASE.inOut(seg(t, DRAW, DRAW + .6)), pk = R.printIn(t, DRAW + .2, .4), pw = R.printIn(t, DRAW + .3, .45);
  const lv = waterLevel(t), cl = coffeeLevel(t), th = R.held(t);
  potSpace(() => {
    // liquids and grounds first (tints), the metal over them
    R.on('blue', () => R.tint(.36 * pw, () => { fillBelow(BOIL_IN, lv, th, 2.5); const tl = tubeLevel(t); CX.fillRect(-10, tl, 20, 282 - tl); }));
    bubbles(t, lv);
    grounds(t, pk);
    if (t >= BREAK - .3) coffee(() => { const ct = columnTop(t); CX.fillRect(-10, ct, 20, -20 - ct); });
    if (t >= BREAK) coffee(() => fillBelow(COLL_IN, cl, th, 2));
    spurt(t, cl);
    glow(t);
    flame(t);
    R.on('blue', () => {
      // the shell arrives with the page; the parts inside draw themselves after it
      line([...COLL, COLL[0]], R.SOLID, 8); line([...BOIL, BOIL[0]], R.SOLID, 8); line(SPOUT, R.SOLID, 6); line(HANDLE, R.SOLID, 22);
      CX.fillStyle = R.SOLID; rr(-156, -320, 312, 20, [10, 10, 2, 2]); CX.fill(); path(KNOB); CX.fill();
      const vx = bHW(118); CX.fillRect(vx - 2, 106, 24, 24); CX.fillRect(vx + 22, 100, 6, 36);                             // safety valve
      rr(-128, 352, 256, 14, 4); CX.fill(); CX.fillRect(-206, 302, 412, 7);                                                 // burner, pan support
      R.hatch([-134, -12, 268, 24], 8, 45, 2.4); CX.lineWidth = 3; rr(-134, -12, 268, 24, 4); CX.stroke();                // the screw joint, in section
      lineTo(FUNNEL, pd, R.SOLID, 5); lineTo(mirror(FUNNEL), pd, R.SOLID, 5); lineTo(COLUMN, pd, R.SOLID, 5); lineTo(mirror(COLUMN), pd, R.SOLID, 5);
      R.tint(pk, () => { CX.fillRect(-100, -21, 200, 8); R.knock(() => { for (let x = -90; x < 90; x += 14) CX.fillRect(x, -19, 6, 4); }); });   // the filter plate and its holes
    });
    steam(t);
  });
}
function pageB(t) {
  const hs = headSize();   // the page's one claim, its cap height level with the panel's top
  R.type('head', HEAD, 150, WIN[1] + hs * .7, { size: hs, ink: 'pink', shadow: { ink: 'yellow', dx: 10, dy: 10, knock: true } });
  R.win(...WIN, { title: 'MOKA POT, CUT IN HALF', id: 'window' });
  cutaway(t);
  rows(t);
  R.stamp('stamp', 'READY', 1590, 250, t, STAMP, { size: 112, rot: -7, ink: 'pink', seed: 4 });   // on the panel, over the empty top of the pot
}

// ---------- the film ----------
const shake = t => [0, 5 * (kick(t, L1, { tau: .07 }) + kick(t, L2, { tau: .07 })) + 7 * kick(t, STAMP, { tau: .08 })];
// the print pass: on the look's near-linear curve, so the three ink bands keep their spacing. Its leading edge starts
// just left of the type, so the first band reaches ink on beat 6, and it stops once the last plate has cleared the
// panel's shadow (the panel's right side plus two staggers plus the slant at the foot of the sheet)
const STAGGER = 260, PASS = { stagger: STAGGER, slant: 10, from: 60, to: WIN[0] + WIN[2] + 16 + 2 * STAGGER + 85 };
shots([
  [0, t => R.print(t, pageA, { shake: shake(t) })],
  [SWEEP, t => R.print(t, tt => R.sweep(tt, SWEEP, SWEEP_DUR, pageA, pageB, PASS), { shake: shake(t) })],
  [B0, t => R.print(t, pageB, { shake: shake(t) })],
]);

// ---------- sound cues, from the same times ----------
cue(L1, 'thump', { weight: 1, id: 'title' }); cue(L2, 'thump', { weight: .9, id: 'title' });
cue(SWEEP, 'swish', { weight: .7, dur: SWEEP_DUR, id: 'print-pass' });
cue(FIRE, 'whoosh', { weight: .5, dur: .4, id: 'ignite' });
cue(PUSH, 'riser', { weight: .6, dur: BREAK - PUSH, id: 'pressure' });
cue(BREAK, 'pop', { weight: .8, id: 'break-through' });
cue(STAMP, 'thump', { weight: 1.2, id: 'stamp' }); cue(STAMP + .06, 'bell', { weight: .7, id: 'ready' });
