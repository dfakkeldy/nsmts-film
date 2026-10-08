// looks/editorial.js: "the page rebuilds itself on the beat". Magazine-grade print design in motion: a heavy
// high-contrast serif (Fraunces 800-900) set big on a strict modular grid, two or three flat print inks on paper,
// rules and blocks that wipe in, full-bleed page flips, and one silhouette motif (a wren by default) that hops from
// one composition to the next and carries the eye across every change.
// Card: looks/editorial.md. Specimen: specimens/editorial.
//
// Everything here is a pure function of t. Layout that needs measured type (glyph positions, perches on letters)
// is measured on first use, after the fonts have loaded, and cached: never measure at the top level of a scene file.

const ED = (() => {
  // ---------- inks and paper ----------
  // a: the deep ink (a page field that takes paper-coloured type), b: the light ink (a field that takes ink type).
  // One palette per film: mixing them drifts toward the atlas's banned near-black + vermilion + cobalt + cream set.
  const PALETTES = {
    forest: { paper: '#EEEBE2', ink: '#121512', a: '#1E5B3E', b: '#E9A23B' },     // racing green and marigold (the default)
    cobalt: { paper: '#F1EDE4', ink: '#141311', a: '#2443D8', b: '#F4C521' },     // cobalt and chrome yellow: the atlas reference film's pair
    vermilion: { paper: '#F2ECE1', ink: '#16130F', a: '#E2421F', b: '#F2B8A2' },  // vermilion and blush
  };
  // serif: display, decks and ears; sans: caps labels; cond: giant condensed numerals (headline(..., { family: ED.S.cond }))
  const S = Object.assign({ palette: 'forest', serif: 'Fraunces', sans: 'Space Grotesk', cond: 'Barlow Condensed',
    cols: 12, rows: 6, margin: [72, 96, 72, 96], gutter: 24, texture: .5, grain: .025 }, P.editorial || {});
  const C = Object.assign({}, PALETTES[S.palette] || PALETTES.forest, S.inks || {});

  // ---------- the grid ----------
  // grid(o) -> G: a modular grid of cols x rows inside the margins [top, right, bottom, left], gutter between.
  // G.x(c) is the left edge of column c, G.w(n) the width of n columns (gutters included), G.span(c, n) = [x, w];
  // the same for rows: G.y(r), G.h(n). G.rect(c, r, nc, nr) = [x, y, w, h]. Columns and rows may be fractional.
  function grid(o = {}) {
    const cols = o.cols ?? S.cols, rows = o.rows ?? S.rows, m = o.margin ?? S.margin, g = o.gutter ?? S.gutter;
    const [mt, mr, mb, ml] = Array.isArray(m) ? m : [m, m, m, m];
    const cw = (W - ml - mr - g * (cols - 1)) / cols, rh = (H - mt - mb - g * (rows - 1)) / rows;
    const G = { cols, rows, colW: cw, rowH: rh, gutter: g, left: ml, right: W - mr, top: mt, bottom: H - mb, measure: W - ml - mr };
    G.x = c => ml + c * (cw + g); G.w = n => n * cw + Math.max(0, n - 1) * g; G.span = (c, n) => [G.x(c), G.w(n)];
    G.y = r => mt + r * (rh + g); G.h = n => n * rh + Math.max(0, n - 1) * g;
    G.rect = (c, r, nc, nr) => [G.x(c), G.y(r), G.w(nc), G.h(nr)];
    return G;
  }
  // showGrid(G, a): the columns and rows, faintly, for laying out a page (never in a finished film)
  function showGrid(G, a = .12, col = '#FF2D55') {
    CX.save(); CX.globalAlpha *= a; CX.fillStyle = col;
    for (let c = 0; c < G.cols; c++) CX.fillRect(G.x(c), 0, G.colW, H);
    CX.globalAlpha *= .6; for (let r = 0; r < G.rows; r++) CX.fillRect(0, G.y(r), W, G.rowH); CX.restore();
  }

  // ---------- type ----------
  // track(size, kind): optical tracking in px. Display serif tightens as it grows (-2.5% of the size at 220 px and
  // up, none at 48 px); 'caps' open wide (+14%); 'text' sets as drawn.
  function track(size, kind = 'display') {
    if (kind === 'caps') return size * .14;
    if (kind === 'text') return 0;
    return -size * .025 * clamp(invLerp(48, 220, size));
  }
  const fo = o => ({ family: o.family || S.serif, weight: o.weight ?? 900, italic: false, size: o.size });
  // word space, in em: display lines get at least .2 em (negative tracking would otherwise close 'Good morning.' up
  // into one word); caps and text keep the font's own space
  const wordSpace = o => o.space ?? (o.kind === 'caps' || o.kind === 'text' ? 0 : .2);
  // layout(str, o, size): glyph i sits at the kerned width of the prefix before it (measured untracked, so the font's
  // kerning survives when glyphs move separately), plus the tracking between letters. A word space takes no negative
  // tracking (positive caps tracking still opens it) and is widened to the word-space floor.
  function layout(str, o, size) {
    size = Math.round(size); const tr = o.tracking ?? track(size, o.kind), f = fo({ ...o, size }), chars = [...str];
    CX.save(); CX.font = font(size, f); if ('letterSpacing' in CX) CX.letterSpacing = '0px';
    const extra = Math.max(0, wordSpace(o) * size - CX.measureText(' ').width);
    let off = 0;
    const glyphs = chars.map((ch, i) => {
      if (i) { const sp = chars[i - 1] === ' ' || ch === ' '; off += sp ? Math.max(0, tr) : tr; if (chars[i - 1] === ' ') off += extra; }
      const m = CX.measureText(ch);
      return { ch, x: (i ? CX.measureText(chars.slice(0, i).join('')).width : 0) + off, w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
    });
    const full = CX.measureText(str); CX.restore();
    return { str, size, tracking: tr, f, glyphs, w: full.width + off, asc: Math.max(...glyphs.map(g => g.asc)), desc: Math.max(0, ...glyphs.map(g => g.desc)), capAsc: full.actualBoundingBoxAscent };
  }
  // setLine(str, o): the line laid out glyph by glyph (layout above), cached per string, font, size and spacing
  const _lines = new Map();
  function setLine(str, o) {
    const size = Math.round(o.size), key = [str, o.family || S.serif, o.weight ?? 900, size, o.tracking ?? o.kind, wordSpace(o)].join('|');
    if (!_lines.has(key)) _lines.set(key, layout(str, o, size));
    return _lines.get(key);
  }
  // fit(str, o, w): the largest whole-pixel size at which the set line (tracking and word spaces as setLine sets
  // them) spans no more than w
  const _fits = new Map();
  function fit(str, o, w) {
    const key = [str, o.family || S.serif, o.weight ?? 900, o.kind, o.tracking, wordSpace(o), Math.round(w)].join('|'); if (_fits.has(key)) return _fits.get(key);
    let s = 100; for (let i = 0; i < 5; i++) s = s * w / layout(str, o, s).w;
    s = Math.floor(s); while (s > 8 && layout(str, o, s).w > w) s--;
    _fits.set(key, s); return s;
  }
  // inkTop(L, i, fx0, fx1): how far above the baseline the highest ink of glyph i reaches across the columns fx0..fx1
  // (fractions of its advance width). Bounding-box ascents lie about curved tops (a numeral's concave flag dips
  // ~50 px below its raised tip): this rasterises the glyph once and reads the real profile.
  const _ink = new Map();
  function inkProfile(L, i) {
    const g = L.glyphs[i], key = [g.ch, L.f.family, L.f.weight, L.size].join('|'); if (_ink.has(key)) return _ink.get(key);
    const pad = Math.ceil(L.size * .3), w = Math.ceil(g.w + pad * 2), h = Math.ceil(L.size * 1.5), base = Math.ceil(L.size * 1.15);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    x.font = font(L.size, L.f); x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(g.ch, pad, base);
    const d = x.getImageData(0, 0, w, h).data, top = new Float32Array(w).fill(NaN);
    for (let cx = 0; cx < w; cx++) for (let cy = 0; cy < h; cy++) if (d[(cy * w + cx) * 4 + 3] > 127) { top[cx] = base - cy; break; }
    const P = { pad, top }; _ink.set(key, P); return P;
  }
  function inkTop(L, i, fx0 = .5, fx1 = fx0) {
    const g = L.glyphs[i], P = inkProfile(L, i); let best = -Infinity;
    for (let cx = Math.floor(P.pad + g.w * Math.min(fx0, fx1)); cx <= Math.ceil(P.pad + g.w * Math.max(fx0, fx1)); cx++) { const v = P.top[cx]; if (v === v && v > best) best = v; }
    return best === -Infinity ? 0 : best;
  }
  // perch(L, i, fx, s, face): where a motif s px tall stands on glyph i of a set line, as [dx, dy] from the line's
  // origin and baseline: x at column fx of the glyph, feet on the highest ink under them (FEET: the wren's feet span,
  // in units of its height, facing right). Add the line's x0 and baseline: [x0 + dx, base + dy].
  const FEET = [.02, .29];
  function perch(L, i, fx, s = 0, face = 1) {
    const g = L.glyphs[i], a = fx + FEET[0] * s * face / g.w, b = fx + FEET[1] * s * face / g.w;
    return [g.x + g.w * fx, -inkTop(L, i, Math.min(a, b), Math.max(a, b))];
  }
  // headline(id, str, x, y, t, o): a display line on baseline y whose glyphs rise into place one after another from
  // behind a slot (the line's own box, ascent to descent), and drop back into it on the way out.
  // o: size (or fit: width to span), weight (900), family, color, align, kind ('display' | 'caps' | 'text'),
  //    t0 (start of the reveal), stagger (s between glyphs, default .028), dur (.55), t1 (start of the exit,
  //    optional), outDur (the exit's length, default .7 x dur), alpha, space (word space floor in em). Returns the
  //    set line L with frame positions: L.x0, L.y, and L.glyphTop(i, fx, s, face): the point a motif s px tall
  //    stands on at column fx of glyph i (perch() above, on the real ink).
  //    The same call sets the other voices: a light deck (weight: 300), ears in the roman (weight: 600, 40 px or
  //    more at 1080p), and, if a brief wants them, wide caps in the sans ({ family: ED.S.sans, weight: 600,
  //    kind: 'caps' }, 40 px or more: smaller tracked caps read as the atlas's tiny-eyebrow tell).
  function headline(id, str, x, y, t, o = {}) {
    const size = o.size || fit(str, o, o.fit), L = setLine(str, { ...o, size }), st = o.stagger ?? .028, d = o.dur ?? .55;
    const x0 = o.align === 'center' ? x - L.w / 2 : o.align === 'right' ? x - L.w : x;
    const pad = size * .06, top = y - L.asc - pad, bot = y + L.desc + pad, n = L.glyphs.length;
    const inK = i => o.t0 == null ? 1 : EASE.punch(seg(t, o.t0 + i * st, o.t0 + i * st + d));
    const outK = i => o.t1 == null ? 0 : EASE.exit(seg(t, o.t1 + i * st * .6, o.t1 + i * st * .6 + (o.outDur ?? d * .7)));
    CX.save(); CX.beginPath(); CX.rect(x0 - size, top, L.w + size * 2, bot - top); CX.clip();
    CX.font = font(size, L.f); CX.fillStyle = o.color || C.ink; CX.textBaseline = 'alphabetic'; if ('letterSpacing' in CX) CX.letterSpacing = '0px';
    CX.globalAlpha *= o.alpha ?? 1;
    let last = 0;
    L.glyphs.forEach((g, i) => { const k = inK(i), q = outK(i); if (k <= 0 || q >= 1) return;
      const dy = (1 - k) * (bot - top + size * .1) + q * (bot - top + size * .1); CX.fillText(g.ch, x0 + g.x, y + dy); if (i === n - 1) last = k * (1 - q); });
    CX.restore();
    // register the whole line once its last glyph has landed (no ids per glyph: they'd collide with each other)
    if (id != null && last > .9 && outK(0) < .1) seen(id, str, [x0, y - L.asc, L.w, L.asc + L.desc], (o.alpha ?? 1) * CX.globalAlpha, size);
    return { ...L, x0, y, glyphTop: (i, fx = .5, s = 0, face = 1) => { const p = perch(L, i, fx, s, face); return [x0 + p[0], y + p[1]]; } };
  }
  // ---------- rules, blocks and pages ----------
  // wipe(t, t0, dur, e): eased 0..1 progress of a wipe starting at t0
  const wipe = (t, t0, dur = .5, e = EASE.outExpo) => e(seg(t, t0, t0 + dur));
  // sweep(rect, p, from): the part of rect a panel covers as it wipes in from one side over p 0..1, and for p 1..2
  // as it leaves toward the side it was travelling (its trailing edge following), like a sheet pulled across and
  // off. Pure geometry: fill it for a page flip, clip to it (within) to put the new page's content on it.
  function sweep(r, p, from = 'left') {
    const [x, y, w, h] = r; if (p <= 0 || p >= 2) return [x, y, 0, 0];
    const a = p <= 1 ? 0 : p - 1, b = p <= 1 ? p : 1;
    if (from === 'left') return [x + w * a, y, w * (b - a), h];
    if (from === 'right') return [x + w * (1 - b), y, w * (b - a), h];
    if (from === 'top') return [x, y + h * a, w, h * (b - a)];
    return [x, y + h * (1 - b), w, h * (b - a)];
  }
  // rule(x, y, w, p, o): a square-ended printer's rule drawn from o.from ('left' | 'right' | 'center') over p;
  // o.lw thickness (default 6), o.color. y is the rule's top edge. Returns its current [x, w].
  function rule(x, y, w, p, o = {}) {
    p = clamp(p); if (p <= 0) return [x, 0]; const lw = o.lw ?? 6, ww = w * p;
    const rx = o.from === 'right' ? x + w - ww : o.from === 'center' ? x + (w - ww) / 2 : x;
    CX.fillStyle = o.color || C.ink; CX.fillRect(rx, y, ww, lw); return [rx, ww];
  }
  // rectSpring(t, keys, specs): a rectangle whose four edges each ride their own spring toward each new target
  // (kit.js follow), so a page can drain into a rule or a rule can lift into a masthead with the edges arriving at
  // different moments. keys: [[t, [x, y, w, h], specs?], ...]; specs: one spring for all edges or [left, top, right,
  // bottom], given for the whole call or per key (a key's own specs win).
  function rectSpring(t, keys, specs = 'smooth') {
    const pick = (sp, j) => sp == null ? undefined : Array.isArray(sp) ? sp[j] : sp;
    const e = [0, 1, 2, 3].map(j => follow(t, keys.map(([k, r, sp]) => [k, [r[0], r[1], r[0] + r[2], r[1] + r[3]][j], pick(sp, j)]), pick(specs, j)));
    return [e[0], e[1], e[2] - e[0], e[3] - e[1]];
  }
  // within(rect, fn): draw fn clipped to rect (a page or panel). Text set inside registers only the part of it that
  // shows, so a page sliding over another doesn't leave the covered page's words counted as readable. Rects and text
  // boxes are compared in frame pixels, through whatever transform is current (a sheet carrying its type; translate
  // and scale only, no rotation).
  const VIS = [], OCC = [];
  const toFrame = r => { const M = CX.getTransform(), xs = [r[0], r[0] + r[2]].map(x => M.a * x + M.e), ys = [r[1], r[1] + r[3]].map(y => M.d * y + M.f);
    return [Math.min(...xs), Math.min(...ys), Math.abs(xs[1] - xs[0]), Math.abs(ys[1] - ys[0])]; };
  const inR = (r, x, y) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  function within(r, fn) { if (!r || r[2] <= 0 || r[3] <= 0) return; CX.save(); CX.beginPath(); CX.rect(r[0], r[1], r[2], r[3]); CX.clip();
    VIS.push(toFrame(r)); try { fn(); } finally { VIS.pop(); CX.restore(); } }
  // seen(id, str, box, a, px): readable() for the part of box inside every enclosing within() and under no page
  // stacked above it (pages()); dropped when under 60% of it shows. A 24 x 8 grid of samples measures the part.
  function seen(id, str, box, a, px) {
    const b = toFrame(box), NX = 24, NY = 8; let n = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const x = b[0] + (i + .5) / NX * b[2], y = b[1] + (j + .5) / NY * b[3];
      if (VIS.every(r => inR(r, x, y)) && !OCC.some(r => inR(r, x, y))) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    if (n < .6 * NX * NY) return;
    const hx = b[2] / NX / 2, hy = b[3] / NY / 2;   // the visible samples' extent, out to their cells' edges
    readable(id, str, x0 - hx, y0 - hy, x1 - x0 + 2 * hx, y1 - y0 + 2 * hy, a, px);
  }
  // pull(rect, p, dir): a sheet pulled off toward dir ('left' | 'right' | 'up' | 'down') by p (0 in place, 1 gone),
  // carrying its content. Returns { r: the part of the sheet still inside rect, dx, dy: the offset to draw its
  // content at }. Drive p with kf stops to park the edge somewhere on the way, under the motif so its split into two
  // inks is seen for a beat: kf(t, [[t0, 0], [t1, at, EASE.inOut], [t2, at], [t3, 1, EASE.exit]]).
  function pull(r, p, dir = 'left') {
    const [x, y, w, h] = r; p = clamp(p);
    if (dir === 'left') return { r: [x, y, w * (1 - p), h], dx: -w * p, dy: 0 };
    if (dir === 'right') return { r: [x + w * p, y, w * (1 - p), h], dx: w * p, dy: 0 };
    if (dir === 'up') return { r: [x, y, w, h * (1 - p)], dx: 0, dy: -h * p };
    return { r: [x, y + h * p, w, h * (1 - p)], dx: 0, dy: h * p };
  }
  // pages(list): a stack of flat pages, back to front: [{ r (rect, or null for the whole frame), fill (the page
  // colour), draw() (its content, in page coordinates), dx, dy (content offset, as pull() gives), col, eye (the
  // motif's inks on this page), ...anything else knockout's fn wants (a rule's ink) }]. Each page is filled and drawn
  // clipped to its rect; a page under a full-frame page is skipped; text registers only where no page above covers
  // it. Returns the stack as knock-out regions, so the motif's inks follow exactly the geometry the pages used.
  function pages(list) {
    const rect = g => g.r || [0, 0, W, H], live = g => { const r = rect(g); return r[2] > 0 && r[3] > 0; };
    list.forEach((g, i) => {
      const above = list.slice(i + 1).filter(live); if (!live(g) || above.some(u => !u.r)) return;
      const r = rect(g); OCC.push(...above.map(u => toFrame(rect(u))));
      try { within(r, () => { if (g.fill) { CX.fillStyle = g.fill; CX.fillRect(r[0], r[1], r[2], r[3]); }
        if (g.draw) { CX.translate(g.dx || 0, g.dy || 0); g.draw(); } }); }
      finally { OCC.length -= above.length; }
    });
    return list.filter(live);
  }
  // knockout(regions, fn): draw a motif in the ink that reads on each page under it. regions, back to front (as
  // pages() returns them): [{ r: [x, y, w, h] or null (the whole frame), col, eye }]; fn(col, eye, region) draws the
  // motif. Each region is clipped to its rect minus every region above it, so no fringe of another ink shows.
  function knockout(regions, fn) {
    regions.forEach((g, i) => { const r = g.r || [0, 0, W, H]; if (r[2] <= 0 || r[3] <= 0) return;
      const above = regions.slice(i + 1).filter(u => !u.r || (u.r[2] > 0 && u.r[3] > 0)); if (above.some(u => !u.r)) return;
      CX.save(); CX.beginPath(); CX.rect(r[0], r[1], r[2], r[3]); CX.clip();
      for (const u of above) { CX.beginPath(); CX.rect(-W, -H, 3 * W, 3 * H); CX.rect(u.r[0], u.r[1], u.r[2], u.r[3]); CX.clip('evenodd'); }
      fn(g.col, g.eye, g); CX.restore(); });
  }
  // once(fn): a value computed on first use and kept (layout measured from type, after the fonts have loaded)
  const once = fn => { let v, done = false; return () => done ? v : (done = true, v = fn()); };
  // dots(x, y, n, r, gap, fill, o): a row (or o.cols-wide block) of n dots; fill(i) 0..1 fills dot i with o.on,
  // springing from the centre; unfilled dots are rings in o.off, drawn on over o.ring(i) 0..1 (default: there).
  // A small honest chart, never a count-up.
  function dots(x, y, n, r, gap, fill, o = {}) {
    const cols = o.cols || n, lw = o.lw || Math.max(2, r * .14);
    for (let i = 0; i < n; i++) { const cx = x + (i % cols) * (2 * r + gap) + r, cy = y + Math.floor(i / cols) * (2 * r + gap) + r, k = clamp(fill(i), 0, 1.2), g = o.ring ? clamp(o.ring(i)) : 1;
      if (g > 0) { CX.lineWidth = lw; CX.strokeStyle = o.off || C.ink; CX.beginPath(); CX.arc(cx, cy, r - lw / 2, -Math.PI / 2, -Math.PI / 2 + TAU * g); CX.stroke(); }
      if (k > 0) { CX.fillStyle = o.on || C.ink; CX.beginPath(); CX.arc(cx, cy, r * k, 0, TAU); CX.fill(); } }
  }

  // ---------- paper ----------
  // page(col): the sheet. finish(): a fixed paper texture (mottling and tooth) multiplied over everything (paper
  // doesn't move) and a whisper of grain. Call finish() last in a shot, or register it once with post(ED.finish).
  let _tex = null;
  function texture() {
    if (_tex) return _tex; const w = 960, h = 540, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), id = g.createImageData(w, h), r = rnd('paper');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cloud = noise2(x * .012, y * .012, 7) * .6 + noise2(x * .05, y * .05, 3) * .4, tooth = r() - .5;   // mottling and tooth
      const v = 255 - Math.max(0, cloud * 9 + tooth * 9 + 5), i = (y * w + x) * 4; id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v - 1; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); return (_tex = c);
  }
  const page = (col = C.paper) => bg(col);
  function finish(amount = S.texture) {
    if (amount > 0) { CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalCompositeOperation = 'multiply'; CX.globalAlpha = amount; CX.imageSmoothingQuality = 'high'; CX.drawImage(texture(), 0, 0, W, H); CX.restore(); }
    if (S.grain > 0) grain(S.grain);
  }

  // ---------- the motif: a wren ----------
  // drawn facing right, feet at the origin, about 1 unit tall; points are [x, y, sharp]
  const WREN = [[.86, -.665, 1], [.62, -.765, 1], [.56, -.835], [.40, -.905], [.20, -.87], [-.04, -.775], [-.27, -.60],
    [-.47, -.90, 0, 't'], [-.55, -1.03, 0, 't'], [-.65, -1.0, 0, 't'], [-.53, -.60, 0, 't'], [-.41, -.42], [-.13, -.21], [.22, -.215], [.48, -.36], [.585, -.56], [.62, -.655, 1]];
  const TAILP = [-.33, -.6];
  // a smooth closed path through points (Catmull-Rom as Beziers); points flagged sharp are corners
  function smoothPath(pts) {
    const n = pts.length; CX.beginPath(); CX.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n], k1 = p1[2] ? 0 : 1 / 6, k2 = p2[2] ? 0 : 1 / 6;
      CX.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1, p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2, p2[0], p2[1]);
    }
    CX.closePath();
  }
  // wren(x, y, s, pose, o): the silhouette at feet (x, y), s px tall. pose: { face (-1..1, through 0 while turning),
  // crouch 0..1, stretch 0..1 (take-off), tilt (rad), wing (null = folded, else radians: .1 up, -2.15 down),
  // tuck 0..1 (legs folded in flight), tail (rad: + cocks it up, - lowers it) }. o: { color, eye (knock-out colour, or false) }.
  function wren(x, y, s, pose = {}, o = {}) {
    const col = o.color || C.ink, face = pose.face ?? 1, cr = clamp(pose.crouch || 0), stc = clamp(pose.stretch || 0), tuck = clamp(pose.tuck || 0);
    CX.save(); CX.translate(x, y); CX.scale(s, s);
    CX.translate(.1, -.5); CX.rotate((pose.tilt || 0) * Math.sign(face || 1)); CX.translate(-.1, .5);
    CX.scale(face * (1 + .1 * cr - .06 * stc), 1 - .2 * cr + .12 * stc);
    const lift = lerp(0, .1, tuck);   // legs fold: the body sits a little lower on them
    CX.fillStyle = col; CX.strokeStyle = col;
    // legs: two thin shanks and a toe line; folded back in flight
    CX.lineWidth = .042; CX.lineCap = 'round';
    for (const lx of [.02, .17]) { const kx = lx + lerp(0, -.2, tuck), ky = lerp(0, -.12, tuck); CX.beginPath(); CX.moveTo(lx + .04, -.24 + lift); CX.lineTo(kx, ky - .021); CX.lineTo(kx + lerp(.12, .02, tuck), ky - .021 + lerp(0, .02, tuck)); CX.stroke(); }
    // wing (in flight only), drawn behind the body: a blade from the shoulder
    const wingAt = a => { CX.save(); CX.translate(.08, -.70 + lift); CX.rotate(a);
      CX.beginPath(); CX.moveTo(.09, .04); CX.bezierCurveTo(.1, -.26, -.06, -.56, -.32, -.74); CX.lineTo(-.36, -.66); CX.lineTo(-.41, -.68); CX.lineTo(-.43, -.58);
      CX.bezierCurveTo(-.44, -.38, -.36, -.16, -.24, .08); CX.closePath(); CX.fill(); CX.restore(); };
    // body: the tail rotates about the rump (a flick), the rest is fixed
    const ta = pose.tail || 0, ct = Math.cos(ta), st = Math.sin(ta);   // + cocks the tail up, - lowers it
    const pts = WREN.map(([px, py, sh, tag]) => { let X = px, Y = py + lift; if (tag === 't') { const dx = px - TAILP[0], dy = py - TAILP[1]; X = TAILP[0] + dx * ct - dy * st; Y = TAILP[1] + dx * st + dy * ct + lift; } return [X, Y, sh]; });
    smoothPath(pts); CX.fill();
    if (pose.wing != null) wingAt(pose.wing);
    if (o.eye !== false) { CX.fillStyle = o.eye || C.paper; CX.beginPath(); CX.arc(.445, -.745 + lift, .045, 0, TAU); CX.fill(); }
    CX.restore();
  }

  // ---------- hops ----------
  // hop(t, path, o) -> { x, y, pose, flying, seg }: where the motif is at time t. path is a list of perches
  // { t, at, arc, flap, looks, face }: the motif LANDS on perch i at t (exactly: put it on a beat), stays there until
  // it takes off for the next one, and flies a parabola of height arc (default from the distance) on an eased path.
  // at is [x, y] or a function of t (a perch that moves: a rule sliding, a letter rising). The take-off is preceded
  // by a crouch (.14 s); the landing squashes (kick) and settles. looks: [t, ...] times the motif turns its head
  // round while perched (a quick flip of facing, a sign of life on a beat). flap: true opens the wings (default when
  // the hop is long). face: facing on this perch (default: the direction it came from). dur: flight time.
  // A hop that lands where it took off (under 30 px across) is a jump-turn: it turns round in the air, upright,
  // and lands facing the other way (or as face says).
  const pos = (at, t) => typeof at === 'function' ? at(t) : at;
  function flightDur(A, B) { return clamp(.26 + Math.hypot(B[0] - A[0], B[1] - A[1]) / 2600, .3, .62); }
  const JUMP = 30;
  function hop(t, path, o = {}) {
    let i = 0; while (i + 1 < path.length && t >= path[i + 1].t) i++;
    const cur = path[i], nxt = path[i + 1], crouchT = o.crouch ?? .14;
    const takeoff = j => { const n = path[j + 1], B = pos(n.at, n.t), A = pos(path[j].at, Math.max(path[j].t, n.t - .6)); return n.t - (n.dur ?? flightDur(A, B)); };
    const across = j => pos(path[j].at, path[j].t)[0] - pos(path[j - 1].at, path[j].t - .5)[0];
    // facing on each perch: given, or the direction of the hop that brought it there (turned round after a jump-turn)
    const faceOn = j => path[j].face ?? (j === 0 ? 1 : Math.abs(across(j)) >= JUMP ? Math.sign(across(j)) : -turned(takeoff(j - 1), path[j - 1], faceOn(j - 1), null));
    if (nxt) {
      const B1 = pos(nxt.at, nxt.t), A0 = pos(cur.at, Math.max(cur.t, nxt.t - .6)), d = nxt.dur ?? flightDur(A0, B1), t0 = nxt.t - d;
      const inPlace = Math.abs(B1[0] - A0[0]) < JUMP;
      if (t >= t0) {   // in the air
        const A = pos(cur.at, t0), B = pos(nxt.at, t), u = (t - t0) / d, dist = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const arc = nxt.arc ?? clamp(dist * .32, 60, 260), ex = EASE.inOut(u) * .35 + u * .65, x = lerp(A[0], B[0], ex);
        const y = lerp(A[1], B[1], ex) - arc * 4 * u * (1 - u);
        const vx = (B[0] - A[0]) / d, vy = (B[1] - A[1]) / d - arc * 4 * (1 - 2 * u) / d;
        const face = inPlace ? lerp(turned(t0, cur, faceOn(i), null), faceOn(i + 1), EASE.inOut(seg(u, .38, .62))) : Math.sign(B[0] - A[0]) || faceOn(i);
        const flap = nxt.flap ?? dist > 260;
        const beat = flap ? lerp(.12, -2.15, .5 + .5 * Math.sin((t - t0) * TAU * (o.flapHz ?? 6.5) - Math.PI / 2)) : lerp(-1.2, -.45, Math.sin(Math.PI * u));
        const wing = lerp(beat, -1.35, EASE.inOut(seg(u, .78, .95)));   // wings flare back to brake for the landing
        // in the air the tail trails flat (lowered), so a raised wing never pairs with a cocked tail into two spikes
        const trail = -.95 * Math.min(clamp(u * 6), clamp((1 - u) * 5));
        return { x, y, flying: true, seg: i, pose: { face, tilt: inPlace ? 0 : clamp(Math.atan2(vy, Math.abs(vx)) * .55, -.6, .6), wing, tuck: Math.sin(Math.PI * clamp(u * 1.4)), stretch: u < .25 ? (1 - u * 4) * .6 : 0, tail: trail } };
      }
      // perched, crouching for the take-off (turning first toward where it is going, unless it is a jump-turn)
      const A = pos(cur.at, t), face = turned(t, cur, faceOn(i), inPlace ? null : Math.sign(B1[0] - A[0]) || faceOn(i), t0 - crouchT - .1);
      const land = landing(t, cur.t, i > 0), cr = Math.max(land.crouch, EASE.inOut(seg(t, t0 - crouchT, t0)));
      return { x: A[0], y: A[1], flying: false, seg: i, pose: { face, crouch: cr, stretch: land.stretch, tail: tailFlick(t, cur) } };
    }
    const A = pos(cur.at, t), land = landing(t, cur.t, i > 0);
    return { x: A[0], y: A[1], flying: false, seg: i, pose: { face: turned(t, cur, faceOn(i), null), crouch: land.crouch, stretch: land.stretch, tail: tailFlick(t, cur) } };
  }
  // the squash on landing (a kick that decays) and a small rebound stretch
  function landing(t, tl, real) { if (!real || t < tl) return { crouch: 0, stretch: 0 }; const k = kick(t, tl, { attack: 1 / 60, tau: .09 }); return { crouch: k * .8, stretch: Math.max(0, Math.sin(clamp((t - tl - .1) / .2) * Math.PI)) * .15 }; }
  // facing while perched: the base facing, flipped at each look time, and turned toward the next hop before it
  function turned(t, cur, base, toward, tTurn) {
    let f = base, face = base;
    for (const lt of cur.looks || []) { const k = EASE.inOut(seg(t, lt, lt + .09)); if (k > 0) { face = lerp(f, -f, k); if (k >= 1) f = -f; } }
    if (toward != null && toward !== f) { const k = EASE.inOut(seg(t, tTurn, tTurn + .09)); if (k > 0) face = lerp(f, toward, k); }
    return face;
  }
  // a tail flick on each look and once soon after landing
  function tailFlick(t, cur) { let a = kick(t, cur.t + .18, { tau: .12 }) * .35; for (const lt of cur.looks || []) a = Math.max(a, kick(t, lt + .05, { tau: .12 }) * .3); return a; }
  // motif(t, path, s, o): hop + draw (o.draw replaces the wren with any drawable (x, y, s, pose, o))
  function motif(t, path, s, o = {}) { const h = hop(t, path, o); (o.draw || wren)(h.x, h.y, s, h.pose, o); return h; }

  return { S, C, PALETTES, grid, showGrid, track, setLine, fit, inkTop, perch, FEET, headline, wipe, sweep, pull, pages, rule, rectSpring,
    within, knockout, once, dots, texture, page, finish, wren, hop, motif, smoothPath };
})();
