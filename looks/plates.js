// looks/plates.js: "figure plates". One object on cream paper turns, in a single uncut take, into a sequence of
// numbered figures: fine engraved line work, soft contact shadows, a glass loupe that magnifies what lies under it,
// measured annotations with leader lines and dimension lines, and FIG. captions set in Fraunces.
// Card: looks/plates.md. Specimen: specimens/plates.
//
// Everything is drawn in SCREEN space through a view: PLT.camera(t, keys) returns v with v.p([x, y]) -> [sx, sy] and
// v.z (pixels per world unit). Geometry scales with the camera; strokes, hatching, type and the loupe keep their weight
// in pixels, so a figure redrawn ten times smaller is still engraved with a fine line, as a printed plate would be.
//
// Sizes are 1080p pixels times PLT.u = min(W, H) / 1080, so a 1080 x 1920 feed film keeps 1080p weights and a 4K film
// doubles them. The head and foot bands are measured from the frame's top and bottom edges.

const PLT = (() => {
  const u = Math.min(W, H) / 1080;
  const S = Object.assign({
    paper: '#F1EADB', ink: '#1E1C19', red: '#BD3F27', graphite: '#857E71', shadow: '#3A2C1C',
    serif: 'Fraunces', sans: 'Space Grotesk',
    u,
    hair: 1.1 * u, line: 2 * u, heavy: 3.2 * u,   // stroke weights in px: hatching, outlines, emphasis
    light: [.42, -.86, .3],                       // toward the light (screen x right, y down, z out of the screen)
    head: [0, 64 * u], foot: [H - 178 * u, H - 128 * u],   // bands where the drawing fades into the paper (title, caption)
    seed: 1913,
  }, P.plates || {});

  // ---------- small vector maths ----------
  const norm3 = v => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dir = a => [Math.cos(a), Math.sin(a)];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  function bounds(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1 - x0, y1 - y0]; }
  const poly = pts => { CX.beginPath(); pts.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y)); };
  // shape(pts, o): a closed outline, filled and/or stroked. o: { fill, stroke, lw, alpha }
  function shape(pts, o = {}) { CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha; poly(pts); CX.closePath();
    if (o.fill) { CX.fillStyle = o.fill; CX.fill(); } if (o.stroke) { CX.lineWidth = o.lw || S.line; CX.strokeStyle = o.stroke; CX.lineJoin = 'round'; CX.stroke(); } CX.restore(); }
  // entry(q, d): where a line through q along unit vector d enters the frame (40 px outside it), walking back against d
  function entry(q, d) { const c = [];
    if (d[0] > 1e-6) c.push((q[0] + 40) / d[0]); if (d[0] < -1e-6) c.push((q[0] - W - 40) / d[0]);
    if (d[1] > 1e-6) c.push((q[1] + 40) / d[1]); if (d[1] < -1e-6) c.push((q[1] - H - 40) / d[1]);
    return c.length ? add(q, d, -Math.min(...c)) : q; }

  // ---------- paper ----------
  // The sheet is built once (seeded: fibres, specks and a faint mottle) and drawn every frame; it never moves with the
  // camera, so a zoom reads as the figure being redrawn at a new scale on the same page.
  let _paper = null;
  function sheet() {
    if (_paper) return _paper;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rnd(S.seed);
    g.fillStyle = S.paper; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {   // mottle: big soft blots, a shade lighter or darker
      const x = r() * W, y = r() * H, rad = 120 + r() * 300, dark = r() < .5, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, dark ? 'rgba(120,96,60,.014)' : 'rgba(255,252,242,.03)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 3200; i++) {  // fibres: short curved hairs, mostly a little darker than the sheet
      const x = r() * W, y = r() * H, len = 3 + Math.pow(r(), 2) * 30, a = r() * TAU, bend = (r() - .5) * 1.4, dark = r() < .72;
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, mx = (x + ex) / 2 - Math.sin(a) * bend * len * .3, my = (y + ey) / 2 + Math.cos(a) * bend * len * .3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, ex, ey);
      g.strokeStyle = dark ? `rgba(104,84,56,${(.04 + r() * .09).toFixed(3)})` : `rgba(255,254,248,${(.22 + r() * .35).toFixed(3)})`;
      g.lineWidth = .4 + r() * .8; g.stroke();
    }
    for (let i = 0; i < 700; i++) { g.beginPath(); g.arc(r() * W, r() * H, .3 + r() * .9, 0, TAU); g.fillStyle = `rgba(80,62,40,${(.06 + r() * .18).toFixed(3)})`; g.fill(); }
    const v = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, Math.hypot(W, H) * .62);   // a breath of edge tone
    v.addColorStop(0, 'rgba(110,86,52,0)'); v.addColorStop(1, 'rgba(110,86,52,.10)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    return (_paper = c);
  }
  function paper() { CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.drawImage(sheet(), 0, 0); CX.restore(); }
  // margins(): fade the drawing back into the paper at the head and foot of the plate (S.head, S.foot), so a close-up
  // never runs under the title or the caption. Call it after the figure, before the caption.
  function margins(o = {}) {
    const top = o.head || S.head, bot = o.foot || S.foot, src = sheet(), n = 16;
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0);
    const band = (y0, y1, a0, a1) => { for (let j = 0; j < n; j++) { const ya = lerp(y0, y1, j / n), yb = lerp(y0, y1, (j + 1) / n);
      CX.globalAlpha = ease(lerp(a0, a1, (j + .5) / n)); CX.drawImage(src, 0, ya, W, yb - ya + 1, 0, ya, W, yb - ya + 1); } };
    if (top[1] > 0) { CX.globalAlpha = 1; CX.drawImage(src, 0, 0, W, top[0] + 1, 0, 0, W, top[0] + 1); band(top[0], top[1], 1, 0); }
    if (bot[0] < H) { band(bot[0], bot[1], 0, 1); CX.globalAlpha = 1; CX.drawImage(src, 0, bot[1], W, H - bot[1], 0, bot[1], W, H - bot[1]); }
    CX.restore();
  }

  // ---------- the camera ----------
  function view(F, z, at = [W / 2, H / 2]) {
    return { F, z, at, p: q => [at[0] + (q[0] - F[0]) * z, at[1] + (q[1] - F[1]) * z], inv: s => [F[0] + (s[0] - at[0]) / z, F[1] + (s[1] - at[1]) / z] };
  }
  // camera(t, keys): keys [[t, [fx, fy], zoom, dur = .9, easing = EASE.inOut], ...]: world point [fx, fy] at the frame
  // centre at that zoom. The move to key i runs over [t_i, t_i + dur]. Zoom travels in log space and the pan is
  // zoom-compensated (the focus slides in step with 1/zoom), so a 30x pull-back keeps its subject on screen instead of
  // swinging it off the edge. Keep moves from overlapping.
  function camera(t, keys, at) {
    let F = keys[0][1], z = keys[0][2];
    for (let i = 1; i < keys.length; i++) {
      const [t0, F1, z1, dur = .9, e = EASE.inOut] = keys[i]; if (t <= t0) break;
      const k = e(seg(t, t0, t0 + dur)), z0 = z, F0 = F;
      z = Math.exp(lerp(Math.log(z0), Math.log(z1), k));
      const u = Math.abs(z1 - z0) < 1e-6 * z0 ? k : (1 / z - 1 / z0) / (1 / z1 - 1 / z0);
      F = [lerp(F0[0], F1[0], u), lerp(F0[1], F1[1], u)];
    }
    return view(F, z, at);
  }

  // ---------- line work ----------
  const ink = (pts, o = {}) => line(pts, o.col || S.ink, o.lw || S.line, o);
  const draw = (pts, p, o = {}) => lineTo(pts, p, o.col || S.ink, o.lw || S.line, o);
  // dashed construction line, drawn on over p
  const construct = (pts, p = 1, o = {}) => lineTo(pts, p, o.col || S.graphite, o.lw || S.hair * 1.2, { dash: o.dash || [9, 7], ...o });
  // ribbon(pts, wid, col): an engraved line whose width (px, one per point) swells and thins along it
  function ribbon(pts, wid, col = S.ink) {
    if (pts.length < 2) return; const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let nx = a[1] - b[1], ny = b[0] - a[0]; const d = Math.hypot(nx, ny) || 1;
      const w = wid[i] / 2; nx /= d; ny /= d; L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    CX.beginPath(); L.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y)); for (let i = R.length - 1; i >= 0; i--) CX.lineTo(R[i][0], R[i][1]);
    CX.closePath(); CX.fillStyle = col; CX.fill();
  }
  // hatch(region, angle, gap, o): parallel lines at angle (radians) every gap px inside region (a polygon [[x, y], ...]
  // or a function that builds a path). Lines are anchored to o.anchor (a screen point; default the frame origin), so
  // hatching sits still on a still object and slides with it when it moves, never swimming inside it.
  // o: { lw, col, alpha, p (0..1 draws the lines on, one after another), box (bounds for a function region) }
  function hatch(region, angle, gap, o = {}) {
    const isPoly = Array.isArray(region); if (isPoly && region.length < 3) return;
    const bx = o.box || (isPoly ? bounds(region) : [0, 0, W, H]), A = o.anchor || [0, 0], p = o.p ?? 1;
    const u = dir(angle), v = [-u[1], u[0]], cs = [[bx[0], bx[1]], [bx[0] + bx[2], bx[1]], [bx[0], bx[1] + bx[3]], [bx[0] + bx[2], bx[1] + bx[3]]];
    let v0 = Infinity, v1 = -Infinity, u0 = Infinity, u1 = -Infinity;
    for (const c of cs) { const dx = c[0] - A[0], dy = c[1] - A[1], pv = dx * v[0] + dy * v[1], pu = dx * u[0] + dy * u[1]; v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); }
    const i0 = Math.floor(v0 / gap), i1 = Math.ceil(v1 / gap), n = i1 - i0 + 1;
    CX.save(); if (isPoly) { poly(region); CX.closePath(); } else region(); CX.clip();
    CX.beginPath();
    for (let i = i0; i <= i1; i++) {
      const k = p >= 1 ? 1 : clamp(p * (n + 4) - (i - i0)) ; if (k <= 0) continue;
      const o0 = [A[0] + v[0] * i * gap + u[0] * u0, A[1] + v[1] * i * gap + u[1] * u0];
      CX.moveTo(o0[0], o0[1]); CX.lineTo(o0[0] + u[0] * (u1 - u0) * k, o0[1] + u[1] * (u1 - u0) * k);
    }
    CX.lineWidth = o.lw || S.hair; CX.strokeStyle = o.col || S.ink; CX.globalAlpha *= o.alpha ?? 1; CX.lineCap = 'butt'; CX.stroke(); CX.restore();
  }
  const crossHatch = (region, angle, gap, o = {}) => { hatch(region, angle, gap, o); hatch(region, angle + Math.PI / 2, gap * (o.cross || 1.15), { ...o, alpha: (o.alpha ?? 1) * .8 }); };

  // sphere(c, r, o): an engraved ball. Contour lines run round a tilted axis; each line swells where the surface turns
  // from the light and thins to a hair in it; the darkest part is cross-hatched with meridians; a clean outline. Lines
  // draw on over o.p, one after another. o: { light, axis (3-vectors), lines, wmax,
  // wmin, cross (0..1 threshold of darkness for cross-hatching, default .72), polar (degrees of latitude the lines
  // stop at, default 74), fade (degrees over which the meridians thin out before that cap, default 10), outline:
  // false, col }. Tilt the axis toward the viewer (z of .45 or more) so the pole sits on the face, not on the limb,
  // where contour rings and meridians bunch into a dark knot.
  function sphere(c, r, o = {}) {
    const Lv = norm3(o.light || S.light), Ax = norm3(o.axis || [-.82, -.5, .28]);
    const U = norm3(cross3(Ax, Math.abs(Ax[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), V = cross3(Ax, U);
    const n = o.lines || Math.max(12, Math.round(r / (8.5 * u))), wmax = o.wmax ?? 2.3 * u, wmin = o.wmin ?? .32 * u, cap = (o.polar ?? 74) * Math.PI / 180, p = o.p ?? 1, segs = o.segs || 84, col = o.col || S.ink;
    const crossAt = o.cross ?? .72, darkAt = q => 1 - clamp(dot3(q, Lv) * 1.25 + .05);
    const fam = (count, pointAt, widthOf, stagger) => {
      for (let i = 0; i < count; i++) {
        const k = p >= 1 ? 1 : clamp(p * (count + stagger) - i); if (k <= 0) continue;
        let run = [], wid = [];
        const flush = () => { if (run.length > 1) ribbon(run, wid, col); run = []; wid = []; };
        const m = Math.round(segs * k);
        for (let j = 0; j <= m; j++) {
          const q = pointAt(i, j / segs * TAU); if (q[2] < .015) { flush(); continue; }
          const w = widthOf(darkAt(q), q) * smooth01(q[2] / .22); if (w < .05) { flush(); continue; }
          run.push([c[0] + q[0] * r, c[1] + q[1] * r]); wid.push(w);
        }
        flush();
      }
    };
    const smooth01 = x => { x = clamp(x); return x * x * (3 - 2 * x) * .8 + .2; };
    // contour (latitude) rings
    fam(n, (i, a) => { const lat = -cap + (i + .5) / n * 2 * cap, sl = Math.sin(lat), cl = Math.cos(lat), ca = Math.cos(a), sa = Math.sin(a);
      return [sl * Ax[0] + cl * (ca * U[0] + sa * V[0]), sl * Ax[1] + cl * (ca * U[1] + sa * V[1]), sl * Ax[2] + cl * (ca * U[2] + sa * V[2])]; },
      d => lerp(wmin, wmax, Math.pow(d, 2.2)), 10);
    // meridians, only in the deep shade; they thin to nothing over the last o.fade degrees (default 10) before the polar
    // cap, so the cross-hatching melts away instead of ending in a hard dark edge
    const nm = Math.round(n * 1.6), fadeR = (o.fade ?? 10) * Math.PI / 180;
    fam(nm, (i, a) => { const lon = i / nm * TAU, cl = Math.cos(lon), sl = Math.sin(lon), ca = Math.cos(a), sa = Math.sin(a);
      const e = [cl * U[0] + sl * V[0], cl * U[1] + sl * V[1], cl * U[2] + sl * V[2]];
      const b = lerp(-cap, cap, a / TAU), cb = Math.cos(b), sb = Math.sin(b);   // stop short of the poles, where meridians knot
      const q = [sb * Ax[0] + cb * e[0], sb * Ax[1] + cb * e[1], sb * Ax[2] + cb * e[2]]; q.fade = ease((cap - Math.abs(b)) / fadeR); return q; },
      (d, q) => d < crossAt ? 0 : wmax * .62 * Math.pow((d - crossAt) / (1 - crossAt), .8) * (q.fade ?? 1), 10);
    if (o.outline !== false) circle(c[0], c[1], r, null, { stroke: col, lw: o.lw || S.line });
  }

  // contact(x, y, rx, ry, a): a soft contact shadow on the paper: an ellipse that is darkest at its centre
  function contact(x, y, rx, ry, a = .3, o = {}) {
    if (a <= .002 || rx <= .5) return; CX.save(); CX.translate(x, y); CX.scale(1, ry / rx);
    const g = CX.createRadialGradient(0, 0, 0, 0, 0, rx), c = o.col || S.shadow;
    g.addColorStop(0, rgba(c, a)); g.addColorStop(o.core ?? .35, rgba(c, a * .62)); g.addColorStop(.7, rgba(c, a * .22)); g.addColorStop(1, rgba(c, 0));
    CX.fillStyle = g; CX.beginPath(); CX.arc(0, 0, rx, 0, TAU); CX.fill(); CX.restore();
  }

  // ---------- type ----------
  // label(id, str, x, y, o): text with a paper halo, so it reads cleanly over rays and hatching (Fraunces by default).
  // Pass id null for text nobody needs to read; '~' ids for text that is deliberately brief.
  function label(id, str, x, y, o = {}) {
    const f = { family: S.serif, weight: 400, size: 34 * u, color: S.ink, ...o }, a = (f.alpha ?? 1) * CX.globalAlpha;
    if (a <= .01) return null;
    if (f.halo !== false) {
      const w = measure(str, f), x0 = f.align === 'center' ? x - w / 2 : f.align === 'right' ? x - w : x;
      CX.save(); CX.font = font(f.size, f); CX.textAlign = 'left'; CX.textBaseline = f.base || 'alphabetic'; if ('letterSpacing' in CX) CX.letterSpacing = (f.tracking || 0) + 'px';
      CX.globalAlpha = a; CX.lineJoin = 'round'; CX.lineWidth = f.halo || Math.max(6, f.size * .28); CX.strokeStyle = S.paper;
      if (f.blur > .2) CX.filter = `blur(${f.blur.toFixed(2)}px)`; CX.strokeText(str, x0, y); CX.restore();
    }
    return text(id, str, x, y, f);
  }
  // caption(t, figs, o): the caption at the foot of the plate: "FIG. n" in red small capitals right of a gutter, and
  // the figure's name typed in after it with a caret. figs: [[t, name, typeAt], ...]: figure n starts at
  // figs[n - 1][0]; typeAt (optional) is when its name starts typing (default: as soon as the old name is gone; give
  // figure 1 a negative typeAt to have its name already set on frame 0, the poster frame). On each change the old name
  // is struck back, then the number is retyped and the new name types in, so a number never sits beside another
  // figure's name.
  // o: { y, size, x (the gutter), cps, erase (characters a second; defaults 36 and 90) }. Reading time: a name of w
  // words needs 1 + w / 3 s on screen after it finishes typing, so a figure lasts at least erase + typing + that.
  function caption(t, figs, o = {}) {
    let i = -1; while (i + 1 < figs.length && t >= figs[i + 1][0]) i++; if (i < 0) return;
    const y = o.y ?? H - 82 * u, size = o.size ?? 46 * u, gx = o.x ?? W / 2 - 40 * u, cps = o.cps ?? 36, ecps = o.erase ?? 90;
    const [t0, name, typeAt] = figs[i], prev = i > 0 ? figs[i - 1][1] : '', te = prev.length / ecps, ts = typeAt ?? t0 + (i > 0 ? te : 0);
    let str, done = false, tDone = Infinity;
    if (i > 0 && t < t0 + te) str = prev.slice(0, Math.max(0, prev.length - Math.floor((t - t0) * ecps)));
    else { const ty = typed(t, ts, name, cps); str = ty.str; done = ty.done; tDone = ts + name.length / cps * 1.05; }
    const nf = { family: S.serif, weight: 600, size: size * .7, tracking: size * .12, color: S.red, align: 'right' };
    // the number is retyped in place the moment the old name is gone, so number and name always belong together
    text('fig', `FIG. ${i > 0 && t < t0 + te ? i : i + 1}`, gx - size * .38, y, nf);
    const r = str ? text(done ? 'cap' : '~cap', str, gx + size * .1, y, { family: S.serif, weight: 400, size, color: S.ink }) : { w: 0 };
    // the caret: while typing, then a few blinks, then gone
    const blink = done ? (t - tDone < .75 && frac((t - tDone) * 2.2) < .55) : true;
    if (blink) { CX.save(); CX.fillStyle = S.red; CX.fillRect(gx + size * .1 + r.w + size * .08, y - size * .74, Math.max(2, size * .055), size * .92); CX.restore(); }
  }

  // ---------- annotation ----------
  // leader(id, str, at, to, p, o): a callout: a dot on the thing (at), a fine line to an elbow (to), a short shelf, and
  // the label beside the shelf. p 0..1 draws it on: dot, line, shelf, then the words. o: { side (1: label right of the
  // elbow, -1: left; default away from at), shelf (px), size, family, weight, col, textCol, dot (radius; 0 for none),
  // label (false: draw only the line, and set the words yourself, e.g. to carry them somewhere later) }. Returns where
  // the label's baseline starts.
  function leader(id, str, at, to, p, o = {}) {
    if (p <= 0) return null; const side = o.side || Math.sign(to[0] - at[0]) || 1, shelf = o.shelf ?? 30 * u, col = o.col || S.ink;
    const end = [to[0] + side * shelf, to[1]], size = o.size || 34 * u, lp = [end[0] + side * 12 * u, to[1] + size * .33];
    const dk = backOut(seg(p, 0, .22), 2), lk = EASE.outExpo(seg(p, .08, .7)), tk = EASE.punch(seg(p, .55, 1));
    if ((o.dot ?? 1) > 0) circle(at[0], at[1], (o.dot || 4.6 * u) * dk, col);
    if (lk > 0) lineTo([at, to, end], lk, col, o.lw || S.hair * 1.25);
    if (tk > 0 && o.label !== false) label(tk > .9 ? id : null, str, lp[0], lp[1], { size, family: o.family || S.serif, weight: o.weight || 400,
      color: o.textCol || S.ink, align: side > 0 ? 'left' : 'right', alpha: tk, blur: (1 - tk) * 10 });
    return lp;
  }
  function arrowHead(at, d, size = 12 * u, o = {}) {   // an open arrowhead at point at, pointing along unit vector d
    const n = [-d[1], d[0]], a = add(add(at, d, -size), n, size * .42), b = add(add(at, d, -size), n, -size * .42);
    line([a, at, b], o.col || S.ink, o.lw || S.hair * 1.3, { alpha: o.alpha });
  }
  // dimPath(id, str, pts, p, o): a dimension along a path (already offset from what it measures): fine arrowheads at
  // both ends, extension lines from the measured points (o.from: [[x, y], [x, y]]), drawn on from the middle outwards,
  // and the measurement set beside the middle (o.side: offset in px along the path's normal, default 34; o.size;
  // o.label: false to set it yourself, e.g. to carry it somewhere later). Returns where the label sits.
  function dimPath(id, str, pts, p, o = {}) {
    if (p <= 0 || pts.length < 2) return null; const col = o.col || S.ink, lw = o.lw || S.hair * 1.2;
    const ek = EASE.outExpo(seg(p, 0, .35)), lk = EASE.inOut(seg(p, .15, .75)), tk = EASE.punch(seg(p, .6, 1));
    if (o.from) for (let i = 0; i < 2; i++) { const a = o.from[i], b = i ? pts[pts.length - 1] : pts[0], dd = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...dd) || 1;
      lineTo([a, add(b, dd, 14 * u / L)], ek, col, lw * .9, { alpha: .8 }); }
    // from the middle outwards
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1], at = s => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const k = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; };
    const mid = at(tot / 2), half = tot / 2 * lk, part = (a, b) => { const out = [at(a)]; for (let i = 1; i < L.length - 1; i++) if (L[i] > a && L[i] < b) out.push(pts[i]); out.push(at(b)); return out; };
    if (lk > 0) { line(part(tot / 2 - half, tot / 2 + half), col, lw);
      if (lk > .98) { const a0 = at(0), a1 = at(Math.min(tot, 6)), b0 = at(tot), b1 = at(Math.max(0, tot - 6));
        const da = [a0[0] - a1[0], a0[1] - a1[1]], db = [b0[0] - b1[0], b0[1] - b1[1]], na = Math.hypot(...da) || 1, nb = Math.hypot(...db) || 1;
        arrowHead(a0, [da[0] / na, da[1] / na], 13 * u, { col, lw }); arrowHead(b0, [db[0] / nb, db[1] / nb], 13 * u, { col, lw }); } }
    const m1 = at(tot / 2 + 4), tg = [m1[0] - mid[0], m1[1] - mid[1]], tn = Math.hypot(...tg) || 1, nrm = [tg[1] / tn, -tg[0] / tn], off = o.side ?? 34 * u, size = o.size || 32 * u;
    const lp = add(mid, nrm, off);
    if (tk > 0 && str && o.label !== false) label(tk > .9 ? id : null, str, lp[0], lp[1] + size * .35, { size, family: o.family || S.sans, weight: o.weight || 500, color: o.textCol || col, align: 'center', alpha: tk, blur: (1 - tk) * 8 });
    return lp;
  }
  const dim = (id, str, a, b, p, o = {}) => dimPath(id, str, [a, b], p, o);
  // angle(c, a0, a1, r, p, o): an angle mark at c from direction a0 to a1 (radians; screen angles run clockwise): the
  // arc drawn on over p with a light fill. Returns the arc's midpoint. o: { col, lw, fill (alpha) }
  function angle(c, a0, a1, r, p, o = {}) {
    if (p <= 0) return null; const col = o.col || S.red, k = EASE.outExpo(clamp(p)), a1k = lerp(a0, a1, k);
    if (o.fill !== 0) { CX.save(); CX.globalAlpha *= (o.fill ?? .2) * k; CX.beginPath(); CX.moveTo(c[0], c[1]); CX.arc(c[0], c[1], r, Math.min(a0, a1k), Math.max(a0, a1k)); CX.closePath(); CX.fillStyle = col; CX.fill(); CX.restore(); }
    CX.save(); CX.beginPath(); CX.arc(c[0], c[1], r, Math.min(a0, a1k), Math.max(a0, a1k)); CX.lineWidth = o.lw || S.line; CX.strokeStyle = col; CX.lineCap = 'round'; CX.stroke(); CX.restore();
    return add(c, dir((a0 + a1k) / 2), r);
  }
  // arcPts(c, r, a0, a1, n): points along an arc, for morph() and dimPath()
  const arcPts = (c, r, a0, a1, n = 32) => Array.from({ length: n + 1 }, (_, i) => add(c, dir(lerp(a0, a1, i / n)), r));
  // scale(c, r, a0, deg, p, o): a printed angle scale from direction a0: a tick every degree, a longer one every five,
  // tiny numerals. It is meant to be too fine to read at a glance (the loupe reads it). o: { col, size (numeral px) }
  function scale(c, r, a0, deg, p, o = {}) {
    if (p <= 0) return; const col = o.col || S.ink, n = Math.round(deg);
    CX.save(); CX.globalAlpha *= o.alpha ?? 1; CX.beginPath(); CX.arc(c[0], c[1], r, a0, a0 + deg * Math.PI / 180 * EASE.outExpo(p)); CX.lineWidth = S.hair; CX.strokeStyle = col; CX.stroke();
    for (let i = 0; i <= n; i++) { const k = clamp(p * (n + 3) - i); if (k <= 0) break; const a = a0 + i * Math.PI / 180, L = (i % 5 === 0 ? 12 : 7) * u;
      line([add(c, dir(a), r), add(c, dir(a), r - L * k)], col, S.hair * .9);
      if (i % 5 === 0) { CX.save(); CX.globalAlpha *= k; const q = add(c, dir(a), r + 9 * u); text(null, String(i), q[0], q[1], { family: S.sans, weight: 500, size: o.size || 9 * u, color: col, align: 'center', base: 'middle' }); CX.restore(); } }
    CX.restore();
  }

  // ---------- glass ----------
  let _buf = null;
  // lens(x, y, r, o): a glass loupe over everything drawn so far. It magnifies what lies under it (o.mag, default 2.4)
  // with a little barrel compression toward the rim, casts a soft shadow away from the light that grows, softens and
  // drifts with o.lift (0 resting on the paper, 1 lifted clear), with a brighter caustic where it focuses the light, and
  // carries a dark rim and one highlight. Call it AFTER what it should magnify and BEFORE type that stays sharp above
  // it. Returns { at: q => where screen point q appears through the glass, m (centre magnification) } so a reading
  // seen through it can be registered with readable().
  function lens(x, y, r, o = {}) {
    const mag = o.mag || 2.4, lift = clamp(o.lift ?? .2), a = o.alpha ?? 1, Lv = norm3(o.light || S.light), barrel = o.barrel ?? .3;
    if (a <= .01 || r < 2) return null;
    const sr = Math.ceil(r + 2), d = sr * 2;
    if (!_buf || _buf.width < d) { _buf = document.createElement('canvas'); _buf.width = _buf.height = Math.max(d, 64); }
    const g = _buf.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, _buf.width, _buf.height);
    g.fillStyle = S.paper; g.fillRect(0, 0, d, d); g.drawImage(OUT, x - sr, y - sr, d, d, 0, 0, d, d);
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalAlpha = a;
    // the shadow on the paper, thrown away from the light, larger, softer and fainter as the glass lifts
    const off = (14 + 90 * lift) * u, sx = x - Lv[0] * off, sy = y - Lv[1] * off;
    contact(sx, sy, r * (1.08 + .3 * lift), r * (1.08 + .3 * lift), .2 * (1 - .55 * lift), { core: .55 });
    CX.save(); CX.globalCompositeOperation = 'lighter'; contact(sx - Lv[0] * r * .1, sy - Lv[1] * r * .1, r * .42 * (1 + lift), r * .36 * (1 + lift), .07 * (1 - lift), { col: '#FFF6DA' }); CX.restore();
    // the magnified image, rim inwards: each disc a little more magnified than the ring outside it
    const rings = 18;
    for (let i = 0; i < rings; i++) {
      const rr = r * (1 - i / rings), m = mag * (1 - barrel * Math.pow(rr / r, 2));
      CX.save(); CX.beginPath(); CX.arc(x, y, rr, 0, TAU); CX.clip();
      CX.drawImage(_buf, 0, 0, d, d, x - sr * m, y - sr * m, d * m, d * m); CX.restore();
    }
    // glass: the faintest warm lift, darker toward the edge, a rim, a highlight on the side facing the light
    CX.save(); CX.beginPath(); CX.arc(x, y, r, 0, TAU); CX.clip();
    const e = CX.createRadialGradient(x, y, r * .7, x, y, r); e.addColorStop(0, 'rgba(255,250,236,.05)'); e.addColorStop(.8, 'rgba(60,46,30,.06)'); e.addColorStop(1, 'rgba(40,30,18,.32)');
    CX.fillStyle = e; CX.fillRect(x - r, y - r, r * 2, r * 2);
    const la = Math.atan2(Lv[1], Lv[0]);
    CX.lineCap = 'round'; CX.strokeStyle = 'rgba(255,255,252,.75)'; CX.lineWidth = r * .045; CX.beginPath(); CX.arc(x, y, r * .84, la - .55, la + .35); CX.stroke();
    CX.strokeStyle = 'rgba(255,255,252,.35)'; CX.lineWidth = r * .02; CX.beginPath(); CX.arc(x, y, r * .76, la - .3, la + .12); CX.stroke();
    CX.restore();
    circle(x, y, r, null, { stroke: S.ink, lw: 3.2 * u }); circle(x, y, r + 5 * u, null, { stroke: S.graphite, lw: 1.1 * u }); circle(x, y, r - 2.4 * u, null, { stroke: 'rgba(255,253,245,.55)', lw: 1.2 * u });
    CX.restore();
    return { at: q => { const dx = q[0] - x, dy = q[1] - y, rr = Math.hypot(dx, dy), m = mag * (1 - barrel * Math.pow(Math.min(1, rr * mag / r), 2)); return [x + dx * m, y + dy * m]; }, m: mag };
  }

  // ---------- morph ----------
  // resample(pts, n): n + 1 points evenly spaced by arc length along a polyline. morph(a, b, k, n): the polyline
  // between a and b at k (0..1), matched by arc length, so one outline can become another (an angle sliding down a
  // radius, a shadow into a wedge, an arc closing into a circle).
  function resample(pts, n = 64) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1] || 1, out = []; let j = 1;
    for (let i = 0; i <= n; i++) { const s = tot * i / n; while (j < L.length - 1 && L[j] < s) j++; const k = (s - L[j - 1]) / (L[j] - L[j - 1] || 1);
      out.push([lerp(pts[j - 1][0], pts[j][0], k), lerp(pts[j - 1][1], pts[j][1], k)]); }
    return out;
  }
  function morph(a, b, k, n = 64) { const A = resample(a, n), B = resample(b, n); return A.map((q, i) => [lerp(q[0], B[i][0], k), lerp(q[1], B[i][1], k)]); }

  // ---------- light ----------
  // rays(t, d, anchor, o): parallel light crossing the frame along unit vector d (screen), one ray through anchor and
  // one every o.gap px beside it. o.stop(start, d) -> the distance along d at which a ray is stopped (by the ground, a
  // stick, a ball), or Infinity: build it with PLT.stops(v, ...hits). o.p draws them on from the light, staggered by up
  // to o.stagger (default .6; 0 draws every ray in step, as you want for one key ray). Small chevrons travel down each
  // ray so the light is seen to move (o.period, o.speed px/s, o.chevron size, o.pulseAlpha). o: { gap, lw, col, alpha,
  // pulse (false to omit), skip(q) -> true to leave a ray out, key (draw the anchor ray too), band: [a, b] (px either
  // side of the anchor ray, measured across the rays, to keep the light to a beam over the figure; positive is to the
  // left of the direction of travel) }. Returns [[start, front, length], ...] for the rays drawn, so a shadow can
  // follow the front of the ray that casts it.
  function rays(t, d, anchor, o = {}) {
    const gap = o.gap || 64 * u, q = [-d[1], d[0]], far = Math.hypot(W, H) + 200, p = o.p ?? 1, st = o.stagger ?? .6, out = [];
    const span = Math.ceil(far / gap), band = o.band || [-far, far];
    for (let k = Math.max(-span, Math.ceil(band[0] / gap)); k <= Math.min(span, Math.floor(band[1] / gap)); k++) {
      if (k === 0 && !o.key) continue;
      const Q = add(anchor, q, k * gap); if (o.skip && o.skip(Q)) continue;
      const s0 = entry(Q, d), back = Math.hypot(Q[0] - s0[0], Q[1] - s0[1]);   // where the ray enters the frame
      const exitL = Math.min(...[d[0] > 1e-6 ? (W + 40 - s0[0]) / d[0] : d[0] < -1e-6 ? (-40 - s0[0]) / d[0] : Infinity, d[1] > 1e-6 ? (H + 40 - s0[1]) / d[1] : d[1] < -1e-6 ? (-40 - s0[1]) / d[1] : Infinity]);
      if (exitL <= 0) continue;
      const len = Math.min(exitL, o.stop ? o.stop(s0, d) : Infinity), k01 = clamp(p * (1 + st) - hash(k * 3.1) * st);
      if (len <= 0 || k01 <= 0) continue;
      const L = len * EASE.inOut(k01), s1 = add(s0, d, L); out.push([s0, s1, len]);
      line([s0, s1], o.col || S.graphite, o.lw || S.hair, { alpha: o.alpha ?? .85, cap: 'butt' });
      if (o.pulse !== false) {   // light travelling down the ray: small open chevrons, fixed to the ray as its entry moves
        const P = o.period || 380 * u, sp = o.speed || 150 * u, ph = frac((t * sp) / P + hash(k * 7.7)) * P, sz = o.chevron || 9 * u;
        for (let m = -12; m <= 12; m++) { const s = back + ph + m * P; if (s < sz + 4 || s > L - 6) continue;
          const fade = clamp(s / (120 * u)) * clamp((L - s) / (80 * u));
          arrowHead(add(s0, d, s), d, sz, { col: o.col || S.ink, lw: (o.lw || S.hair) * 1.15, alpha: (o.pulseAlpha ?? .55) * fade }); }
      }
    }
    return out;
  }
  // Ray hits, for rays()'s stop: each returns how far a ray from P along unit vector d travels before it meets the
  // thing, or Infinity. hitSeg: a segment a-b (a stick, a wall, an edge); hitCircle: a ball or a planet seen from
  // outside; hitLine: an infinite floor through a with normal n. stops(v, ...hits) combines them into one stop
  // function: the nearest hit wins, and with a view v the hits are computed in world units and returned in pixels.
  function hitSeg(P, d, a, b) {
    const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-12) return Infinity;
    const ax = a[0] - P[0], ay = a[1] - P[1], l = (ax * ey - ay * ex) / den, mu = (ax * d[1] - ay * d[0]) / den;
    return l > 1e-6 && mu >= 0 && mu <= 1 ? l : Infinity;
  }
  function hitCircle(P, d, c, r) {
    const px = P[0] - c[0], py = P[1] - c[1], B = px * d[0] + py * d[1], C = px * px + py * py - r * r, disc = B * B - C;
    if (C < 0) return 0; if (disc < 0 || B >= 0) return Infinity;
    return C / (-B + Math.sqrt(disc));   // the nearer root, in the stable form (good for huge radii too)
  }
  function hitLine(P, d, a, n) { const den = d[0] * n[0] + d[1] * n[1]; if (Math.abs(den) < 1e-12) return Infinity;
    const l = ((a[0] - P[0]) * n[0] + (a[1] - P[1]) * n[1]) / den; return l > 1e-6 ? l : Infinity; }
  const stops = (v, ...hits) => (s0, d) => { const P = v ? v.inv(s0) : s0; let L = Infinity; for (const h of hits) if (h) L = Math.min(L, h(P, d)); return L * (v ? v.z : 1); };

  // ---------- finish ----------
  function finish(o = {}) { grain(o.grain ?? .03, 1); if (o.vignette !== false) vignette(o.vignette ?? .05, '#4A3824'); }

  return { S, u, sheet, paper, margins, view, camera, shape, entry, ink, draw, construct, ribbon, hatch, crossHatch, sphere, contact, label, caption,
    leader, arrowHead, dimPath, dim, angle, arcPts, scale, lens, resample, morph, rays, hitSeg, hitCircle, hitLine, stops, finish, bounds, dir, add };
})();
