// looks/swarm.js: "one generative system". Thousands of particles (strokes) carry the whole film and re-form, with no
// cuts, into a flock, a map, a network, a chart and finally a wordmark. Every particle's position is a pure function of
// t: formations are point sets sampled once (from text, shapes, lines, rectangles) plus per-point motion (a flowing
// ribbon, an orbit, a stream along a path); a morph matches every particle to a point in the next formation (median
// bisection, so each part of the old picture fills the nearest part of the new one and paths barely cross) and moves it
// there along an eased, bent path with its own delay. Streaks are the distance a particle travelled in the last
// S.trail seconds (two evaluations, no history), blended into a short idle stroke whose angle drifts on a noise field.
// Card: looks/swarm.md. Specimen: specimens/swarm.
//
// A film is a SYSTEM: SW.system(N, KEYS, { tags }) where each key is { t, land, f, stagger, bend, drift, tag, ... }: from
// t the particles leave the previous formation and by land every one has arrived in formation f (a builder function,
// called once after the fonts load, that returns SW.formation([...parts]) with exactly N points). SW.draw(t, SYS)
// draws the lot. The first `tags` particles are the through-line: they take the first points of every formation and
// are drawn in the accent colour.

const SW = (() => {
  const S = Object.assign({
    sky: ['#D9D5DC', '#F0DCC9'],      // ground gradient, top and bottom
    dusk: ['#C9C1CD', '#E8C6AE'],     // the ground by the end of the film (sky(k) mixes towards it); same as sky to hold
    ink: '#191820', accent: '#C9391B', font: 'Space Grotesk',
    blend: 'source-over',             // 'lighter' for glow on a dark ground (navy, black)
    lw: [1.3, 2.25], wide: .3,        // two line widths, and the share of particles on the wider one (reads as depth)
    alpha: [.5, .95],                 // per-particle opacity range (depth)
    trail: .028,                      // seconds of motion a streak shows
    cap: 18,                          // longest streak, px: short dashes read as birds on a pale ground; 50-80 for light
                                      // trails in glow mode
    fade: 12,                         // streaks longer than this (px) thin out in proportion, as real motion blur does
    thin: .45,                        // ink on a pale ground: fast strokes (4-20 px streaks) fade to this share of their
                                      // opacity, so crossing paths stay a haze, not a scribble; ignored when blend isn't
                                      // 'source-over' (additive light already keeps overlaps reading as light)
    tagR: 7.5, tagLw: 5, halo: 3,     // the through-line particle: dot radius, streak width, a ground-coloured ring that
                                      // keeps it apart from the swarm (0 for none)
    freeze: .28,                      // seconds a departing particle keeps its old motion, decaying, so departures don't jerk
  }, P.swarm || {});
  // the default morph curve: an ease-in-out whose peak speed is about 1.9x the mean (EASE.inOut peaks near 2.9x), so a
  // swarm in flight shows birds with short streaks rather than a sheet of long ones
  const MORPH = bezier(.4, 0, .45, 1);

  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const pts = n => ({ n, x: new Float32Array(n), y: new Float32Array(n), ang: new Float32Array(n).fill(NaN) });

  // ---------- sampling: point sets ----------
  // shares(n, [f0, f1, ...]) -> integer counts in those proportions that sum to exactly n
  function shares(n, fr) { const tot = fr.reduce((s, f) => s + f, 0), out = fr.map(f => Math.floor(n * f / tot)); let left = n - out.reduce((s, c) => s + c, 0);
    const order = fr.map((f, i) => [n * f / tot - out[i], i]).sort((a, b) => b[0] - a[0]); for (let k = 0; left > 0; k++, left--) out[order[k % fr.length][1]]++; return out; }
  // choose n of the candidate points (a flat [x, y, ...] list) with a seeded shuffle; repeats with jitter if short
  function pick(c, n, r, jit) {
    const m = c.length / 2, out = pts(n), idx = new Int32Array(m); for (let i = 0; i < m; i++) idx[i] = i;
    for (let i = 0; i < n; i++) {
      if (i < m) { const j = i + Math.floor(r() * (m - i)), k = idx[j]; idx[j] = idx[i]; idx[i] = k; out.x[i] = c[k * 2]; out.y[i] = c[k * 2 + 1]; }
      else { const k = idx[Math.floor(r() * m)]; out.x[i] = c[k * 2] + (r() - .5) * jit; out.y[i] = c[k * 2 + 1] + (r() - .5) * jit; }
    }
    return out;
  }
  let _off = null;
  function offscreen() { if (!_off) { _off = document.createElement('canvas'); _off.width = W; _off.height = H; }
    const g = _off.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = '#000'; return g; }
  // maskPoints(draw, n, o): n points spread evenly (a jittered grid) inside whatever draw(g) fills on a frame-sized
  // offscreen canvas. o.seed. The basis of textPoints and rectPoints; pass any path (a logo outline, a country).
  function maskPoints(draw, n, o = {}) {
    const g = offscreen(); draw(g);
    const d = g.getImageData(0, 0, W, H).data; let area = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) area++;
    if (!area) throw new Error('SW.maskPoints: the shape filled nothing');
    const step = Math.sqrt(area / (n * 1.12)), r = rnd(o.seed ?? 7), c = [];
    for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
      const x = gx + r() * step, y = gy + r() * step, xi = x | 0, yi = y | 0;
      if (xi < W && yi < H && d[(yi * W + xi) * 4 + 3] > 127) c.push(x, y);
    }
    return pick(c, n, r, step * .6);
  }
  // textPoints(str, n, o): points inside a line of type. o: x, y (baseline), size, family, weight, align, tracking, seed.
  // The result carries .box [x, y, w, h] (for readable()) and .font.
  function textPoints(str, n, o = {}) {
    const f = font(o.size || 240, { family: o.family || 'Fraunces', weight: o.weight || 800 }); let box = null;
    const p = maskPoints(g => { g.font = f; g.textBaseline = 'alphabetic'; if ('letterSpacing' in g) g.letterSpacing = (o.tracking || 0) + 'px';
      const m = g.measureText(str), x0 = o.align === 'left' ? o.x : o.align === 'right' ? o.x - m.width : o.x - m.width / 2;
      g.fillText(str, x0, o.y); box = [x0, o.y - m.actualBoundingBoxAscent, m.width, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent]; }, n, o);
    p.box = box; p.font = f; return p;
  }
  // charBox(str, i, o): the ink box [x, y, w, h] of character i of a line set as textPoints would set it (to perch a
  // particle on a letter, or aim a label at it)
  function charBox(str, i, o = {}) {
    const g = offscreen(); g.font = font(o.size || 240, { family: o.family || 'Fraunces', weight: o.weight || 800 }); if ('letterSpacing' in g) g.letterSpacing = (o.tracking || 0) + 'px';
    const wAll = g.measureText(str).width, x0 = o.align === 'left' ? o.x : o.align === 'right' ? o.x - wAll : o.x - wAll / 2;
    const pre = g.measureText(str.slice(0, i)).width, m = g.measureText(str[i]);
    return [x0 + pre - m.actualBoundingBoxLeft, o.y - m.actualBoundingBoxAscent, m.actualBoundingBoxLeft + m.actualBoundingBoxRight, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent];
  }
  // rectPoints([[x, y, w, h], ...], n, o): points spread evenly through rectangles (bars, blocks, a grid of cells)
  const rectPoints = (rects, n, o = {}) => maskPoints(g => rects.forEach(r => g.fillRect(r[0], r[1], r[2], r[3])), n, o);
  // linePoints(poly, n, o): points along a polyline [[x, y], ...], evenly by length, o.spread px either side (gaussian),
  // each carrying the line's direction (so still(..., { angle: 'tangent' }) draws dashes along it)
  function linePoints(poly, n, o = {}) {
    const L = [0]; for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const tot = L[L.length - 1], r = rnd(o.seed ?? 3), out = pts(n), sp = o.spread ?? 2;
    for (let i = 0; i < n; i++) {
      const want = clamp((i + .5 + (r() - .5) * (o.jitter ?? .8)) / n, 0, 1) * tot; let lo = 1, hi = poly.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (L[m] < want) lo = m + 1; else hi = m; }
      const a = poly[lo - 1], b = poly[lo], k = clamp((want - L[lo - 1]) / (L[lo] - L[lo - 1] || 1)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const off = sp * (r() + r() + r() - 1.5) * 1.15;
      out.x[i] = lerp(a[0], b[0], k) - Math.sin(ang) * off; out.y[i] = lerp(a[1], b[1], k) + Math.cos(ang) * off; out.ang[i] = ang;
    }
    return out;
  }
  // a single point (the through-line particle's seat in a formation)
  const one = (x, y) => { const p = pts(1); p.x[0] = x; p.y[0] = y; return p; };
  // polyline helpers: a quadratic arc from a to b bowed by bow (fraction of the length), as n points
  function arc(a, b, bow = .15, n = 24) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], cx = mx - dy * bow, cy = my + dx * bow;
    return Array.from({ length: n + 1 }, (_, i) => { const k = i / n, q = 1 - k; return [q * q * a[0] + 2 * q * k * cx + k * k * b[0], q * q * a[1] + 2 * q * k * cy + k * k * b[1]]; }); }

  // ---------- parts: point sets with motion ----------
  // Every part is { n, at(j, t, tRef, out) }: it writes point j's position at time t into out.x/out.y, its idle stroke
  // (out.ang radians, out.len px; len 0 for none) and its opacity out.a. tRef is the time a cyclic motion counts its
  // cycle from, so a particle's position at t and at t - trail sit on the same lap (no streak across a wrap).
  const field = (x, y, t, seed) => noise2(x * .0042, y * .0042 + t * .11, seed) * Math.PI * 1.3;
  // still(p, o): points that stay put, alive through their strokes. o.len (px), o.angle: 'field' (default: drifts on a
  // noise field), 'tangent' (along the line they were sampled from), or a number (radians; o.turn adds field drift),
  // o.jiggle (px of slow wander), o.a (opacity), o.seed
  function still(p, o = {}) {
    const len = o.len ?? 7, jig = o.jiggle ?? .6, seed = o.seed ?? 1, A = o.a ?? 1, mode = o.angle ?? 'field', turn = o.turn ?? .35;
    return { n: p.n, p, at(j, t, tRef, out) {
      const x = p.x[j], y = p.y[j];
      out.x = x + (jig ? jig * noise(t * .9 + j * .37, seed) : 0); out.y = y + (jig ? jig * noise(t * .9 + j * .53, seed + 5) : 0);
      out.ang = mode === 'field' ? field(x, y, t, seed) : mode === 'tangent' ? p.ang[j] + turn * .3 * noise(t * .5 + j * .11, seed) : mode + turn * field(x, y, t, seed) / Math.PI;
      out.len = len; out.a = A; } };
  }
  // orbit(clusters, o): roosting clusters: each { x, y, r, n } is a disc of points circling its centre (squashed by
  // o.squash for a ground plane), alternate clusters turning opposite ways at o.speed rad/s; strokes run along the orbit
  function orbit(clusters, o = {}) {
    const n = clusters.reduce((s, c) => s + c.n, 0), cx = new Float32Array(n), cy = new Float32Array(n), rr_ = new Float32Array(n), ph = new Float32Array(n), w = new Float32Array(n), r = rnd(o.seed ?? 5);
    const sq = o.squash ?? .62, len = o.len ?? 7; let k = 0;
    clusters.forEach((c, ci) => { for (let j = 0; j < c.n; j++, k++) {
      cx[k] = c.x; cy[k] = c.y; rr_[k] = c.r * Math.min(1.6, Math.sqrt(-2 * Math.log(1 - r() * .985)) * .62); ph[k] = r() * TAU;
      w[k] = (ci % 2 ? -1 : 1) * (o.speed ?? .55) * (.75 + .5 * r()) * (1 + .7 * clamp(1 - rr_[k] / c.r)); } });
    return { n, at(j, t, tRef, out) { const a = ph[j] + w[j] * t, c = Math.cos(a), s = Math.sin(a);
      out.x = cx[j] + rr_[j] * c; out.y = cy[j] + rr_[j] * s * sq; out.ang = Math.atan2(c * sq * Math.sign(w[j]), -s * Math.sign(w[j])); out.len = len; out.a = 1; } };
  }
  // stream(paths, o): particles flowing along polylines, each { pts, n }, at o.speed px/s, o.spread px either side,
  // fading in at the start of the path and out at its end (birds commuting between two nodes, data along an edge)
  function stream(paths, o = {}) {
    if (paths.length > 65535) throw new Error(`SW.stream: ${paths.length} paths; at most 65,535`);
    const n = paths.reduce((s, q) => s + q.n, 0), path = new Uint16Array(n), ph0 = new Float32Array(n), off = new Float32Array(n), sp = new Float32Array(n), r = rnd(o.seed ?? 9);
    const P_ = paths.map(q => { const L = [0]; for (let i = 1; i < q.pts.length; i++) L.push(L[i - 1] + Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1])); return { pts: q.pts, L, len: L[L.length - 1] }; });
    let k = 0; paths.forEach((q, pi) => { for (let j = 0; j < q.n; j++, k++) { path[k] = pi; ph0[k] = (j + r()) / q.n; off[k] = (o.spread ?? 4) * (r() + r() - 1) * 1.4; sp[k] = (o.speed ?? 110) * (.85 + .3 * r()) / P_[pi].len; } });
    const len = o.len ?? 8;
    return { n, at(j, t, tRef, out) {
      const q = P_[path[j]], ph = ph0[j] + sp[j] * t, cyc = Math.floor(ph0[j] + sp[j] * tRef), u = clamp(ph - cyc), want = u * q.len;
      let i = 1; while (i < q.pts.length - 1 && q.L[i] < want) i++;
      const a = q.pts[i - 1], b = q.pts[i], kk = clamp((want - q.L[i - 1]) / (q.L[i] - q.L[i - 1] || 1)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      out.x = lerp(a[0], b[0], kk) - Math.sin(ang) * off[j]; out.y = lerp(a[1], b[1], kk) + Math.cos(ang) * off[j];
      out.ang = ang; out.len = len; out.a = sstep(0, .1, u) * (1 - sstep(.86, 1, u)); } };
  }
  // ribbon(n, o): the murmuration. A sheet of particles flowing along a long ribbon whose centreline carries two
  // travelling waves, whose width bulges and which twists (pinching to a dark seam where it turns edge-on), all
  // functions of t. Particles enter at the tail and fade out at the head. o: cx, cy, len, amp, width, speed (ribbon
  // lengths a second), angle, drift (px the whole flock wanders), pins: [[u, v, speedFactor], ...] for the first points
  // (a through-line particle), seed. A pinned point starts at u (0 tail .. 1 head) and v (-1..1 across) and advances
  // at speed * speedFactor, but never wraps: it stops at u = .85, short of the head's fade, and rides there however
  // long the formation holds. o.width: the sheet's half-width (230-260 reads as a flock at feed size; thinner reads
  // as a brush mark); o.lobe: how much fatter the drifting lobe is (default .5); o.lobePhase: where it starts.
  function ribbon(n, o = {}) {
    const r = rnd(o.seed ?? 21), u0 = new Float32Array(n), v = new Float32Array(n), spd = new Float32Array(n), jx = new Float32Array(n);
    const L = o.len ?? 1000, A1 = o.amp ?? 120, A2 = A1 * .36, Wd = o.width ?? 260, sp = o.speed ?? .2, pins = o.pins || [], fold = o.fold ?? 60, np = pins.length, lobeK = o.lobe ?? .5, lobePh = o.lobePhase ?? 0;
    for (let i = 0; i < n; i++) { u0[i] = (i + r()) / n; const a = r() * 2 - 1, b = r() + r() - 1; v[i] = r() < (o.stray ?? .03) ? (r() * 2 - 1) * 1.55 : lerp(a, b, .5); spd[i] = sp * (.86 + .28 * r()); jx[i] = r() * 100; }
    for (let i = 1; i < n; i++) { const j = 1 + Math.floor(r() * (n - 1)), t_ = u0[i]; u0[i] = u0[j]; u0[j] = t_; }   // decorrelate index and position
    pins.forEach(([pu, pv, pf], i) => { u0[i] = pu; v[i] = pv; spd[i] = sp * (pf ?? 1); });
    const centre = (u, t, out) => {
      const th = (o.angle ?? -.16) + .1 * Math.sin(t * .31), c = Math.cos(th), s = Math.sin(th);
      const X = (u - .5) * L, Y = A1 * Math.sin(TAU * (.85 * u - .3 * t) + 1.3) + A2 * Math.sin(TAU * (1.9 * u + .21 * t));
      const ox = (o.cx ?? W / 2) + (o.drift ?? 50) * Math.sin(t * .33), oy = (o.cy ?? H * .44) + (o.drift ?? 50) * .5 * Math.sin(t * .27 + 1);
      out[0] = ox + X * c - Y * s; out[1] = oy + X * s + Y * c;
    };
    const c0 = [0, 0], c1 = [0, 0], cm = [0, 0];
    return { n, at(j, t, tRef, out) {
      const ph = u0[j] + spd[j] * t, u = j < np ? clamp(ph, 0, .85) : clamp(ph - Math.floor(u0[j] + spd[j] * tRef));
      // the frame (tangent, normal, curvature) comes from points SW_ apart along the centreline, not from its local
      // slope: a sheet wider than a tight bend's radius would otherwise fold over itself into a hard crease
      const SW_ = .08;
      centre(u, t, c0); centre(Math.min(1, u + SW_), t, c1); centre(Math.max(0, u - SW_), t, cm);
      if (u > 1 - SW_) { const k = (u + SW_ - 1) / SW_; c1[0] = lerp(c1[0], 2 * c0[0] - cm[0], k); c1[1] = lerp(c1[1], 2 * c0[1] - cm[1], k); }
      if (u < SW_) { const k = (SW_ - u) / SW_; cm[0] = lerp(cm[0], 2 * c0[0] - c1[0], k); cm[1] = lerp(cm[1], 2 * c0[1] - c1[1], k); }
      const tx = c1[0] - cm[0], ty = c1[1] - cm[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      // signed curvature (Menger, three points; positive when the centreline bends towards the normal)
      const ax = c0[0] - cm[0], ay = c0[1] - cm[1], bx = c1[0] - c0[0], by = c1[1] - c0[1], kap = 2 * (ax * by - ay * bx) / ((Math.hypot(ax, ay) * Math.hypot(bx, by) * tl) || 1e9);
      // half-width: blunt ends (exponent .35), a ripple that travels, and one slow lobe that drifts along the sheet so
      // the flock is lopsided (a dense ball and a thinner tail) rather than a symmetric brush mark; the twist never
      // pinches below .45 of it
      const lc = .5 + .3 * Math.sin(t * .42 + lobePh), lobe = 1 + lobeK * Math.exp(-(((u - lc) / .17) ** 2));
      const hw = Wd * Math.pow(Math.sin(Math.PI * u), .35) * (.68 + .32 * Math.sin(TAU * (1.1 * u - .26 * t) + .4)) * lobe;
      const tw = Math.cos(Math.PI * (1.3 * u + .33 * t + .3)), sheet = .45 + .55 * Math.sqrt(tw * tw + .03) / 1.015;   // |cos|, rounded at the pinch
      const d = hw * sheet * v[j], wob = 6 * noise(t * .8 + jx[j], 9), sh = fold * v[j] * Math.sin(TAU * (.9 * u + .2 * t));   // sh: the sheet folds over itself
      // inside a tight bend the whole inner half of the sheet narrows evenly, so its edge (v = 1) stays within .7 of
      // the radius; clamping each particle instead would pile them into a line
      const reach = hw * sheet * Math.abs(kap), off = (d * kap > 0 && reach > .7 ? d * .7 / reach : d) + wob;
      out.x = c0[0] + nx * off + tx / tl * sh; out.y = c0[1] + ny * off + ty / tl * sh;
      out.ang = Math.atan2(ty, tx); out.len = 6; out.a = sstep(0, .07, u) * (1 - sstep(.9, 1, u)); } };
  }
  // formation(parts, o): concatenates parts into one point set (put the through-line seats first). o is kept on the
  // result (e.g. { box } for a wordmark), and textPoints' .box is lifted from any part that has one.
  function formation(parts, o = {}) {
    if (parts.length > 65535) throw new Error(`SW.formation: ${parts.length} parts; at most 65,535`);
    const n = parts.reduce((s, p) => s + p.n, 0), partOf = new Uint16Array(n), local = new Int32Array(n); let k = 0;
    parts.forEach((p, pi) => { for (let j = 0; j < p.n; j++, k++) { partOf[k] = pi; local[k] = j; } });
    const box = o.box || (parts.find(p => p.p && p.p.box) || {}).p?.box;
    return { n, parts, box, ...o, at: (j, t, tRef, out) => parts[partOf[j]].at(local[j], t, tRef, out) };
  }

  // ---------- the system ----------
  // Hilbert index of a point (1024 x 1024 cells over a margin around the frame): neighbours in space stay neighbours
  // in rank. Used by match: 'hilbert' (the nth-ranked particle goes to the nth-ranked target)
  function hil(px, py) {
    let x = clamp(Math.floor((px + W * .25) / (W * 1.5) * 1024), 0, 1023), y = clamp(Math.floor((py + H * .25) / (H * 1.5) * 1024), 0, 1023), d = 0;
    for (let s = 512; s > 0; s >>= 1) { const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0; d += s * s * ((3 * rx) ^ ry);
      if (!ry) { if (rx) { x = 1023 - x; y = 1023 - y; } const q = x; x = y; y = q; } }
    return d;
  }
  // system(N, keys, o): keys = [{ t: 0, f }, { t, land, f, stagger, spread, from, bend, drift, ease, match, uncross,
  // tag: { start, land, bend } }, ...]
  // stagger: 'x' | 'y' | '-x' | '-y' | 'radial' (outward from key.from) | '-radial' | 'random' | fn(tx, ty, sx, sy, i) ->
  // number (target and source position; mix several terms by normalising each to 0..1 first), spread over key.spread
  // (0..1, default .35) of the window: a larger spread leaves each particle less time to fly, so faster, longer
  // streaks; ease: the travel curve (default a gentle in-out); bend: the paths' sideways bow as a fraction of their
  // length (coherent: neighbours bow alike); drift: px of flow-field wander mid-flight; match: 'split' (default) or
  // 'hilbert'; uncross: polish passes (default 4); tag: its own timing for the through-line. o.tags: the through-line
  // count. Windows must not overlap (a key's t at or after the previous key's land).
  function system(N, keys, o = {}) { return { N, keys, T: o.tags || 0, built: false }; }
  function build(sys) {
    if (sys.built) return; const { N, keys, T } = sys, o = {};
    sys.F = keys.map(k => typeof k.f === 'function' ? k.f() : k.f);
    sys.F.forEach((f, k) => { if (f.n !== N) throw new Error(`SW: formation ${k} has ${f.n} points; the system has ${N}`); });
    keys.forEach((k, i) => { if (i && keys[i - 1].land > k.t + 1e-6) throw new Error(`SW: key ${i} starts at ${k.t} before key ${i - 1} has landed (${keys[i - 1].land})`); });
    sys.A = [Int32Array.from({ length: N }, (_, i) => i)]; sys.s = [null]; sys.e = [null]; sys.b = [null]; sys.ends = [null];
    for (let k = 1; k < keys.length; k++) {
      const K = keys[k], A = sys.F[k - 1], B = sys.F[k], prev = sys.A[k - 1];
      const sx = new Float32Array(N), sy = new Float32Array(N), tx = new Float32Array(N), ty = new Float32Array(N);
      for (let i = 0; i < N; i++) { A.at(prev[i], K.t, K.t, o); sx[i] = o.x; sy[i] = o.y; }
      for (let j = 0; j < N; j++) { B.at(j, K.land, K.land, o); tx[j] = o.x; ty[j] = o.y; }
      // matching. 'split' (default): recursive median bisection. Both sets are cut at the median along the longer side
      // of their joint extent and the halves matched, down to single points: the 1D optimal matching applied axis by
      // axis, so each part of the old picture fills the nearest part of the new one and paths barely cross. 'hilbert':
      // rank along a Hilbert curve; it ignores where the mass is, so a dense source (a roost, a hub) fans out across
      // the whole new picture along crossing paths, which on a pale ground knot into scribble.
      const asg = new Int32Array(N); for (let i = 0; i < T; i++) asg[i] = i;
      const free = []; for (let i = T; i < N; i++) free.push(i);
      let ord = [];      // the particles in an order where neighbours are close in space, for the polish below
      if (K.match === 'hilbert') {
        const hs = new Float64Array(N), ht = new Float64Array(N); for (let i = 0; i < N; i++) { hs[i] = hil(sx[i], sy[i]) + i * 1e-7; ht[i] = hil(tx[i], ty[i]) + i * 1e-7; }
        const src = free.slice().sort((a, b) => hs[a] - hs[b]), tgt = free.slice().sort((a, b) => ht[a] - ht[b]);
        src.forEach((pi, r) => { asg[pi] = tgt[r]; }); ord = src;
      } else {
        const stack = [[free, free.slice()]];
        while (stack.length) { const [a, b] = stack.pop(), n = a.length;
          if (n === 1) { asg[a[0]] = b[0]; ord.push(a[0]); continue; }
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (const i of a) { if (sx[i] < x0) x0 = sx[i]; if (sx[i] > x1) x1 = sx[i]; if (sy[i] < y0) y0 = sy[i]; if (sy[i] > y1) y1 = sy[i]; }
          for (const j of b) { if (tx[j] < x0) x0 = tx[j]; if (tx[j] > x1) x1 = tx[j]; if (ty[j] < y0) y0 = ty[j]; if (ty[j] > y1) y1 = ty[j]; }
          const byX = x1 - x0 >= y1 - y0, ka = byX ? sx : sy, kb = byX ? tx : ty, h = n >> 1;
          a.sort((i, j) => ka[i] - ka[j] || i - j); b.sort((i, j) => kb[i] - kb[j] || i - j);
          stack.push([a.slice(h), b.slice(h)], [a.slice(0, h), b.slice(0, h)]);
        }
      }
      // polish: 2-opt swaps between near neighbours, kept when they shorten the summed squared flight (the cuts leave a
      // few crossings along their seams). K.uncross: passes (default 4, 0 for none).
      const passes = K.uncross ?? 4, d2 = (i, j) => { const dx = sx[i] - tx[j], dy = sy[i] - ty[j]; return dx * dx + dy * dy; };
      for (let p = 0; p < passes; p++) for (let r = 0; r < ord.length - 1; r++) { const i = ord[r];
        for (let q = r + 1; q < Math.min(ord.length, r + 17); q++) { const j = ord[q], a = asg[i], c = asg[j];
          if (d2(i, c) + d2(j, a) < d2(i, a) + d2(j, c) - 1) { asg[i] = c; asg[j] = a; } } }
      // per-particle timing
      const span = K.land - K.t, st = (K.spread ?? .35) * span, dur = span - st, key = new Float32Array(N), m = K.stagger || 'radial', fr = K.from || [W / 2, H / 2];
      for (let i = 0; i < N; i++) { const X = tx[asg[i]], Y = ty[asg[i]];
        key[i] = typeof m === 'function' ? m(X, Y, sx[i], sy[i], i) : m === 'x' ? X : m === '-x' ? -X : m === 'y' ? Y : m === '-y' ? -Y : m === 'random' ? hash(i * 1.618 + k)
          : m === '-radial' ? -Math.hypot(X - fr[0], Y - fr[1]) : Math.hypot(X - fr[0], Y - fr[1]); }
      let lo = Infinity, hi = -Infinity; for (let i = T; i < N; i++) { lo = Math.min(lo, key[i]); hi = Math.max(hi, key[i]); }
      const s = new Float32Array(N), e = new Float32Array(N), b = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const q = clamp(((key[i] - lo) / (hi - lo || 1)) * .85 + .15 * hash(i * 7.31 + k * 3.1)), d = dur * (.7 + .3 * hash(i * 3.17 + k));
        s[i] = K.t + q * st; e[i] = s[i] + d; b[i] = (K.bend ?? .25) * (noise2(sx[i] * .0035, sy[i] * .0035, 13 + k) * 1.6 + .45 * (hash(i * 9.7 + k) - .5));
      }
      for (let i = 0; i < T && K.tag; i++) { s[i] = K.tag.start ?? K.t; e[i] = K.tag.land ?? K.land; b[i] = K.tag.bend ?? b[i]; }
      sys.A.push(asg); sys.s.push(s); sys.e.push(e); sys.b.push(b); sys.ends.push(Float32Array.from(e).sort());
    }
    sys.wide = new Uint8Array(N); sys.al = new Float32Array(N);
    for (let i = 0; i < N; i++) { sys.wide[i] = hash(i * 5.3 + 2) < S.wide ? 1 : 0; sys.al[i] = lerp(S.alpha[0], S.alpha[1], hash(i * 3.7 + 1)); }
    sys.built = true;
  }
  // pos(sys, i, t, tRef, out): particle i at time t (tRef: see parts). Writes x, y, ang, len, a.
  const _A = {}, _B = {};
  function pos(sys, i, t, tRef, out) {
    const keys = sys.keys; let k = 0;
    for (let q = keys.length - 1; q >= 1; q--) if (t >= sys.s[q][i]) { k = q; break; }
    if (k === 0) return sys.F[0].at(sys.A[0][i], t, tRef, out);
    const s = sys.s[k][i], e = sys.e[k][i];
    if (t >= e) return sys.F[k].at(sys.A[k][i], t, tRef, out);
    const K = keys[k], u = (K.ease || MORPH)((t - s) / (e - s)), fz = S.freeze, tf = s + fz * (1 - Math.exp(-(t - s) / fz));
    sys.F[k - 1].at(sys.A[k - 1][i], tf, s, _A); sys.F[k].at(sys.A[k][i], t, tRef, _B);
    const ax = _A.x, ay = _A.y, bx = _B.x, by = _B.y, dx = bx - ax, dy = by - ay, bd = sys.b[k][i];
    const mx = (ax + bx) / 2 - dy * bd, my = (ay + by) / 2 + dx * bd, q = 1 - u;
    let x = q * q * ax + 2 * q * u * mx + u * u * bx, y = q * q * ay + 2 * q * u * my + u * u * by;
    const dr = (K.drift ?? 30) * Math.sin(Math.PI * u);
    if (dr) { const fx = noise2(x * .004, y * .004 + t * .5, 5 + k), fy = noise2(x * .004 + 9.2, y * .004 + t * .5, 6 + k); x += dr * fx; y += dr * fy; }
    // the idle stroke turns from the old one to the new one as a vector, so it never spins
    const alen = isNaN(_A.ang) ? 0 : _A.len, blen = isNaN(_B.ang) ? 0 : _B.len;
    const vx = lerp(alen * Math.cos(_A.ang || 0), blen * Math.cos(_B.ang || 0), u), vy = lerp(alen * Math.sin(_A.ang || 0), blen * Math.sin(_B.ang || 0), u);
    out.x = x; out.y = y; out.ang = Math.atan2(vy, vx); out.len = Math.hypot(vx, vy); out.a = lerp(_A.a, _B.a, u);
  }
  // at(sys, i, t) -> [x, y]: where particle i is (labels that follow the through-line, a camera that tracks it)
  const _o = {};
  function at(sys, i, t) { build(sys); pos(sys, i, t, t, _o); return [_o.x, _o.y]; }
  // landed(sys, k, t): the fraction of particles that have arrived in formation k (time a label to the formation)
  function landed(sys, k, t) { build(sys); if (!k) return 1; const e = sys.ends[k]; let lo = 0, hi = e.length; while (lo < hi) { const m = (lo + hi) >> 1; if (e[m] <= t) lo = m + 1; else hi = m; } return lo / e.length; }
  // formationOf(sys, k): the built formation k (its .box for a wordmark's readable())
  const formationOf = (sys, k) => { build(sys); return sys.F[k]; };

  // draw(t, sys, o): every particle as one stroke: the streak of its last S.trail seconds when it moves, its idle stroke
  // when it doesn't (blended by speed). Strokes are batched into 2 widths x 4 opacities, then the through-line on top.
  // o: ink, accent, trail, k (how far the ground has gone to dusk, for the through-line's halo; defaults to what
  // sky(k) drew this frame)
  const H_ = {}, T_ = {}, LV = [.22, .46, .7, .92];
  function draw(t, sys, o = {}) {
    build(sys);
    const N = sys.N, T = sys.T, tau = o.trail ?? S.trail, cap = S.cap, paths = [[], []].map(() => LV.map(() => new Path2D())), tags = [];
    const thin = S.blend === 'source-over' ? S.thin : 1;
    for (let i = 0; i < N; i++) {
      pos(sys, i, t, t, H_); pos(sys, i, t - tau, t, T_);
      let mx = H_.x - T_.x, my = H_.y - T_.y, m = Math.hypot(mx, my);
      if (m > cap) { mx *= cap / m; my *= cap / m; m = cap; }
      if (i < T) { tags.push([H_.x, H_.y, mx, my, H_.a]); continue; }
      const a = sys.al[i] * H_.a * (m > S.fade ? Math.max(.3, S.fade / m) : 1) * lerp(1, thin, sstep(4, 20, m)); if (a < .07) continue;
      const w = sstep(1.2, 5, m), hl = (isNaN(H_.ang) ? 0 : H_.len) * .5, sx = Math.cos(H_.ang || 0) * hl, sy = Math.sin(H_.ang || 0) * hl;
      let x0 = lerp(H_.x - sx, H_.x - mx, w), y0 = lerp(H_.y - sy, H_.y - my, w), x1 = lerp(H_.x + sx, H_.x, w), y1 = lerp(H_.y + sy, H_.y, w);
      if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < .4) x1 += .4;
      const lv = a < .34 ? 0 : a < .58 ? 1 : a < .81 ? 2 : 3, p = paths[sys.wide[i]][lv]; p.moveTo(x0, y0); p.lineTo(x1, y1);
    }
    CX.save(); CX.lineCap = 'round'; CX.strokeStyle = o.ink || S.ink; if (S.blend !== 'source-over') CX.globalCompositeOperation = S.blend;
    const ga = CX.globalAlpha;
    for (let wd = 0; wd < 2; wd++) for (let lv = 0; lv < 4; lv++) { CX.globalAlpha = ga * LV[lv]; CX.lineWidth = S.lw[wd]; CX.stroke(paths[wd][lv]); }
    CX.globalAlpha = ga; CX.globalCompositeOperation = 'source-over';
    const M = CX.getTransform(), k = o.k ?? groundK();
    for (const [x, y, mx, my, a] of tags) { if (a < .02) continue; CX.globalAlpha = ga * a;
      // the halo is the ground exactly where the bird is on screen (the camera may push in), so it only shows over ink
      if (S.halo) circle(x, y, S.tagR + S.halo, ground(clamp((M.b * x + M.d * y + M.f) / H), k));
      line([[x - mx, y - my], [x, y]], o.accent || S.accent, S.tagLw); circle(x, y, S.tagR, o.accent || S.accent); }
    CX.restore();
  }

  // read(id, str, box, a, px): register text the particles spell (a wordmark) with the checks, through the current
  // camera transform, as text() does for type it draws
  function read(id, str, box, a = 1, px = null) { const M = CX.getTransform(), [x, y, w, h] = box;
    const P_ = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([u, v]) => [M.a * u + M.c * v + M.e, M.b * u + M.d * v + M.f]), xs = P_.map(q => q[0]), ys = P_.map(q => q[1]);
    readable(id, str, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), a, px ? px * Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) : null); }

  // ---------- the frame around it ----------
  // sky(k): the ground, a vertical gradient mixed k (0..1) of the way from S.sky to S.dusk. It stamps k with this
  // frame's time, so draw() can match the through-line's halo to it; a stamp left by another frame is ignored.
  let _sky = [NaN, 0];
  const ground = (fy, k) => mixCol(mixCol(S.sky[0], S.dusk[0], k), mixCol(S.sky[1], S.dusk[1], k), fy);   // fy: 0 top .. 1 bottom
  const groundK = () => _sky[0] === T ? _sky[1] : 0;
  function sky(k = 0) { _sky = [T, k]; const g = CX.createLinearGradient(0, 0, 0, H); g.addColorStop(0, ground(0, k)); g.addColorStop(1, ground(1, k));
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.fillStyle = g; CX.fillRect(0, 0, W, H); CX.restore(); }
  // label(id, str, x, y, a, o): a small annotation in the UI face (30 px at 1080p by default; never under 28)
  function label(id, str, x, y, a, o = {}) { if (a <= .01) return; return text(id, str, x, y, { family: S.font, weight: 500, size: 30 * H / 1080, color: S.ink, alpha: a, ...o }); }
  // caption(id, str, t, t0, t1, o): a line whose words land from t0 and which lifts away over the .22 s before t1
  function caption(id, str, t, t0, t1, o = {}) {
    if (t < t0 || t >= t1) return; const out = seg(t, t1 - .22, t1);
    CX.save(); CX.translate(0, -12 * EASE.exit(out));
    words(id, str, o.x ?? W * .0625, o.y ?? H * .905, t0, t, { family: S.font, weight: 500, size: 48 * H / 1080, color: S.ink, stagger: .05, dur: .32, rise: 16, blur: 10, ...o, alpha: (o.alpha ?? 1) * (1 - easeIn(out)) });
    CX.restore();
  }

  return { S, shares, pick, maskPoints, textPoints, charBox, rectPoints, linePoints, one, arc, field, still, orbit, stream, ribbon, formation,
    system, build, pos, at, landed, formationOf, draw, read, sky, ground, label, caption, hil };
})();
