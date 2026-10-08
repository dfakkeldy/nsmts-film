// looks/notebook.js: atlas look 16, "Paper and handwriting", in its annotated-notebook variant, with the stroke
// variant's draw-on and line boil for every mark. A page of dot-grid paper; every mark arrives as a marker stroke drawn
// on by one pen; notes are written in a single-stroke hand drawn from stroke data (not a font); one clean vector
// protagonist leaves an onion-skin trail; sticky notes slap down, tape lays on, a highlighter swipes.
// Card: looks/notebook.md. Specimen: specimens/notebook.
//
// A film is a list of MARKS, each { kind, t, ... }, drawn in list order (later marks on top) on paper under a camera:
// NB.page(t, MARKS, { cam, pen }). Pen marks (write, path, arrow, ring, underline, strike, tick, cross) and highlights
// share one hand that glides between them (a pen, or a highlighter for a highlight) and leaves the frame in long gaps.
// Every helper also works on its own (immediate mode): NB.drawOn(path, p), NB.arrow(a, b, p), NB.write(id, str, x, y,
// p) ... each a pure function of its arguments.

const NB = (() => {
  const S = Object.assign({
    paper: '#F4F1E9', grid: 'dots', gap: 40, gridCol: '#93A3B6', gridA: .5, fibre: 1, vignette: .1,
    ink: '#202227', red: '#D63F2A', blue: '#2B5BD8', sticky: '#E9D9B4', steel: '#6F7680', tape: '#E4DCC8',
    hl: '#2B5BD8', hlA: .3,          // the highlighter is a wash of the accent, so the palette stays ink + two colours
    lw: 5, wobble: 1, boil: 0, boilFps: Math.round(FPS / (FPS >= 48 ? 4 : FPS >= 25 ? 3 : 2)),   // boil on threes at 30 fps, twos at 24
    speed: 1500, size: 56, cps: 20, slant: .16, track: 1.3,
    pen: true, penLen: 240, serif: 'Fraunces',
  }, P.notebook || {});
  const RAD = Math.PI / 180;

  // ---------- caching (geometry is a pure function of its inputs; caching it only saves time) ----------
  const _wm = new WeakMap(), _m = new Map();
  function memo(key, build) {
    if (key && typeof key === 'object') { if (!_wm.has(key)) _wm.set(key, build()); return _wm.get(key); }
    if (!_m.has(key)) { if (_m.size > 4000) _m.clear(); _m.set(key, build()); } return _m.get(key);
  }

  // ---------- paths ----------
  // A path is a polyline [[x, y], ...], a list of polylines, or a string in a small SVG-like language, one stroke per
  // 'M': M x,y  L x,y  Q cx,cy x,y  C c1x,c1y c2x,c2y x,y  A cx,cy rx,ry a0,a1 (an elliptical arc, degrees, clockwise
  // when a1 > a0; it starts a stroke when none is open). Absolute coordinates only; no S, H, V or relative commands.
  // Returns a list of polylines, sampled about `step` apart.
  function parse(d, step = 3) {
    const tok = String(d).match(/[MLQCA]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], out = []; let cur = null, i = 0, x = 0, y = 0;
    const num = () => +tok[i++], push = (px, py) => { cur.push([px, py]); x = px; y = py; };
    const n = len => Math.max(2, Math.ceil(len / step));
    while (i < tok.length) {
      const c = tok[i++];
      if (c === 'M') { x = num(); y = num(); cur = [[x, y]]; out.push(cur); }
      else if (c === 'L') { const bx = num(), by = num(), k = n(Math.hypot(bx - x, by - y)), ax = x, ay = y; for (let j = 1; j <= k; j++) push(lerp(ax, bx, j / k), lerp(ay, by, j / k)); }
      else if (c === 'Q') { const cx = num(), cy = num(), bx = num(), by = num(), ax = x, ay = y, k = n(Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy));
        for (let j = 1; j <= k; j++) { const u = j / k, v = 1 - u; push(v * v * ax + 2 * u * v * cx + u * u * bx, v * v * ay + 2 * u * v * cy + u * u * by); } }
      else if (c === 'C') { const c1x = num(), c1y = num(), c2x = num(), c2y = num(), bx = num(), by = num(), ax = x, ay = y;
        const k = n(Math.hypot(c1x - ax, c1y - ay) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(bx - c2x, by - c2y));
        for (let j = 1; j <= k; j++) { const u = j / k, v = 1 - u; push(v * v * v * ax + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * bx, v * v * v * ay + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * by); } }
      else if (c === 'A') { const cx = num(), cy = num(), rx = num(), ry = num(), a0 = num() * RAD, a1 = num() * RAD, k = n(Math.abs(a1 - a0) * Math.max(rx, ry));
        const pt = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
        if (!cur) { const [px, py] = pt(a0); x = px; y = py; cur = [[x, y]]; out.push(cur); }
        for (let j = 0; j <= k; j++) { const [px, py] = pt(lerp(a0, a1, j / k)); if (j || Math.hypot(px - x, py - y) > 1e-6) push(px, py); } }
    }
    return out;
  }
  const isPt = v => Array.isArray(v) && typeof v[0] === 'number';
  function polylines(path, step = 3) { if (typeof path === 'string') return parse(path, step); if (isPt(path[0])) return [resample(path, step)]; return path.map(p => resample(p, step)); }
  function resample(pts, step = 3) {
    const out = [pts[0].slice()];
    for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let j = 1; j <= k; j++) out.push([lerp(ax, bx, j / k), lerp(ay, by, j / k)]); }
    return out;
  }
  function lengths(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; }
  // a hand's slow waver plus a finer tremor: each point pushed sideways by seeded noise along the stroke's length
  function wobble(pts, seed, amp, wl) {
    if (!amp || pts.length < 2) return pts;
    const L = lengths(pts), n = pts.length;
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const off = amp * (noise(L[i] / wl, seed) + .3 * noise(L[i] / (wl * .27), seed + 17));
      return [p[0] - dy / d * off, p[1] + dx / d * off];
    });
  }
  // a stroke: { pts, L, len }. o: seed, amp (px, default from lw), wl (px)
  function stroke(pts, o = {}) { const w = wobble(pts, o.seed ?? 1, o.amp ?? 0, o.wl ?? 150), L = lengths(w); return { pts: w, L, len: L[L.length - 1] }; }
  function pointAt(st, s) {
    const L = st.L, n = L.length; if (s <= 0) return { i: 0, p: st.pts[0] }; if (s >= st.len) return { i: n - 1, p: st.pts[n - 1] };
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < s) lo = m; else hi = m; }
    const k = (s - L[lo]) / ((L[hi] - L[lo]) || 1); return { i: lo, p: [lerp(st.pts[lo][0], st.pts[hi][0], k), lerp(st.pts[lo][1], st.pts[hi][1], k)] };
  }
  // ink one stroke up to fraction p of its length: a round-capped marker line, multiplied into the paper
  function inkStroke(st, p, col, lw) {
    if (p <= 0) return null; const e = pointAt(st, st.len * clamp(p));
    CX.beginPath(); CX.moveTo(st.pts[0][0], st.pts[0][1]); for (let i = 1; i <= e.i; i++) CX.lineTo(st.pts[i][0], st.pts[i][1]);
    CX.lineTo(e.p[0] + (st.len < 1 ? .3 : 0), e.p[1]);
    CX.strokeStyle = col; CX.lineWidth = lw; CX.lineCap = 'round'; CX.lineJoin = 'round'; CX.stroke();
    return e.p;
  }
  // a written stroke with pen pressure: it lands a little thin, swells, and flicks off thinner, with a slow unevenness
  // between. Drawn as short round-capped pieces of opaque ink (the caller premultiplies the ink by the paper), so the
  // overlaps between pieces don't darken.
  function inkPress(st, p, col, lw, seed) {
    if (p <= 0) return null; const len = st.len; if (len < lw * 1.6) return inkStroke(st, p, col, lw);   // a dot
    const e = pointAt(st, len * clamp(p)), pts = st.pts, L = st.L, rin = Math.min(len * .3, lw * 2.6), rout = Math.min(len * .35, lw * 3.4);
    const wAt = s => lw * (.5 + .22 * ease(s / rin) + .28 * ease((len - s) / rout)) * (1 + .1 * noise(s / (lw * 5), seed));
    CX.strokeStyle = col; CX.lineCap = 'round'; CX.lineJoin = 'round';
    const piece = lw * 1.2; let i0 = 0;
    while (i0 < e.i) { let i1 = i0 + 1; while (i1 < e.i && L[i1] - L[i0] < piece) i1++;
      CX.beginPath(); CX.moveTo(pts[i0][0], pts[i0][1]); for (let i = i0 + 1; i <= i1; i++) CX.lineTo(pts[i][0], pts[i][1]);
      CX.lineWidth = wAt((L[i0] + L[i1]) / 2); CX.stroke(); i0 = i1; }
    CX.beginPath(); CX.moveTo(pts[e.i][0], pts[e.i][1]); CX.lineTo(e.p[0] + .01, e.p[1]); CX.lineWidth = wAt(len * clamp(p)); CX.stroke();
    return e.p;
  }
  // a colour multiplied by another, as multiply blending would show it (ink on paper)
  const mulCol = (a, b) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(((pa >> i) & 255) * ((pb >> i) & 255) / 255);
    return '#' + [16, 8, 0].map(i => c(i).toString(16).padStart(2, '0')).join(''); };

  // ---------- marks drawn by a pen: strokes in order, with the pen's air moves between them ----------
  const AIR = .35;   // an air move costs this fraction of its length in pen time
  function plan(strokes, o = {}) {
    let tot = 0; const segs = [];
    strokes.forEach((st, i) => {
      if (i) { const a = strokes[i - 1].pts[strokes[i - 1].pts.length - 1], b = st.pts[0], d = Math.hypot(b[0] - a[0], b[1] - a[1]) * AIR; segs.push({ air: true, a, b, s0: tot, s1: tot + d }); tot += d; }
      segs.push({ st, s0: tot, s1: tot + st.len }); tot += st.len;
    });
    return { strokes, segs, tot, a: strokes[0].pts[0], b: strokes[strokes.length - 1].pts.slice(-1)[0], col: o.col, lw: o.lw };
  }
  const strokeEase = k => lerp(k, ease(k), .55);   // a pen speeds up into a stroke and slows out of it
  // draw a planned mark at progress u (0..1); returns the pen tip and how far it is lifted (0 on the paper)
  function drawPlan(G, u, col, lw) {
    const want = G.tot * clamp(u); let tip = G.a, lift = 0;
    // the hand's strokes carry pressure (opaque pieces, ink premultiplied by the paper); a faded note falls back to
    // even strokes, since translucent pieces would bead where they overlap
    const press = G.press && CX.globalAlpha > .98, ink = press ? mulCol(col, S.paper) : col;
    CX.save(); CX.globalCompositeOperation = press ? 'source-over' : 'multiply';
    let n = 0;
    for (const sg of G.segs) {
      if (sg.s0 > want || (sg.s0 === want && want === 0 && u <= 0)) break;
      const k = clamp((want - sg.s0) / ((sg.s1 - sg.s0) || 1));
      if (sg.air) { if (k < 1) { const e = ease(k); tip = [lerp(sg.a[0], sg.b[0], e), lerp(sg.a[1], sg.b[1], e)]; lift = Math.sin(Math.PI * k); } else tip = sg.b; continue; }
      const kk = k >= 1 ? 1 : strokeEase(k), p = press ? inkPress(sg.st, kk, ink, lw, G.press + n * 1.7) : inkStroke(sg.st, kk, ink, lw); tip = p || tip; n++;
    }
    CX.restore();
    return { tip, lift };
  }
  function tipOf(G, u) {
    const want = G.tot * clamp(u); let tip = G.a, lift = 0;
    for (const sg of G.segs) {
      if (sg.s0 > want) break; const k = clamp((want - sg.s0) / ((sg.s1 - sg.s0) || 1));
      if (sg.air) { if (k < 1) { const e = ease(k); tip = [lerp(sg.a[0], sg.b[0], e), lerp(sg.a[1], sg.b[1], e)]; lift = Math.sin(Math.PI * k); } else tip = sg.b; continue; }
      tip = pointAt(sg.st, sg.st.len * (k >= 1 ? 1 : strokeEase(k))).p;
    }
    return { tip, lift };
  }
  // line boil: re-seed the wobble a few times a second (o.boil px), the graphite stop-motion look
  const boilSeed = (o, t) => (o.boil || S.boil) > 0 && t != null ? Math.floor(t * (o.boilFps || S.boilFps)) * 31 : 0;
  function marker(polys, o, t) {
    const lw = o.lw ?? S.lw, amp = (o.amp ?? lw * .45 + 1.2) * S.wobble + (o.boil || S.boil || 0), seed = (o.seed ?? 1) + boilSeed(o, t);
    return plan(polys.map((pl, i) => stroke(resample(pl, 3), { seed: seed + i * 7.7, amp, wl: o.wl ?? 150 })), { col: o.col, lw });
  }

  // ---------- the hand: single-stroke lettering from stroke data ----------
  // Glyph units: baseline 0, x-height -5, caps -7.4, ascenders -8, descenders +3. Each glyph is [ink width, ...strokes],
  // each stroke one pen-down in the path language above, in the order a hand writes it.
  const G_ = {
    a: [4, 'A 2,-2.5 2,2.5 -25,-335', 'M 4,-5.1 L 4,0'],
    b: [4.2, 'M 0,-8 L 0,0', 'A 2.1,-2.5 2.1,2.5 195,525'],
    c: [3.9, 'A 2,-2.5 2,2.5 -42,-318'],
    d: [4, 'A 2,-2.5 2,2.5 -25,-335', 'M 4,-8 L 4,0'],
    e: [4, 'M 0.25,-2.6 L 3.95,-2.6 A 2,-2.5 2,2.5 -2,-318'],
    f: [3.1, 'M 3.1,-7.5 C 2.6,-8.1 1.3,-8.2 1.2,-6.6 L 1.2,0', 'M 0,-4.9 L 2.9,-4.9'],
    g: [4, 'A 2,-2.5 2,2.5 -25,-335', 'M 4,-5.1 L 4,1.4 C 4,3.3 1.4,3.5 0.4,2.2'],
    h: [4, 'M 0,-8 L 0,0', 'M 0,-3 C 0.5,-4.5 1.4,-5 2.3,-5 C 3.4,-5 4,-4.3 4,-3.1 L 4,0'],
    i: [0.5, 'M 0.4,-5 L 0.4,0', 'M 0.4,-6.9 L 0.45,-6.75'],
    j: [1.7, 'M 1.6,-5 L 1.6,1.6 C 1.6,3.2 0.3,3.4 -0.4,2.5', 'M 1.6,-6.9 L 1.65,-6.75'],
    k: [3.7, 'M 0,-8 L 0,0', 'M 3.5,-5 L 0.2,-2.1 L 3.7,0'],
    l: [1.5, 'M 0.5,-8 L 0.5,-0.9 Q 0.55,0 1.5,-0.1'],
    m: [6, 'M 0,-5 L 0,0', 'M 0,-3.3 C 0.4,-4.6 1.1,-5 1.7,-5 C 2.5,-5 3,-4.5 3,-3.4 L 3,0', 'M 3,-3.4 C 3.4,-4.6 4.1,-5 4.7,-5 C 5.5,-5 6,-4.5 6,-3.4 L 6,0'],
    n: [4, 'M 0,-5 L 0,0', 'M 0,-3.1 C 0.5,-4.5 1.4,-5 2.3,-5 C 3.4,-5 4,-4.3 4,-3.1 L 4,0'],
    o: [4.2, 'A 2.1,-2.5 2.1,2.5 -80,-448'],
    p: [4.2, 'M 0,-5 L 0,3', 'A 2.1,-2.5 2.1,2.5 195,525'],
    q: [4.6, 'A 2,-2.5 2,2.5 -25,-335', 'M 4,-5.1 L 4,3 L 4.6,2.4'],
    r: [3.1, 'M 0,-5 L 0,0', 'M 0,-2.9 C 0.5,-4.4 1.6,-5.1 3.1,-4.8'],
    s: [3.6, 'M 3.4,-4.4 C 2.9,-5.1 0.5,-5.3 0.4,-3.9 C 0.3,-2.6 3.6,-2.8 3.6,-1.3 C 3.6,0.3 0.9,0.3 0.1,-0.6'],
    t: [2.8, 'M 1.2,-7 L 1.2,-1 Q 1.25,0 2.6,-0.2', 'M 0,-4.9 L 2.8,-4.9'],
    u: [4, 'M 0,-5 L 0,-1.9 C 0,-0.6 0.9,0 1.9,0 C 3,0 4,-0.8 4,-2.2', 'M 4,-5 L 4,0'],
    v: [4, 'M 0,-5 L 2,0 L 4,-5'],
    w: [6, 'M 0,-5 L 1.4,0 L 3,-3.9 L 4.6,0 L 6,-5'],
    x: [3.8, 'M 0,-5 L 3.8,0', 'M 3.8,-5 L 0,0'],
    y: [4.2, 'M 0,-5 L 2.1,-0.3', 'M 4.2,-5 L 1.6,2.4 Q 1.2,3.3 0,3'],
    z: [4, 'M 0.2,-5 L 3.8,-5 L 0.2,0 L 4,0'],
    A: [5.2, 'M 0,0 L 2.6,-7.4 L 5.2,0', 'M 1,-2.7 L 4.2,-2.7'],
    B: [4.6, 'M 0,0 L 0,-7.4', 'M 0,-7.4 L 2.2,-7.4 C 3.7,-7.4 4.2,-6.6 4.2,-5.7 C 4.2,-4.6 3.3,-4 1.9,-4 L 0.2,-4', 'M 1.9,-4 C 3.9,-4 4.6,-3 4.6,-2 C 4.6,-0.8 3.8,0 2.2,0 L 0,0'],
    C: [5.4, 'A 3,-3.7 3,3.7 -42,-318'],
    D: [5.4, 'M 0,0 L 0,-7.4', 'M 0,-7.4 L 1.8,-7.4 C 4.2,-7.4 5.4,-5.7 5.4,-3.7 C 5.4,-1.6 4.2,0 1.8,0 L 0,0'],
    E: [4.2, 'M 4,-7.4 L 0,-7.4 L 0,0 L 4.2,0', 'M 0,-3.8 L 3.3,-3.8'],
    F: [4, 'M 4,-7.4 L 0,-7.4 L 0,0', 'M 0,-3.8 L 3.3,-3.8'],
    G: [6, 'A 3,-3.7 3,3.7 -42,-360 L 3.4,-3.7'],
    H: [4.6, 'M 0,-7.4 L 0,0', 'M 4.6,-7.4 L 4.6,0', 'M 0,-3.8 L 4.6,-3.8'],
    I: [0.4, 'M 0.2,-7.4 L 0.2,0'],
    J: [3, 'M 3,-7.4 L 3,-2.2 C 3,-0.6 2.2,0 1.4,0 C 0.6,0 0,-0.6 -0.1,-1.6'],
    K: [4.4, 'M 0,-7.4 L 0,0', 'M 4.2,-7.4 L 0.2,-3.3 L 4.4,0'],
    L: [3.8, 'M 0,-7.4 L 0,0 L 3.8,0'],
    M: [6, 'M 0,0 L 0.4,-7.4 L 3,-2.4 L 5.6,-7.4 L 6,0'],
    N: [4.6, 'M 0,0 L 0,-7.4 L 4.6,0 L 4.6,-7.4'],
    O: [6, 'A 3,-3.7 3,3.7 -85,-450'],
    P: [4.6, 'M 0,0 L 0,-7.4', 'M 0,-7.4 L 2.4,-7.4 C 4,-7.4 4.6,-6.4 4.6,-5.5 C 4.6,-4.4 3.8,-3.5 2.4,-3.5 L 0,-3.5'],
    Q: [6.1, 'A 3,-3.7 3,3.7 -85,-450', 'M 3.6,-1.6 L 6.1,0.6'],
    R: [4.7, 'M 0,0 L 0,-7.4', 'M 0,-7.4 L 2.4,-7.4 C 4,-7.4 4.6,-6.4 4.6,-5.5 C 4.6,-4.4 3.8,-3.5 2.4,-3.5 L 0,-3.5', 'M 2.2,-3.5 L 4.7,0'],
    S: [4.8, 'M 4.4,-6.5 C 3.8,-7.6 0.6,-7.9 0.5,-5.8 C 0.4,-3.9 4.8,-4.2 4.8,-1.8 C 4.8,0.4 1.1,0.4 0.1,-0.9'],
    T: [5, 'M 0,-7.4 L 5,-7.4', 'M 2.5,-7.4 L 2.5,0'],
    U: [4.8, 'M 0,-7.4 L 0,-2.6 C 0,-0.8 1.1,0 2.4,0 C 3.7,0 4.8,-0.8 4.8,-2.6 L 4.8,-7.4'],
    V: [5, 'M 0,-7.4 L 2.5,0 L 5,-7.4'],
    W: [7, 'M 0,-7.4 L 1.7,0 L 3.5,-5.4 L 5.3,0 L 7,-7.4'],
    X: [4.6, 'M 0,-7.4 L 4.6,0', 'M 4.6,-7.4 L 0,0'],
    Y: [4.8, 'M 0,-7.4 L 2.4,-3.7 L 4.8,-7.4', 'M 2.4,-3.7 L 2.4,0'],
    Z: [4.8, 'M 0.2,-7.4 L 4.6,-7.4 L 0,0 L 4.8,0'],
    0: [4.8, 'A 2.4,-3.7 2.4,3.7 -95,-460'],
    1: [2, 'M 0.4,-6 L 2,-7.4 L 2,0'],
    2: [4.6, 'M 0.3,-5.8 C 0.6,-7.2 1.6,-7.6 2.4,-7.6 C 3.6,-7.6 4.4,-6.8 4.4,-5.6 C 4.4,-4 2,-2.4 0.2,0 L 4.6,0'],
    3: [4.5, 'M 0.4,-6.8 C 1,-7.5 1.8,-7.6 2.4,-7.6 C 3.6,-7.6 4.2,-6.8 4.2,-5.9 C 4.2,-4.8 3.3,-4.1 2,-4.1 C 3.6,-4.1 4.5,-3.1 4.5,-2 C 4.5,-0.7 3.5,0.05 2.2,0.05 C 1.2,0.05 0.4,-0.4 0,-1'],
    4: [4.8, 'M 3.4,0 L 3.4,-7.4 L 0,-2.4 L 4.8,-2.4'],
    5: [4.6, 'M 4.2,-7.4 L 0.8,-7.4 L 0.4,-4.2 C 1.2,-4.8 2,-4.9 2.6,-4.9 C 3.8,-4.9 4.6,-3.9 4.6,-2.5 C 4.6,-0.9 3.6,0.05 2.3,0.05 C 1.3,0.05 0.5,-0.4 0,-1.1'],
    6: [4.5, 'M 3.9,-7.2 C 3.3,-7.6 2.8,-7.6 2.4,-7.6 C 1,-7.6 0.1,-5.8 0.1,-3.2 C 0.1,-1 1,0.05 2.3,0.05 C 3.6,0.05 4.5,-0.9 4.5,-2.3 C 4.5,-3.7 3.6,-4.6 2.4,-4.6 C 1.3,-4.6 0.4,-3.9 0.15,-2.9'],
    7: [4.6, 'M 0.2,-7.4 L 4.6,-7.4 L 1.6,0'],
    8: [4.7, 'M 2.4,-4.1 C 0.9,-4.1 0.4,-5 0.4,-5.9 C 0.4,-6.9 1.3,-7.6 2.4,-7.6 C 3.5,-7.6 4.3,-6.9 4.3,-5.9 C 4.3,-5 3.8,-4.1 2.4,-4.1 C 0.8,-4.1 0,-3.2 0,-2 C 0,-0.7 1,0.05 2.4,0.05 C 3.8,0.05 4.7,-0.7 4.7,-2 C 4.7,-3.2 3.9,-4.1 2.4,-4.1'],
    9: [4.4, 'M 4.3,-4.8 C 4,-3.8 3.2,-3.2 2.2,-3.2 C 0.9,-3.2 0.1,-4.1 0.1,-5.4 C 0.1,-6.7 1,-7.6 2.3,-7.6 C 3.6,-7.6 4.4,-6.6 4.4,-4.6 C 4.4,-1.8 3.4,0.05 2,0.05 C 1.3,0.05 0.8,-0.2 0.4,-0.5'],
    '.': [0.5, 'M 0.3,-0.3 L 0.35,-0.15'],
    ',': [0.8, 'M 0.8,-0.4 L 0.2,1.4'],
    '!': [0.6, 'M 0.6,-7.4 L 0.5,-2.4', 'M 0.45,-0.3 L 0.5,-0.15'],
    '?': [4.2, 'M 0.2,-6 C 0.4,-7.2 1.4,-7.6 2.3,-7.6 C 3.4,-7.6 4.2,-6.9 4.2,-5.8 C 4.2,-4.4 2.2,-4 2.2,-2.4', 'M 2.2,-0.3 L 2.25,-0.15'],
    ':': [0.5, 'M 0.3,-4.4 L 0.35,-4.25', 'M 0.3,-0.3 L 0.35,-0.15'],
    ';': [0.8, 'M 0.6,-4.4 L 0.65,-4.25', 'M 0.8,-0.4 L 0.2,1.4'],
    '-': [2.6, 'M 0.1,-2.7 L 2.6,-2.8'],
    '+': [3.6, 'M 0.1,-2.8 L 3.6,-2.8', 'M 1.85,-4.6 L 1.85,-1'],
    '=': [3.6, 'M 0.1,-3.6 L 3.6,-3.6', 'M 0.1,-1.9 L 3.6,-1.9'],
    "'": [0.5, 'M 0.5,-7.8 L 0.4,-6'],
    '"': [1.6, 'M 0.5,-7.8 L 0.4,-6', 'M 1.6,-7.8 L 1.5,-6'],
    '/': [3.4, 'M 0,0.6 L 3.4,-8'],
    '(': [1.8, 'M 1.8,-8.2 Q -0.6,-3.6 1.8,1.2'],
    ')': [1.8, 'M 0,-8.2 Q 2.4,-3.6 0,1.2'],
    '%': [5, 'M 0.4,0 L 4.6,-7.4', 'A 1,-6.3 1,1.1 -90,-450', 'A 4,-1.1 1,1.1 -90,-450'],
    '>': [3.6, 'M 0,-5.6 L 3.6,-2.8 L 0,0'],
    '<': [3.6, 'M 3.6,-5.6 L 0,-2.8 L 3.6,0'],
    '→': [5.6, 'M 0,-2.8 L 5.4,-2.8', 'M 3.6,-4.4 L 5.6,-2.8 L 3.6,-1.2'],
    '✓': [5, 'M 0,-3 L 1.6,-0.4 L 5,-6.6'],
    '×': [3.4, 'M 0,-4.6 L 3.4,-1.2', 'M 3.4,-4.6 L 0,-1.2'],
    '°': [1.6, 'A 0.8,-6.6 0.8,0.8 -90,-450'],
    // second forms of common letters: a repeated letter alternates between its forms, as a hand's does
    'a#': [4.2, 'M 3.9,-4 C 3.5,-4.8 2.8,-5.1 2.1,-5.1 C 0.8,-5.1 0,-3.9 0,-2.5 C 0,-1 0.9,0 1.9,0 C 2.9,0 3.6,-0.8 3.9,-1.9 L 3.95,-5.1 L 4,-0.6 Q 4.05,0 4.3,-0.1'],
    'd#': [4.1, 'M 3.9,-3.7 C 3.5,-4.7 2.8,-5.1 2.1,-5.1 C 0.8,-5.1 0,-3.9 0,-2.5 C 0,-1 0.9,0 1.9,0 C 2.9,0 3.6,-0.7 3.95,-1.8', 'M 4.1,-8.2 L 3.95,-0.4 Q 4,0 4.4,-0.1'],
    'e#': [4, 'M 0.3,-2.5 C 1.5,-2.3 3.8,-2.5 3.8,-3.7 C 3.8,-4.7 2.9,-5.1 2.1,-5.1 C 0.8,-5.1 0,-4 0,-2.6 C 0,-0.9 1,0 2.2,0 C 2.9,0 3.5,-0.3 3.9,-0.8'],
    'h#': [4.1, 'M 0,-8.1 L 0,0 L 0.05,-2.8 C 0.6,-4.5 1.5,-5 2.3,-5 C 3.4,-5 4,-4.3 4,-3 L 4.1,0'],
    'i#': [0.7, 'M 0.4,-5 L 0.35,0', 'M 0.3,-7.1 L 0.75,-6.7'],
    'l#': [1, 'M 0.75,-8.1 L 0.3,0'],
    'o#': [4.2, 'A 2.15,-2.45 2.1,2.55 -100,-445'],
    'r#': [3.1, 'M 0,-5.1 L 0.05,0 L 0.1,-3.1 C 0.8,-4.6 1.8,-5.1 3.1,-4.7'],
    't#': [3, 'M 1.3,-7.3 L 1.1,0', 'M -0.1,-4.5 L 3,-5.1'],
  };
  const GLYPH = {}, MISSING = new Set();
  for (const [ch, [w, ...strokes]] of Object.entries(G_)) GLYPH[ch] = { w, strokes: strokes.flatMap(s => parse(s, .18)) };
  const UNIT = 10.5;   // size / UNIT = px per glyph unit, so caps are about .7 of the size (like a typeset face)
  // layout(str, o) -> { strokes: [[x, y], ...] in px from the origin (left end of the first baseline), lines, box }
  // o: size, align, slant, track, lead (line height in sizes), seed. Every glyph is jittered (seeded by the text): its
  // size, width, angle and place, plus a slow warp so no bowl is a true arc; repeated letters alternate between their
  // forms. The same word is never written twice the same way unless it is the same note.
  function layout(str, o = {}) {
    const size = o.size || S.size, u = size / UNIT, sl = o.slant ?? S.slant, tr = o.track ?? S.track, lead = (o.lead ?? 1.32) * size, J = o.jitter ?? 1;
    const r = rnd(`${str}|${o.seed ?? 0}`), lines = String(str).split('\n'), strokes = [], spans = [], seen = {};
    lines.forEach((line, li) => {
      let ox = 0; const glyphs = [];
      for (const ch of line) {
        if (ch === ' ') { ox += 2.7 + (r() - .5) * .5; continue; }
        const base = GLYPH[ch] ? ch : GLYPH[ch.toLowerCase()] ? ch.toLowerCase() : null;
        if (!base) { if (!MISSING.has(ch)) { MISSING.add(ch); console.warn(`notebook: no glyph for "${ch}"`); } ox += 3; continue; }
        const n = seen[base] = (seen[base] ?? Math.floor(r() * 2)) + 1, g = GLYPH[base + '#'] && n % 2 ? GLYPH[base + '#'] : GLYPH[base];
        glyphs.push({ g, ox, dx: (r() - .5) * .34 * J, dy: (r() - .5) * .4 * J, rot: (r() - .5) * 8 * RAD * J, k: 1 + (r() - .5) * .1 * J, sx: 1 + (r() - .5) * .12 * J,
          wa: (r() - .5) * .5 * J, wb: (r() - .5) * .4 * J, wf: .8 + r() * .6, p1: r() * TAU, p2: r() * TAU });
        ox += g.w + tr + (r() - .5) * .4 * J;
      }
      const wpx = Math.max(0, ox - tr) * u, x0 = o.align === 'center' ? -wpx / 2 : o.align === 'right' ? -wpx : 0, y0 = li * lead, drift = r() * 10;
      spans.push({ x: x0, y: y0, w: wpx });
      for (const q of glyphs) {
        const cx = q.ox + q.g.w / 2, cy = -2.5, c = Math.cos(q.rot), s = Math.sin(q.rot), bl = .35 * noise(q.ox * .12 + drift, 5);   // the baseline wanders
        for (const pl of q.g.strokes) strokes.push(pl.map(([x, y]) => {
          let X = (x - q.g.w / 2) * q.k * q.sx, Y = (y + 2.5) * q.k;
          X += q.wa * Math.sin(Y * q.wf + q.p1); Y += q.wb * Math.sin(X * q.wf * 1.3 + q.p2);   // the warp: bowls go a little lopsided
          [X, Y] = [X * c - Y * s, X * s + Y * c];
          X += cx + q.dx; Y += cy + q.dy + bl; X -= Y * sl;
          return [x0 + X * u, y0 + Y * u];
        }));
      }
    });
    const minX = Math.min(...spans.map(s => s.x)), maxX = Math.max(...spans.map(s => s.x + s.w));
    return { strokes, spans, box: [minX, -7.4 * u, maxX - minX, (lines.length - 1) * lead + 10 * u], size, u };
  }
  // the hand's marks for a note at (x, y), rotated rot degrees about that point: world-space strokes
  function handGeom(str, x, y, o = {}, t) {
    const L = layout(str, o), c = Math.cos((o.rot || 0) * RAD), s = Math.sin((o.rot || 0) * RAD), T = ([px, py]) => [x + px * c - py * s, y + px * s + py * c];
    const lw = o.lw ?? Math.max(2, L.size * .078), amp = (o.amp ?? L.u * .09) * S.wobble + (o.boil || S.boil ? (o.boil || S.boil) * .5 : 0), seed = (o.seed ?? 3) + boilSeed(o, t);
    const G = plan(L.strokes.map((pl, i) => stroke(pl.map(T), { seed: seed + i * 3.1, amp, wl: L.u * 2.6 })), { col: o.col, lw });
    G.press = o.press === false ? 0 : seed + 1.3;   // pen pressure on (a seed for its unevenness)
    const [bx, by, bw, bh] = L.box, corners = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]].map(T);
    G.box = [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])), 0, 0];
    G.box[2] = Math.max(...corners.map(p => p[0])) - G.box[0]; G.box[3] = Math.max(...corners.map(p => p[1])) - G.box[1];
    G.corners = corners; G.size = L.size; G.n = [...str].filter(ch => ch.trim()).length;
    return G;
  }
  // register a world-space box with the text checks, through whatever transform (camera) is current
  function register(id, str, corners, a, size) {
    const M = CX.getTransform(), pts = corners.map(([px, py]) => [M.a * px + M.c * py + M.e, M.b * px + M.d * py + M.f]), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    readable(id, str.replace(/\n/g, ' '), Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), a, size * Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)));
  }
  // write(id, str, x, y, p, o): a note written on at progress p (0..1; 1 = finished). o: size, col, align, rot, slant,
  // track, lead, lw, seed. Registered for the checks once 90% written (id null: decorative). Returns { tip, lift, box }.
  function write(id, str, x, y, p, o = {}, t = T) {
    const G = memo(`w|${str}|${x}|${y}|${JSON.stringify(o)}|${boilSeed(o, t)}`, () => handGeom(str, x, y, o, t));
    const r = drawPlan(G, p, o.col || S.ink, G.lw);
    if (id !== null && p >= .9) register(id ?? str, str, G.corners, CX.globalAlpha, G.size);
    return { ...r, box: G.box };
  }
  // typeOn(id, str, x, y, p, o): a typeset line (Fraunces italic by default) revealed by a pen-path wipe: for longer
  // captions the hand would make slow. o: as draw.js text(), plus family. Returns { tip, box }.
  function typeOn(id, str, x, y, p, o = {}) {
    const to = { family: S.serif, weight: 400, italic: true, size: 44, color: S.ink, ...o }, w = measure(str, to), size = to.size;
    const x0 = to.align === 'center' ? x - w / 2 : to.align === 'right' ? x - w : x, k = EASE.inOut(clamp(p)), xe = x0 - size * .2 + (w + size * .4) * k;
    if (k <= 0) return { tip: [x0, y], box: [x0, y - size * .75, w, size] };
    CX.save(); CX.beginPath(); CX.rect(x0 - size, y - size * 1.2, xe - x0 + size, size * 1.8); CX.clip();
    text(k > .9 && id !== null ? (id ?? str) : null, str, x0, y, { ...to, align: 'left' }); CX.restore();
    const wig = Math.sin(xe * .09) * size * .22;   // the tip rises and falls as if forming letters
    return { tip: [xe, y - size * .25 + wig], box: [x0, y - size * .75, w, size] };
  }

  // ---------- shapes a pen draws (world px); each returns polylines ----------
  function arrowPolys(a, b, o = {}) {
    const [ax, ay] = a, [bx, by] = b, dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, bend = o.bend ?? .18;
    const mx = (ax + bx) / 2 - dy * bend, my = (ay + by) / 2 + dx * bend, shaft = [];
    for (let i = 0; i <= 48; i++) { const u = i / 48, v = 1 - u; shaft.push([v * v * ax + 2 * u * v * mx + u * u * bx, v * v * ay + 2 * u * v * my + u * u * by]); }
    const tl = Math.hypot(bx - mx, by - my) || 1, ux = (bx - mx) / tl, uy = (by - my) / tl, hl = o.head ?? clamp(d * .12, 16, 34), sp = (o.spread ?? 27) * RAD;
    const barb = s => [bx - hl * (ux * Math.cos(s) - uy * Math.sin(s)), by - hl * (uy * Math.cos(s) + ux * Math.sin(s))];
    return [shaft, [barb(sp), [bx, by], barb(-sp)]];
  }
  // a hand-drawn loop around a box [x, y, w, h]: starts upper right, runs anticlockwise past its start (o.turns)
  function ringPolys(box, o = {}) {
    const [x, y, w, h] = box, pad = o.pad ?? 16, cx = x + w / 2, cy = y + h / 2, rx = w / 2 + pad * 1.2, ry = h / 2 + pad, tilt = (o.tilt ?? -3) * RAD;
    const a0 = (o.start ?? -35) * RAD, sweep = -(o.turns ?? 1.12) * TAU, n = 140, seed = o.seed ?? 2, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n, a = a0 + sweep * u, g = 1 + (o.spiral ?? .07) * (u - .5) + .025 * noise(u * 4, seed);
      const px = Math.cos(a) * rx * g, py = Math.sin(a) * ry * g; pts.push([cx + px * Math.cos(tilt) - py * Math.sin(tilt), cy + px * Math.sin(tilt) + py * Math.cos(tilt)]); }
    return [pts];
  }
  function underlinePolys(x0, x1, y, o = {}) {
    const one = (a, b, yy, rise) => { const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push([lerp(a, b, u), yy + Math.sin(Math.PI * u) * (o.sag ?? 3) - u * rise]); } return pts; };
    const out = [one(x0, x1, y, o.rise ?? 5)]; if (o.double) out.push(one(x0 + (x1 - x0) * .06, x1 - (x1 - x0) * .02, y + (o.gap ?? 12), (o.rise ?? 5) * .6)); return out;
  }
  // a strike through a box; rtl: drawn right to left, from where the pen just finished writing
  function strikePolys(box, o = {}) { const [x, y, w, h] = box, yy = y + h * (o.at ?? .42), over = o.over ?? 12, dir = pl => o.rtl ? pl.reverse() : pl;
    if (o.scribble) { const pts = [], n = Math.max(3, Math.round(w / (h * .5))); for (let i = 0; i <= n; i++) pts.push([lerp(x - over, x + w + over, i / n), yy + (i % 2 ? -1 : 1) * h * .18]); return [dir(pts)]; }
    return [dir([[x - over, yy + h * .06], [x + w * .5, yy - h * .01], [x + w + over, yy - h * .07]])]; }
  const tickPolys = (x, y, s) => [[[x - s * .45, y - s * .02], [x - s * .12, y + s * .34], [x + s * .5, y - s * .48]]];
  const crossPolys = (x, y, s) => [[[x - s / 2, y - s / 2], [x + s / 2, y + s / 2]], [[x + s / 2, y - s / 2], [x - s / 2, y + s / 2]]];
  const boxOf = b => typeof b === 'function' ? b() : b && b.box ? b.box : b;

  // immediate-mode pen marks: p is progress 0..1; o: col, lw, seed, amp (wobble px), wl, boil. Each returns { tip, lift }.
  const keyOf = (name, args, o) => `${name}|${JSON.stringify(args)}|${JSON.stringify(o)}|${boilSeed(o, T)}`;
  function mark(name, polysFn, args, p, o) { const G = memo(keyOf(name, args, o), () => marker(polysFn(), o, T)); return drawPlan(G, p, o.col || S.ink, G.lw); }
  const drawOn = (path, p, o = {}) => mark('path', () => polylines(path), [path], p, o);
  const arrow = (a, b, p, o = {}) => mark('arrow', () => arrowPolys(a, b, o), [a, b], p, o);
  const ring = (box, p, o = {}) => mark('ring', () => ringPolys(boxOf(box), o), [boxOf(box)], p, o);
  const underline = (x0, x1, y, p, o = {}) => mark('ul', () => underlinePolys(x0, x1, y, o), [x0, x1, y], p, o);
  const strike = (box, p, o = {}) => mark('strike', () => strikePolys(boxOf(box), o), [boxOf(box)], p, o);
  const tick = (x, y, s, p, o = {}) => mark('tick', () => tickPolys(x, y, s), [x, y, s], p, o);
  const cross = (x, y, s, p, o = {}) => mark('cross', () => crossPolys(x, y, s), [x, y, s], p, o);

  // ---------- paper props ----------
  // highlight(box, p, o): a chisel-tipped highlighter swipe over a box, left to right, multiplied (ink stays dark).
  // o: col, wash (opacity, default S.hlA), h (band height), at (0..1 down the box), pad, seed
  const hlGeom = (box, o = {}) => { const [x, y, w, h] = boxOf(box), hh = o.h ?? h * .62; return { hh, yc: y + h * (o.at ?? .5), x0: x - (o.pad ?? 12), x1: x + w + (o.pad ?? 12), sk: hh * .32 }; };
  function highlight(box, p, o = {}) {
    if (p <= 0) return; const { hh, yc, x0, x1, sk } = hlGeom(box, o), xe = lerp(x0, x1, clamp(p)), seed = o.seed ?? 4;
    const top = [], bot = []; for (let i = 0; i <= 24; i++) { const xx = lerp(x0, xe, i / 24); top.push([xx + sk, yc - hh / 2 + 1.8 * noise(xx / 60, seed)]); bot.push([xx, yc + hh / 2 + 1.8 * noise(xx / 60, seed + 3)]); }
    CX.save(); CX.globalCompositeOperation = 'multiply'; CX.globalAlpha *= o.wash ?? S.hlA; CX.fillStyle = o.col || S.hl;
    CX.beginPath(); top.forEach(([px, py], i) => i ? CX.lineTo(px, py) : CX.moveTo(px, py)); for (let i = bot.length - 1; i >= 0; i--) CX.lineTo(bot[i][0], bot[i][1]); CX.closePath(); CX.fill();
    CX.restore();
  }
  // sticky(x, y, w, h, k, o): a square note centred at (x, y) that slaps onto the page: k is time since it was
  // thrown (s), it lands on a quick spring with a little squash; its bottom edge curls up. o: rot (deg), col, lines
  // (text written on it, in the hand), size, ink, id
  const STICK = { stiffness: 380, damping: 19, mass: 1 };
  function sticky(x, y, w, h, k, o = {}) {
    if (k < 0) return; const s = springStep(k, STICK), lift = 1 - clamp(s), a = clamp(k / .06), sc = 1 + .16 * (1 - s), rot = ((o.rot ?? -3) + 7 * (1 - s)) * RAD;
    CX.save(); CX.translate(x, y - 26 * lift); CX.rotate(rot); CX.scale(sc, sc); CX.globalAlpha *= a;
    const col = o.col || S.sticky, curl = h * .035;
    const body = () => { CX.beginPath(); CX.moveTo(-w / 2, -h / 2); CX.lineTo(w / 2, -h / 2); CX.lineTo(w / 2, h / 2 - curl); CX.quadraticCurveTo(0, h / 2 + curl * .6, -w / 2, h / 2 - curl * .4); CX.closePath(); };
    CX.save(); CX.shadowColor = `rgba(70,52,24,${(.22 + .12 * lift).toFixed(3)})`; CX.shadowBlur = 10 + 40 * lift; CX.shadowOffsetX = 2 + 12 * lift; CX.shadowOffsetY = 7 + 28 * lift;
    body(); CX.fillStyle = col; CX.fill(); CX.restore();
    // shading: the glued band at the top a shade darker, the free end lit as it lifts off the page
    CX.save(); body(); CX.clip(); const g = CX.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(120,90,40,.10)'); g.addColorStop(.2, 'rgba(120,90,40,.10)'); g.addColorStop(.22, 'rgba(255,255,255,0)'); g.addColorStop(.8, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(90,64,24,.10)');
    CX.fillStyle = g; CX.fillRect(-w / 2, -h / 2, w, h + curl); CX.restore();
    if (o.lines) { const sz = o.size || h * .17, n = o.lines.length, y0 = -((n - 1) * sz * 1.3) / 2 + sz * .3;
      o.lines.forEach((ln, i) => write(o.id != null ? `${o.id}:${i}` : (o.id === null ? null : `sticky:${ln}`), ln, 0, y0 + i * sz * 1.3, 1, { size: sz, align: 'center', col: o.ink || S.ink, seed: i + 11, slant: .1 })); }
    CX.restore();
  }
  // tape(x, y, w, k, o): a strip of paper tape laid from its left end over k (0..1), torn ends; o: rot, h, col
  function tape(x, y, w, k, o = {}) {
    if (k <= 0) return; const h = o.h ?? 40, L = w * EASE.outExpo(clamp(k)), seed = o.seed ?? 9, r = rnd(seed), teeth = Math.max(4, Math.round(h / 7));
    CX.save(); CX.translate(x, y); CX.rotate((o.rot ?? -4) * RAD); CX.globalCompositeOperation = 'multiply'; CX.globalAlpha *= .85;
    CX.beginPath(); const x0 = -w / 2, x1 = x0 + L;
    for (let i = 0; i <= teeth; i++) CX.lineTo(x0 + (i % 2 ? 3 : -1) * (.6 + r() * .6), -h / 2 + h * i / teeth);
    for (let i = teeth; i >= 0; i--) CX.lineTo(x1 + (i % 2 ? -3 : 1) * (.6 + r() * .6) * clamp(k * 3), -h / 2 + h * i / teeth);
    CX.closePath(); CX.fillStyle = o.col || S.tape; CX.fill();
    CX.globalCompositeOperation = 'source-over'; CX.globalAlpha *= .5; CX.fillStyle = 'rgba(255,255,255,.35)'; CX.fillRect(x0, -h / 2 + 2, L, 2); CX.restore();
  }
  // clip(x, y, s, ang, o): a steel paperclip of length s centred on (x, y), rotated ang radians
  function clip(x, y, s, ang = 0, o = {}) {
    const P_ = 'M 0.30,-0.115 L 0.86,-0.115 A 0.86,0 0.115,0.115 -90,90 L 0.13,0.115 A 0.13,0.04 0.075,0.075 90,270 L 0.76,-0.035 A 0.76,0 0.035,0.035 -90,90 L 0.36,0.035';
    const pl = memo(`clip|${P_}`, () => parse(P_, .01)[0]);
    CX.save(); CX.translate(x, y); CX.rotate(ang); CX.scale(s, s); CX.translate(-.5, 0);
    CX.beginPath(); pl.forEach(([px, py], i) => i ? CX.lineTo(px, py) : CX.moveTo(px, py));
    CX.lineCap = 'round'; CX.lineJoin = 'round';
    CX.shadowColor = 'rgba(40,40,50,.28)'; CX.shadowBlur = 6; CX.shadowOffsetY = 3;
    CX.lineWidth = .06; CX.strokeStyle = o.col || S.steel; CX.stroke(); CX.shadowColor = 'transparent';
    CX.lineWidth = .018; CX.strokeStyle = 'rgba(255,255,255,.75)'; CX.translate(-.006, -.01); CX.stroke(); CX.restore();
  }

  // ---------- the protagonist and its onion skin ----------
  // plane(x, y, ang, s, o): a paper plane (three-quarter side view) of length s, nose along ang (radians). o: col,
  // ghost (outline only, for onion skins), lw, alpha, k (0..1 grow-in)
  // a slim dart seen from the side and a little below: the far wing (shaded) above the long centre fold, the near
  // wing (lit) below it, the two meeting at the nose. Pointing steeply up or down it narrows (S.planeThin), so it
  // never reads as a cursor arrow or a wedge.
  const PLANE = { n: [.5, 0], t: [-.5, 0], f: [-.47, -.11], w: [-.40, .19] };
  const thin = ang => 1 - (S.planeThin ?? .28) * Math.abs(Math.sin(ang));
  // the plane's four corners in world px (nose, tail, far wing, near wing): for contact tests (a touchdown)
  const planePts = (x, y, ang, s) => { const c = Math.cos(ang), sn = Math.sin(ang), th = thin(ang);
    return [PLANE.n, PLANE.t, PLANE.f, PLANE.w].map(([px, py]) => [x + (px * c - py * th * sn) * s, y + (px * sn + py * th * c) * s]); };
  function plane(x, y, ang, s, o = {}) {
    const k = o.k ?? 1; if (k <= 0) return; const [n, t, f, w] = planePts(x, y, ang, s * k);   // world px, so lines keep their weight
    CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha; CX.lineJoin = 'round';
    const poly = (...p) => { CX.beginPath(); p.forEach((q, i) => i ? CX.lineTo(...q) : CX.moveTo(...q)); CX.closePath(); };
    if (o.ghost) { CX.lineWidth = o.lw || 2; CX.strokeStyle = o.col || S.ink; if (o.dash !== false) CX.setLineDash([7, 6]); poly(f, n, w, t); CX.stroke(); }
    else { const col = o.col || S.blue, u = s * k, at = (a, b, q) => [lerp(a[0], b[0], q), lerp(a[1], b[1], q)];
      poly(n, f, t); CX.fillStyle = mixCol(col, '#0B1640', .32); CX.fill();
      poly(n, t, w); CX.fillStyle = mixCol(col, '#FFFFFF', .08); CX.fill();
      CX.lineCap = 'round'; CX.lineWidth = Math.max(1, u * .014); CX.strokeStyle = 'rgba(255,255,255,.62)'; CX.beginPath(); CX.moveTo(...n); CX.lineTo(...t); CX.stroke();
      CX.lineWidth = Math.max(.8, u * .009); CX.strokeStyle = 'rgba(255,255,255,.22)'; CX.beginPath(); CX.moveTo(...at(n, t, .04)); CX.lineTo(...at(t, w, .55)); CX.stroke(); }
    CX.restore();
  }
  // the plane as pen strokes, for drawing it on before it comes alive: the outline in one stroke from the nose, then the fold
  const planeOutline = (x, y, ang, s) => { const [n, t, f, w] = planePts(x, y, ang, s); return [[n, f, t, w, n], [n, t]]; };
  // route(points, o): a smooth path through points (Catmull-Rom); returns pose(u) -> { x, y, a } by arc length (u 0..1)
  function route(points) {
    const pts = [], n = points.length;
    for (let i = 0; i < n - 1; i++) { const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
      for (let j = 0; j < 24; j++) { const u = j / 24, u2 = u * u, u3 = u2 * u;
        const f = (a, b, c, d) => .5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
    pts.push(points[n - 1].slice());
    const L = lengths(pts), len = L[L.length - 1], st = { pts, L, len };
    const pose = u => { const s = len * clamp(u), e = pointAt(st, s), a = pointAt(st, Math.max(0, s - 2)).p, b = pointAt(st, Math.min(len, s + 2)).p; return { x: e.p[0], y: e.p[1], a: Math.atan2(b[1] - a[1], b[0] - a[0]) }; };
    return { pose, len, pts };
  }
  // retrace(poseAt, from, to, o) -> u => pose: a move replayed at an even speed along its own path, from time `from` to
  // time `to` (to < from plays it backwards: a rewind). Playing a pose function backwards in time keeps its speed
  // changes: a stall becomes a hang and a dive a jump. This re-times it by distance, so u (0..1, eased by the caller)
  // is the fraction of the way travelled. o.turn: px a radian of turning counts as (default 60), so a pivot in place
  // takes time; o.hz: samples a second (default 240). Built once per pose function: a pure function of u.
  function retrace(poseAt, from, to, o = {}) {
    const byFn = memo(poseAt, () => new Map()), key = `${from}|${to}|${o.turn ?? 60}|${o.hz ?? 240}`;
    if (!byFn.has(key)) {
      const n = Math.max(2, Math.ceil(Math.abs(to - from) * (o.hz ?? 240))), turn = o.turn ?? 60, P_ = [], D = [0];
      for (let i = 0; i <= n; i++) { const q = poseAt(lerp(from, to, i / n)); if (i) { const p = P_[i - 1]; let a = q.a; while (a - p.a > Math.PI) a -= TAU; while (a - p.a < -Math.PI) a += TAU;
          P_.push({ ...q, a }); D.push(D[i - 1] + Math.hypot(q.x - p.x, q.y - p.y) + turn * Math.abs(a - p.a)); } else P_.push({ ...q }); }
      byFn.set(key, { P: P_, D, len: D[n] });
    }
    const R = byFn.get(key), at = u => { const s = R.len * clamp(u); let lo = 0, hi = R.D.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R.D[m] < s) lo = m; else hi = m; }
      const k = (s - R.D[lo]) / ((R.D[hi] - R.D[lo]) || 1), a = R.P[lo], b = R.P[hi]; return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), a: lerp(a.a, b.a, k) }; };
    at.len = R.len; return at;
  }
  // cruise(x, r): an easing that speeds up over the first r of the time, holds a steady speed, and brakes over the last r
  // (peak speed 1 / (1 - r) of the average, against about 2.9 for EASE.inOut): for long moves at an even pace, a rewind
  const cruise = (x, r = .22) => { x = clamp(x); const v = 1 / (1 - r);
    return x < r ? v * x * x / (2 * r) : x > 1 - r ? 1 - v * (1 - x) ** 2 / (2 * r) : v * (x - r / 2); };
  // trail(t, poseAt, o): an onion skin that stays on the page as the record of a move. Ghost j stands at the pose at
  // from + j * every, drawn once that time has passed (and not after `to`), fresh ghosts darker, fading to a resting
  // alpha: a pure function of t. o: from, to, every, draw(pose, alpha, j), dots (a dotted path, px apart), col, rest
  // (resting alpha), fresh, fade (s), minGap (px: skip a ghost closer than this to the last one drawn), n (keep only the
  // last n ghosts: a moving onion skin rather than a record)
  function trail(t, poseAt, o = {}) {
    const from = o.from ?? 0, to = o.to ?? Infinity, every = o.every ?? .1, end = Math.min(t, to); if (end <= from) return;
    if (o.dots) { const byFn = memo(poseAt, () => new Map()), key = `${from}|${to}|${o.dots}`; if (!byFn.has(key)) byFn.set(key, (() => { const out = []; let last = null, acc = 0;
        for (let tt = from; tt <= (to === Infinity ? from + 30 : to) + 1e-9; tt += 1 / 240) { const q = poseAt(tt); if (!q) continue; if (last) acc += Math.hypot(q.x - last.x, q.y - last.y);
          if (!last || acc >= o.dots) { out.push([q.x, q.y, tt]); acc = 0; } last = q; } return out; })()); const pts = byFn.get(key);
      CX.save(); CX.globalCompositeOperation = 'multiply'; CX.fillStyle = o.col || S.ink; CX.globalAlpha *= o.dotA ?? .4;
      for (const [x, y, tt] of pts) { if (tt > end - .03) break; CX.beginPath(); CX.arc(x, y, o.dotR ?? 2.2, 0, TAU); CX.fill(); } CX.restore(); }
    const jmax = Math.floor((end - from) / every + 1e-6); let last = null;
    for (let j = o.n ? Math.max(0, jmax - o.n) : 0; j <= jmax; j++) {
      const tj = from + j * every, age = t - tj, q = poseAt(tj); if (!q) continue;
      if (o.minGap && last && Math.hypot(q.x - last.x, q.y - last.y) < o.minGap) continue;   // thin a bunch (a stall) to a readable few
      last = q; if (age < every * .6) continue;
      const a = lerp(o.rest ?? .28, o.fresh ?? .7, Math.exp(-age / (o.fade ?? .35))) * (o.n ? clamp(1 - (jmax - j) / o.n) : 1);
      o.draw ? o.draw(q, a, j) : plane(q.x, q.y, q.a, o.s ?? 120, { ghost: true, alpha: a, col: o.col || S.ink, lw: o.lw || 2, dash: o.dash });
    }
  }

  // ---------- the pen ----------
  // pen(x, y, o): a felt-tip marker whose nib is at (x, y), leaning right as a right hand holds it. o: col (the ink;
  // the cap shows it), lift (0 on the paper, 1 hovering), len, ang
  function pen(x, y, o = {}) {
    const L = o.len ?? S.penLen, lift = o.lift ?? 0, col = o.col || S.ink, ang = (o.ang ?? -58) * RAD, w = L * .1;
    CX.save(); CX.translate(x, y); CX.rotate(ang); const sc = 1 + .05 * lift; CX.scale(sc, sc);
    CX.save(); CX.shadowColor = `rgba(40,32,20,${(.22 - .06 * lift).toFixed(3)})`; CX.shadowBlur = 10 + 26 * lift; CX.shadowOffsetX = 10 + 34 * lift; CX.shadowOffsetY = 14 + 40 * lift;
    CX.beginPath(); CX.moveTo(2, 0); CX.lineTo(L * .1, -w * .26); CX.lineTo(L * .17, -w * .5); CX.lineTo(L, -w * .5); CX.lineTo(L, w * .5); CX.lineTo(L * .17, w * .5); CX.lineTo(L * .1, w * .26); CX.closePath(); CX.fillStyle = '#ECEAE4'; CX.fill(); CX.restore();
    // nib, collar, barrel (lit along its top edge), cap in the ink's colour
    CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(L * .1, -w * .22); CX.lineTo(L * .1, w * .22); CX.closePath(); CX.fillStyle = col; CX.fill();
    CX.beginPath(); CX.moveTo(L * .095, -w * .27); CX.lineTo(L * .17, -w * .5); CX.lineTo(L * .17, w * .5); CX.lineTo(L * .095, w * .27); CX.closePath(); CX.fillStyle = '#3B3E45'; CX.fill();
    const g = CX.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.45, '#EEEDE8'); g.addColorStop(1, '#C9C7C0');
    rr(L * .17, -w / 2, L * .58, w, 2); CX.fillStyle = g; CX.fill();
    rr(L * .73, -w * .54, L * .27, w * 1.08, [3, w * .3, w * .3, 3]); CX.fillStyle = col; CX.fill();
    CX.fillStyle = 'rgba(255,255,255,.22)'; CX.fillRect(L * .74, -w * .44, L * .24, w * .16);
    CX.restore();
  }
  // highlighter(x, y, o): a chisel-tip highlighter whose nib face is centred on (x, y): a fatter barrel tinted with its
  // ink, the cap in it. o: col (default S.hl), lift, len, ang
  function highlighter(x, y, o = {}) {
    const L = o.len ?? S.penLen * .96, lift = o.lift ?? 0, col = o.col || S.hl, ang = (o.ang ?? -58) * RAD, w = L * .155;
    CX.save(); CX.translate(x, y); CX.rotate(ang); const sc = 1 + .05 * lift; CX.scale(sc, sc);
    CX.save(); CX.shadowColor = `rgba(40,32,20,${(.22 - .06 * lift).toFixed(3)})`; CX.shadowBlur = 10 + 26 * lift; CX.shadowOffsetX = 10 + 34 * lift; CX.shadowOffsetY = 14 + 40 * lift;
    CX.beginPath(); CX.moveTo(-2, -w * .3); CX.lineTo(L * .13, -w * .5); CX.lineTo(L, -w * .5); CX.lineTo(L, w * .5); CX.lineTo(L * .13, w * .5); CX.lineTo(L * .03, w * .3); CX.closePath(); CX.fillStyle = '#ECEAE4'; CX.fill(); CX.restore();
    // the felt chisel (its slanted face lays the band), collar, tinted barrel, cap
    CX.beginPath(); CX.moveTo(-2, -w * .3); CX.lineTo(L * .075, -w * .32); CX.lineTo(L * .075, w * .32); CX.lineTo(L * .03, w * .3); CX.closePath(); CX.fillStyle = mixCol(col, '#FFFFFF', .25); CX.fill();
    rr(L * .07, -w * .42, L * .07, w * .84, 2); CX.fillStyle = '#3B3E45'; CX.fill();
    const g = CX.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, mixCol(col, '#FFFFFF', .78)); g.addColorStop(.45, mixCol(col, '#FFFFFF', .62)); g.addColorStop(1, mixCol(col, '#8A93A6', .5));
    rr(L * .14, -w / 2, L * .58, w, 3); CX.fillStyle = g; CX.fill();
    rr(L * .7, -w * .54, L * .3, w * 1.08, [4, w * .32, w * .32, 4]); CX.fillStyle = col; CX.fill();
    CX.fillStyle = 'rgba(255,255,255,.24)'; CX.fillRect(L * .71, -w * .44, L * .27, w * .15);
    CX.restore();
  }

  // ---------- paper ----------
  let _tile = null, _fibre = null;
  function tiles() {
    if (_tile) return; const gap = S.gap, k = 2, c = document.createElement('canvas'); c.width = c.height = gap * k; const g = c.getContext('2d');
    g.fillStyle = rgba(S.gridCol, S.gridA); g.strokeStyle = rgba(S.gridCol, S.gridA * .7); g.lineWidth = k;
    if (S.grid === 'dots') { g.beginPath(); g.arc(gap * k / 2, gap * k / 2, 1.7 * k, 0, TAU); g.fill(); }
    else if (S.grid === 'squares') { g.strokeRect(0, 0, gap * k, gap * k); }
    else if (S.grid === 'lines') { g.beginPath(); g.moveTo(0, gap * k - 1); g.lineTo(gap * k, gap * k - 1); g.stroke(); }
    _tile = c;
    // fibres and faint mottling on a seamless tile: anything near an edge is drawn again on the far side
    const f = document.createElement('canvas'), N = 512; f.width = f.height = N; const x = f.getContext('2d'), r = rnd(77), wrap = (px, py, pad, fn) => {
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) if (px + ox > -pad && px + ox < N + pad && py + oy > -pad && py + oy < N + pad) fn(px + ox, py + oy); };
    x.fillStyle = '#fff'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 90; i++) { const px = r() * N, py = r() * N, rad = 30 + r() * 80, a = (.006 + r() * .01).toFixed(3);
      wrap(px, py, rad, (qx, qy) => { const gr = x.createRadialGradient(qx, qy, 0, qx, qy, rad); gr.addColorStop(0, `rgba(150,125,85,${a})`); gr.addColorStop(1, 'rgba(150,125,85,0)'); x.fillStyle = gr; x.fillRect(qx - rad, qy - rad, rad * 2, rad * 2); }); }
    for (let i = 0; i < 2200; i++) { const px = r() * N, py = r() * N, a = r() * Math.PI, l = 4 + r() * 16, al = (.02 + r() * .045).toFixed(3), lw = .6 + r() * .8, j1 = (r() - .5) * 3, j2 = (r() - .5) * 3;
      wrap(px, py, 20, (qx, qy) => { x.strokeStyle = `rgba(120,100,70,${al})`; x.lineWidth = lw; x.beginPath(); x.moveTo(qx, qy);
        x.quadraticCurveTo(qx + Math.cos(a) * l * .5 + j1, qy + Math.sin(a) * l * .5 + j2, qx + Math.cos(a) * l, qy + Math.sin(a) * l); x.stroke(); }); }
    _fibre = f;
  }
  // paper(view): the page under the camera view { cx, cy, z }: the grid and fibres are fixed to the paper
  function paper(view = { cx: W / 2, cy: H / 2, z: 1 }) {
    tiles(); bg(S.paper); const { cx, cy, z } = view, x0 = cx - W / 2 / z, y0 = cy - H / 2 / z, w = W / z, h = H / z;
    CX.save(); cam(cx, cy, z);
    if (S.fibre) { CX.save(); CX.globalCompositeOperation = 'multiply'; CX.globalAlpha = S.fibre; const pf = CX.createPattern(_fibre, 'repeat'); CX.fillStyle = pf; CX.fillRect(x0, y0, w, h); CX.restore(); }
    if (S.grid !== 'none') { const pt = CX.createPattern(_tile, 'repeat'); pt.setTransform(new DOMMatrix().scale(.5, .5)); CX.fillStyle = pt; CX.globalCompositeOperation = 'multiply'; CX.fillRect(x0, y0, w, h); }
    if (S.margin != null) { CX.globalCompositeOperation = 'multiply'; CX.strokeStyle = rgba(S.red, .45); CX.lineWidth = 2; CX.beginPath(); CX.moveTo(S.margin, y0); CX.lineTo(S.margin, y0 + h); CX.stroke(); }
    CX.restore();
  }

  // ---------- the page: a declarative film ----------
  // MARKS: { kind, t, ... } in z order. Pen kinds take dur (s; default from length at S.speed px/s, or from cps for
  // write), col, lw, seed, boil:
  //   write { id, str, x, y, size, align, rot, cps }   path { d | pts }   arrow { from, to, bend, head }
  //   ring { box | of }   underline { x0, x1, y, double } | { of }   strike { box | of, scribble }   tick / cross { x, y, s }
  // Other kinds: highlight { box | of, dur }   sticky { x, y, w, h, rot, lines, size }   tape { x, y, w, rot, dur }
  //   type { id, str, x, y, size, dur } (typeset, wiped on)   draw { fn(t) } (anything else: the protagonist, a plot)
  // `of` points at a write mark: the shape is fitted to its box. `out` (s) fades a mark to `outTo` (default 0) over `outDur`;
  // `alpha` scales any mark; `pen: false` draws a pen kind without the pen (a mark already on the page: give it t: -1).
  const PENK = new Set(['write', 'path', 'arrow', 'ring', 'underline', 'strike', 'tick', 'cross']);
  function geomOf(m, i, t) {
    const o = { col: m.col, lw: m.lw, seed: m.seed ?? i * 7.3 + 1, amp: m.amp, wl: m.wl, boil: m.boil, boilFps: m.boilFps };
    const build = () => {
      const box = () => { const b = m.of ? geomOf(m.of, -1, t).box : boxOf(m.box); return b; };
      switch (m.kind) {
        case 'write': return handGeom(m.str, m.x, m.y, { size: m.size, align: m.align, rot: m.rot, slant: m.slant, track: m.track, lead: m.lead, lw: m.lw, seed: m.seed ?? 3, col: m.col, boil: m.boil, jitter: m.jitter, press: m.press }, t);
        case 'path': return marker(polylines(m.d || m.pts), o, t);
        case 'arrow': return marker(arrowPolys(m.from, m.to, m), o, t);
        case 'ring': return marker(ringPolys(box(), m), o, t);
        case 'underline': { if (m.of) { const [x, y, w, h] = box(); return marker(underlinePolys(x - 6, x + w + 10, y + h * (m.at ?? .78), m), o, t); } return marker(underlinePolys(m.x0, m.x1, m.y, m), o, t); }
        case 'strike': return marker(strikePolys(box(), m), o, t);
        case 'tick': return marker(tickPolys(m.x, m.y, m.s ?? 40), o, t);
        case 'cross': return marker(crossPolys(m.x, m.y, m.s ?? 40), o, t);
      }
    };
    if (m.boil || S.boil) { const per = memo(m, () => new Map()), k = boilSeed(m, t); if (!per.has(k)) { if (per.size > 48) per.clear(); per.set(k, build()); } return per.get(k); }   // one geometry per boil step, per mark
    return memo(m, build);
  }
  function durOf(m, i) {
    if (m.dur != null) return m.dur;
    if (m.kind === 'write') return Math.max(.3, geomOf(m, i, 0).n / (m.cps || S.cps));
    if (PENK.has(m.kind)) return clamp(geomOf(m, i, 0).tot / (m.speed || S.speed), .16, 1.4);
    return { highlight: .32, tape: .2, type: .8 }[m.kind] ?? 0;
  }
  // the hand's schedule: one tool glides between marks (like kit.js cursor()) and leaves the frame in long gaps: the pen
  // for pen marks, the highlighter for highlights (`pen: false` on a mark leaves it out). A hand-off takes time: a mark
  // that starts sooner than minGlide(d) after the last one ends (d: the px the tool travels; .2 s at the least) is inked
  // late by the shortfall, with a console warning naming it. Space the marks instead: the warning is a timing bug.
  const minGlide = d => Math.max(.2, .1 + d / 2500);
  function penPlan(marks) {
    return memo(marks, () => {
      const PL = marks.map((m, i) => ({ m, i })).filter(({ m }) => (PENK.has(m.kind) || m.kind === 'highlight') && m.pen !== false).map(({ m, i }) => {
        const d = durOf(m, i);
        if (m.kind === 'highlight') { const g = hlGeom(m.of ? geomOf(m.of, -1, 0).box : m.box, m); return { m, i, t0: m.t, t1: m.t + d, a: [g.x0 + g.sk / 2, g.yc], b: [g.x1 + g.sk / 2, g.yc], col: m.col || S.hl, tool: 'hl', g }; }
        const G = geomOf(m, i, 0); return { m, i, t0: m.t, t1: m.t + d, a: G.a, b: G.b, col: m.col || S.ink, tool: 'pen' };
      }).sort((p, q) => p.t0 - q.t0);
      for (let j = 1; j < PL.length; j++) { const p = PL[j - 1], q = PL[j], d = Math.hypot(q.a[0] - p.b[0], q.a[1] - p.b[1]), need = minGlide(d), gap = q.t0 - p.t1;
        if (gap < need - 1e-6) { const late = need - gap; q.t0 += late; q.t1 += late;
          console.warn(`notebook: mark ${q.i} (${q.m.kind}${q.m.str ? ` "${q.m.str}"` : ''}) starts ${gap.toFixed(2)} s after mark ${p.i} ends, but the hand needs ${need.toFixed(2)} s to travel ${Math.round(d)} px: inked ${late.toFixed(2)} s late`); } }
      PL.at = new Map(PL.map(p => [p.i, p]));
      return PL;
    });
  }
  // where the hand is at t: { x, y, lift, col, tool } (tool 'pen' or 'hl'), or null when it is out of frame. Between two
  // tools it is both, cross-faded while lifted: { ..., tool, tool2, mix, col2 }. rest: where it waits off the page, a
  // point or a function of the mark's end point it is leaving or reaching.
  function penAt(t, PL, rest, o = {}) {
    if (!PL.length) return null; const LONG = o.long ?? 1.4, R = typeof rest === 'function' ? rest : () => rest;
    let k = -1; for (let i = 0; i < PL.length; i++) if (PL[i].t0 <= t) k = i;
    const cur = k >= 0 ? PL[k] : null;
    if (cur && t <= cur.t1) { const u = (t - cur.t0) / (cur.t1 - cur.t0);
      if (cur.tool === 'hl') { const g = cur.g; return { x: lerp(g.x0, g.x1, HL_EASE(u)) + g.sk / 2, y: g.yc, lift: 0, col: cur.col, tool: 'hl' }; }
      const G = geomOf(cur.m, cur.i, t), r = tipOf(G, u); return { x: r.tip[0], y: r.tip[1], lift: r.lift * .7, col: cur.col, tool: 'pen' }; }
    const next = PL[k + 1] || null, ta = cur ? cur.t1 : -Infinity, tb = next ? next.t0 : Infinity, from = cur ? cur.b : null, to = next ? next.a : null;
    const hover = Math.min(cur ? seg(t, ta, ta + .1) : 1, next ? 1 - seg(t, tb - .08, tb) : 1);
    const glide = (A, B, a, b, P, Q) => { const u = EASE.glide(seg(t, a, b)), dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1, bulge = Math.sin(Math.PI * u) * Math.min(60, d * .1);
      const x = lerp(A[0], B[0], u) - dy / d * bulge, y = lerp(A[1], B[1], u) + dx / d * bulge, m = ease(seg(seg(t, a, b), .2, .8));   // a change of tool or ink happens in the air, over the middle of the glide's time
      if (P.tool !== Q.tool || P.col !== Q.col) return { x, y, lift: hover, col: P.col, tool: P.tool, tool2: Q.tool, col2: Q.col, mix: m };   // a swap
      return { x, y, lift: hover, col: mixCol(P.col, Q.col, m), tool: P.tool }; };
    if (tb - ta <= LONG) { const lead = Math.min(.5, (tb - ta) * .85); return glide(from, to, tb - lead, tb, cur, next); }
    if (cur && t < ta + .6) return glide(from, R(from), ta + .05, ta + .6, cur, cur);
    if (next && t > tb - .55) return glide(R(to), to, tb - .55, tb, next, next);
    return null;
  }
  // draw the hand's tool from penAt(). A swap (another tool or another ink) lifts the old tool away along its barrel as
  // the new one comes down the same way, so a change of pen reads as a change of pen, not a cap changing colour.
  function hand(q, t) {
    const ang = -58 + 4 * noise(t * .8, 3), ux = Math.cos(ang * RAD), uy = Math.sin(ang * RAD);
    const one = (tool, col, a, off) => { if (a <= 0) return; CX.save(); CX.globalAlpha *= a; (tool === 'hl' ? highlighter : pen)(q.x + ux * off, q.y + uy * off, { lift: q.lift, col, ang }); CX.restore(); };
    if (q.tool2) { const m = q.mix; one(q.tool, q.col, clamp(1 - m * 1.4), 90 * ease(m)); one(q.tool2, q.col2, clamp(m * 1.4 - .4), 90 * ease(1 - m)); } else one(q.tool, q.col, 1, 0);
  }
  // page(t, marks, o): the whole frame. o: cam (follow() keys [[t, [cx, cy, zoom]], ...]), camSpring, pen (false
  // hides it), before(t, view) / after(t, view) (draw in world space under or over the marks)
  const CAMSPRING = { stiffness: 42, damping: 13, mass: 1 }, HL_EASE = bezier(.3, 0, .2, 1);
  function view(t, o = {}) {
    if (!o.cam) return { cx: W / 2, cy: H / 2, z: 1 };
    const [cx, cy, lz] = follow(t, o.cam.map(([tt, [x, y, z], sp]) => [tt, [x, y, Math.log(z)], sp]), o.camSpring || CAMSPRING); return { cx, cy, z: Math.exp(lz) };
  }
  function page(t, marks, o = {}) {
    const V = view(t, o); paper(V);
    CX.save(); cam(V.cx, V.cy, V.z);
    if (o.before) o.before(t, V);
    const PL = penPlan(marks);
    marks.forEach((m, i) => {
      const pe = PL.at.get(i), t0 = pe ? pe.t0 : m.t;   // a hand-drawn mark starts when the hand gets there
      if (t < t0) return; const fade = m.out != null ? lerp(1, m.outTo ?? 0, ease(seg(t, m.out, m.out + (m.outDur ?? .3)))) : 1; if (fade <= 0) return;
      CX.save(); CX.globalAlpha *= fade * (m.alpha ?? 1);
      if (PENK.has(m.kind)) {
        const d = durOf(m, i), u = d > 0 ? clamp((t - t0) / d) : 1, G = geomOf(m, i, t);
        drawPlan(G, u, m.col || S.ink, G.lw);
        if (m.kind === 'write' && m.id !== null && u >= .9) register(m.id ?? m.str, m.str, G.corners, CX.globalAlpha, G.size);
      } else if (m.kind === 'highlight') { const d = durOf(m, i); highlight(m.of ? geomOf(m.of, -1, t).box : m.box, HL_EASE(seg(t, t0, t0 + d)), m); }
      else if (m.kind === 'sticky') sticky(m.x, m.y, m.w ?? 280, m.h ?? 260, t - m.t, m);
      else if (m.kind === 'tape') tape(m.x, m.y, m.w ?? 160, seg(t, m.t, m.t + durOf(m, i)), m);
      else if (m.kind === 'type') typeOn(m.id, m.str, m.x, m.y, seg(t, m.t, m.t + durOf(m, i)), m);
      else if (m.kind === 'draw') m.fn(t, m);
      CX.restore();
    });
    if (o.after) o.after(t, V);
    // in a long gap the hand leaves along its own barrel (up and to the right), the shortest way off the page, and comes
    // back the same way, so it never sweeps across the notes
    if (o.pen !== false && S.pen) { const ux = Math.cos(-58 * RAD), uy = Math.sin(-58 * RAD), x1 = V.cx + W / 2 / V.z, y0 = V.cy - H / 2 / V.z;
      const rest = ([x, y]) => { const s = Math.max(0, Math.min((x1 - x) / ux, (y - y0) / -uy)) + 60 / V.z; return [x + ux * s, y + uy * s]; };
      const q = penAt(t, PL, rest, o); if (q) hand(q, t); }
    CX.restore();
    if (S.vignette) vignette(S.vignette, '#4A3A22');
    return V;
  }
  // a write mark's box in world px [x, y, w, h], for fitting rings, strikes and highlights by hand
  const boxOfWrite = m => handGeom(m.str, m.x, m.y, { size: m.size, align: m.align, rot: m.rot, slant: m.slant, track: m.track, lead: m.lead, seed: m.seed ?? 3, jitter: m.jitter }).box;

  return { S, page, view, paper, pen, highlighter, hand, penAt, penPlan, minGlide, durOf, write, typeOn, layout, drawOn, arrow, ring, underline, strike,
    tick, cross, highlight, sticky, tape, clip, plane, planePts, PLANE, planeOutline, route, retrace, cruise, trail, parse, polylines, boxOf: boxOfWrite, GLYPH };
})();
