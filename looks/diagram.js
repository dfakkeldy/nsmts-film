// looks/diagram.js: flat illustrated explainer diagrams on one neo-brutalist stage. Boxes with thick black outlines and
// hard offset shadows on a cream dot grid, flat fills in four colours, elbow connectors, messages that travel along them
// (and sometimes fall off), timer rings that run out, rubber stamps that slam onto a box when its state changes, and a
// numbered step bar that carries the teaching structure (the setup, the obvious fix, why it fails, the mechanism, the
// trade-off). Card: looks/diagram.md. Specimen: specimens/diagram.
//
// A film is one stage and one cast. Lay the cast out on the grid (DIA.cell, DIA.pin), route the wires between ports
// (DIA.elbow), then draw every frame in this order, which IS the layering: DIA.paper() inside the camera, wires, nodes,
// packets, stamps; DIA.caption() after the camera is restored. Nodes never travel: they pop in, press into their shadow
// when a message lands, and change state in place (a status tag, a live light, a row added or struck, a hatch).

const DIA = (() => {
  const S = Object.assign({
    paper: '#F3EEE3', dot: '#D2C8B3', ink: '#161412', white: '#FFFCF5', mute: '#6E665A',
    butter: '#FFD35A', sky: '#8DCDF4', mint: '#83DCA8', coral: '#FF6A55',
    lw: 5, shadow: 10, r: 12, u: 60, dots: 30, header: 66,
    font: 'IBM Plex Mono', display: 'Barlow Condensed',
  }, P.diagram || {});
  const POP = { stiffness: 260, damping: 15, mass: 1 };   // pop-in: about 18% overshoot, settled in about .5 s
  const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);

  // ---------- type ----------
  // say(id, str, x, y, o): text in the diagram face (IBM Plex Mono Bold, ink, 30 px); big(...) in the display face
  // (Barlow Condensed Black caps). Both register through draw.js text(), so pass an id for anything a viewer must read.
  const say = (id, s, x, y, o = {}) => text(id, s, x, y, { family: S.font, weight: 700, color: S.ink, size: 30, ...o });
  const big = (id, s, x, y, o = {}) => text(id, s, x, y, { family: S.display, weight: 900, color: S.ink, size: 60, tracking: 1, ...o });
  const wOf = (s, o = {}) => measure(s, { family: S.font, weight: 700, size: 30, ...o });

  // ---------- layout: a grid in world units (S.u, default 60 px: 32 x 18 cells at 1080p) ----------
  // at(c, r) -> [x, y] of a grid point; cell(c, r, w, h) -> a box { x, y, w, h } in grid cells;
  // pin(box, side, n) -> the point where grid line n meets a side ('l'/'r' take a row line, 't'/'b' a column line);
  // port(box, side, k) -> the point a fraction k along a side.
  const at = (c, r) => [c * S.u, r * S.u];
  const cell = (c, r, w, h) => ({ x: c * S.u, y: r * S.u, w: w * S.u, h: h * S.u });
  function pin(b, side, n) { const v = n * S.u; return side === 'l' ? [b.x, v] : side === 'r' ? [b.x + b.w, v] : side === 't' ? [v, b.y] : [v, b.y + b.h]; }
  function port(b, side, k = .5) { return side === 'l' ? [b.x, b.y + b.h * k] : side === 'r' ? [b.x + b.w, b.y + b.h * k] : side === 't' ? [b.x + b.w * k, b.y] : [b.x + b.w * k, b.y + b.h]; }

  // ---------- routes ----------
  // elbow(a, b, o): an orthogonal route between two points. o.via: 'x' (leave horizontally, turn at x = o.at, default
  // halfway, arrive horizontally), 'y' (the same turned on its side), 'hv' or 'vh' (one corner).
  function elbow(a, b, o = {}) {
    const via = o.via || 'x'; let pts;
    if (via === 'x') { const x = o.at ?? (a[0] + b[0]) / 2; pts = [a, [x, a[1]], [x, b[1]], b]; }
    else if (via === 'y') { const y = o.at ?? (a[1] + b[1]) / 2; pts = [a, [a[0], y], [b[0], y], b]; }
    else if (via === 'hv') pts = [a, [b[0], a[1]], b];
    else pts = [a, [a[0], b[1]], b];
    return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > .5);
  }
  const _L = new WeakMap();
  function lengths(pts) { if (_L.has(pts)) return _L.get(pts); const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); _L.set(pts, L); return L; }
  // along(pts, p) -> [x, y, angle]: the point at arc-length fraction p of a polyline, and the direction there
  function along(pts, p) {
    const L = lengths(pts), want = L[L.length - 1] * clamp(p);
    for (let i = 1; i < pts.length; i++) if (L[i] >= want - 1e-9 || i === pts.length - 1) {
      const k = clamp((want - L[i - 1]) / ((L[i] - L[i - 1]) || 1)), [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return [lerp(x0, x1, k), lerp(y0, y1, k), Math.atan2(y1 - y0, x1 - x0)];
    }
    return [pts[0][0], pts[0][1], 0];
  }
  // cut(pts, p0, p1): the part of a polyline between arc-length fractions p0 and p1
  function cut(pts, p0, p1) {
    const L = lengths(pts), T = L[L.length - 1], a = T * clamp(p0), b = T * clamp(p1), out = [along(pts, p0).slice(0, 2)];
    for (let i = 1; i < pts.length - 1; i++) if (L[i] > a && L[i] < b) out.push(pts[i]);
    out.push(along(pts, p1).slice(0, 2)); return out;
  }
  // a polyline path with rounded corners
  function roundPath(pts, r) {
    CX.beginPath(); CX.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      CX.arcTo(x1, y1, x2, y2, Math.max(0, Math.min(r, Math.hypot(x1 - x0, y1 - y0) / 2, Math.hypot(x2 - x1, y2 - y1) / 2))); }
    CX.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }
  function arrowHead(x, y, a, s = 20, col = S.ink) {
    CX.save(); CX.translate(x, y); CX.rotate(a); CX.beginPath(); CX.moveTo(2, 0); CX.lineTo(-s, -s * .62); CX.lineTo(-s * .78, 0); CX.lineTo(-s, s * .62); CX.closePath();
    CX.fillStyle = col; CX.fill(); CX.lineJoin = 'round'; CX.lineWidth = 2; CX.strokeStyle = col; CX.stroke(); CX.restore();
  }
  // wire(pts, o): a connector. o.p: how much is drawn (0..1, for a draw-on; default 1; the arrowhead rides the tip),
  // o.head: 'end' (default), 'both' or 'none', o.dash: true for a dashed line (a lookup, an async call) that marches
  // at o.speed px/s while o.t is given, o.col, o.lw, o.alpha, o.r (corner radius, default 18).
  function wire(pts, o = {}) {
    const p = o.p ?? 1; if (p <= .001) return;
    const head = o.head ?? 'end', hs = o.headSize || 20, L = lengths(pts), tot = L[L.length - 1];
    // stop the line short of each head so its round cap doesn't poke through the point
    const p0 = head === 'both' ? Math.min(p, hs * .7 / tot) : 0, p1 = head === 'none' ? p : Math.max(p0, p - hs * .7 / tot * clamp(p * 4));
    CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha;
    roundPath(cut(pts, p0, p1), o.r ?? 18); CX.lineWidth = o.lw || S.lw; CX.strokeStyle = o.col || S.ink; CX.lineCap = 'round'; CX.lineJoin = 'round';
    if (o.dash) { CX.setLineDash(o.dash === true ? [16, 13] : o.dash); CX.lineDashOffset = -(o.t || 0) * (o.speed ?? 50); }
    CX.stroke(); CX.setLineDash([]);
    if (head !== 'none') { const [x, y, a] = along(pts, p); arrowHead(x, y, a, hs, o.col || S.ink); }
    if (head === 'both' && p >= 1) { const [x, y, a] = along(pts, 0); arrowHead(x, y, a + Math.PI, hs, o.col || S.ink); }
    CX.restore();
  }

  // ---------- the stage ----------
  // paper(): the cream sheet and its dot grid. Call it inside the camera so the grid moves with the diagram; only the
  // dots in view are drawn, so any zoom works.
  function paper() {
    bg(S.paper);
    const M = CX.getTransform().inverse(), a = M.transformPoint(new DOMPoint(0, 0)), c = M.transformPoint(new DOMPoint(W, H)), s = S.dots, r = 2.2;
    const x0 = Math.floor(Math.min(a.x, c.x) / s) * s, x1 = Math.max(a.x, c.x), y0 = Math.floor(Math.min(a.y, c.y) / s) * s, y1 = Math.max(a.y, c.y);
    CX.beginPath(); for (let y = y0; y <= y1 + s; y += s) for (let x = x0; x <= x1 + s; x += s) { CX.moveTo(x + r, y); CX.arc(x, y, r, 0, TAU); }
    CX.fillStyle = S.dot; CX.fill();
  }
  // view(t, keys, spec): the camera [cx, cy, zoom] from keys [[t, [cx, cy, zoom], spring?], ...] on follow(); zoom rides
  // in log space so a push-in and a pull-out feel the same. Apply it with cam(...view(t, KEYS)) inside CX.save().
  function view(t, keys, spec = 'smooth') { const v = follow(t, keys.map(k => [k[0], [k[1][0], k[1][1], Math.log(k[1][2])], k[2]]), spec); return [v[0], v[1], Math.exp(v[2])]; }

  // ---------- small parts ----------
  // tag(id, str, x, y, o): a small outlined label, vertically centred on y. o: fill (default white), dot (a status light
  // colour), align ('left' | 'right' | 'center'), size (default 28). Returns its box.
  function tag(id, str, x, y, o = {}) {
    const size = o.size || 28, pad = size * .42, dotW = o.dot ? size * .78 : 0, w = wOf(str, { size }) + pad * 2 + dotW, h = size * 1.45;
    const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    CX.save(); rr(x0, y - h / 2, w, h, 6); CX.fillStyle = o.fill || S.white; CX.fill(); CX.lineWidth = o.lw || 3; CX.strokeStyle = S.ink; CX.stroke();
    if (o.dot) circle(x0 + pad + size * .24, y, size * .22, o.dot, { stroke: S.ink, lw: 2.5 });
    say(id, str, x0 + pad + dotW, y + size * .36, { size, color: o.color || S.ink }); CX.restore();
    return { x: x0, y: y - h / 2, w, h };
  }
  // hatch(x, y, w, h, o): diagonal stripes (a node that is down, a row that is wrong). o: col, alpha, lw, gap, r
  function hatch(x, y, w, h, o = {}) {
    CX.save(); rr(x, y, w, h, o.r ?? 0); CX.clip(); CX.globalAlpha *= o.alpha ?? 1; CX.strokeStyle = o.col || S.coral; CX.lineWidth = o.lw || 7;
    const g = o.gap || 20; CX.beginPath(); for (let i = -h; i < w + h; i += g) { CX.moveTo(x + i, y + h); CX.lineTo(x + i + h, y); } CX.stroke(); CX.restore();
  }
  // cross / tick: outlined marks drawn as strokes (no glyphs), k 0..1 draws them on
  function cross(x, y, s, k = 1, col = S.coral) {
    if (k <= 0) return; const d = s / 2, a = [[x - d, y - d], [x + d, y + d]], b = [[x + d, y - d], [x - d, y + d]];
    for (const [lw, c] of [[s * .34, S.ink], [s * .2, col]]) { lineTo(a, clamp(k * 2), c, lw); lineTo(b, clamp(k * 2 - 1), c, lw); }
  }
  function tick(x, y, s, k = 1, col = S.mint) {
    if (k <= 0) return; const pts = [[x - s * .5, y], [x - s * .14, y + s * .36], [x + s * .5, y - s * .36]];
    lineTo(pts, k, S.ink, s * .3); lineTo(pts, k, col, s * .16);
  }
  // led(x, y, col, t): a status light that blinks on the beat (kit.js pulse), so a held frame is never dead
  function led(x, y, col, t, r = 9) { const p = pulse(t, 3.5); circle(x, y, r + 3 + 2 * p, S.ink); circle(x, y, r + 2 * p, mixCol(col, S.white, .55 * p)); }

  // ---------- nodes ----------
  // node(b, o): a box on the stage. b = { x, y, w, h } (world units; cell() makes one on the grid). o: label, id, fill,
  // t (time), at (pop-in time: springs in with overshoot), hits [times: it presses into its shadow as a message lands],
  // shakes [times: a short horizontal shudder], status [[t, text, colour], ...] (a tag in the header that swaps at each
  // time; text null hides it; ids are '~' because a status tag is glanceable), led (a live light's colour, or
  // [[t, colour], ...]), hatch (0..1: coral stripes over the card, for a node that is down), panel (false: no inner
  // panel), draw(inner, t, live): the content, clipped to the inner panel; head(hdr, t, live): extra header content
  // (a count()), hdr = { x, y, w, h } of the header band; read (default true; false while the camera has left the
  // node behind: none of its text registers, so --inspect doesn't flag labels at the frame edge). Returns the box as
  // drawn, with .inner, or null before it pops in.
  function node(b, o = {}) {
    const t = o.t ?? 0, k = o.at == null ? 1 : springStep(t - o.at, POP);
    if (k <= .04) return null;   // a box a few pixels wide reads as a speck, not a pop
    const press = clamp(sum(o.hits || [], h => kick(t, h, { tau: .1 }))) * S.shadow * .75;
    const shx = sum(o.shakes || [], s => { const d = t - s; return d < 0 ? 0 : 9 * Math.sin(d * TAU * 13) * Math.exp(-d / .09); });
    const x = b.x + press + shx, y = b.y + press, cx = b.x + b.w / 2, cy = b.y + b.h / 2, hh = o.header ?? S.header;
    CX.save(); CX.translate(cx, cy); CX.scale(k, k); CX.translate(-cx, -cy); CX.globalAlpha *= clamp(k * 4);
    rr(b.x + S.shadow, b.y + S.shadow, b.w, b.h, S.r); CX.fillStyle = S.ink; CX.fill();
    rr(x, y, b.w, b.h, S.r); CX.fillStyle = o.fill || S.white; CX.fill(); CX.lineWidth = S.lw; CX.strokeStyle = S.ink; CX.stroke();
    // register text once the pop has settled. Timed, not read off the spring: POP overshoots about 18% and then dips
    // to about .963 at .44 s, so a test on its value registers, drops and registers again. By .55 s it is within 1%.
    const read = o.read !== false, live = read && (o.at == null || t - o.at > .55);
    if (o.label) say(live ? (o.id || `node:${o.label}`) : null, o.label, x + 24, y + hh / 2 + 12, { size: 30, tracking: 1 });
    if (o.led) { const col = Array.isArray(o.led) ? o.led.filter(e => e[0] <= t).pop()?.[1] ?? o.led[0][1] : o.led; led(x + b.w - 30, y + hh / 2 + 2, col, t); }
    if (o.status) statusTag(o.status, t, x + b.w - 16, y + hh / 2 + 2, read ? (o.id || o.label) : null);
    if (o.head) o.head({ x, y, w: b.w, h: hh }, t, live);
    const inner = { x: x + 16, y: y + hh, w: b.w - 32, h: b.h - hh - 16 };
    if (o.panel !== false) { rr(inner.x, inner.y, inner.w, inner.h, 8); CX.fillStyle = S.white; CX.fill(); CX.lineWidth = 4; CX.strokeStyle = S.ink; CX.stroke(); }
    if (o.draw) { CX.save(); rr(inner.x, inner.y, inner.w, inner.h, 8); CX.clip(); o.draw(inner, t, live); CX.restore(); }
    if (o.hatch > 0) hatch(x, y, b.w, b.h, { r: S.r, alpha: o.hatch * .85 });
    CX.restore();
    return { x, y, w: b.w, h: b.h, inner, k };
  }
  function statusTag(list, t, x, y, id) {
    let i = -1; while (i + 1 < list.length && t >= list[i + 1][0]) i++;
    if (i < 0) return;
    const cur = list[i], prev = list[i - 1], p = seg(t, cur[0], cur[0] + .28);
    const draw = e => () => e && e[1] && tag(id == null ? null : `~status:${id}`, e[1], x, y, { dot: e[2], align: 'right' });
    if (p < 1) swap(p, draw(prev), draw(cur), { blur: 8, lift: 6 }); else draw(cur)();
  }

  // ---------- lists (a ledger, a table, a queue) ----------
  // list(box, items, t, o): rows stacked in a panel. Each item { t, cells, fill, id, strike, flash, hatch }: it slides in
  // at t; cells are [{ s, x (px from the row's left, or 'right'), size, tag (a fill colour: drawn as a tag), at (a later
  // time it appears) }]; strike (a time): an ink line strikes it out and the row collapses, closing the gap;
  // flash (a time): it lights up (a lookup found it). o.order 'prepend' puts the newest on top: it slides down from
  // under the top edge of the box (clipped to it) while the rows below move down by the same amount, so the stack
  // moves like a conveyor and no two rows overlap; o.rowH (default 56), o.gap, o.pad, o.size (type, default 34),
  // o.top (offset of the first row), o.live (false: register nothing; pass a node's live flag through).
  function list(box, items, t, o = {}) {
    const rowH = o.rowH || 56, gap = o.gap ?? 10, pad = o.pad ?? 14, size = o.size || 34, pre = o.order === 'prepend';
    let y = box.y + (o.top ?? pad);
    if (pre) { CX.save(); CX.beginPath(); CX.rect(box.x, box.y, box.w, box.h); CX.clip(); }
    for (const it of pre ? items.slice().reverse() : items) {
      if (t < it.t) continue;
      const kin = EASE.outExpo(seg(t, it.t, it.t + .42)), kout = it.strike != null ? EASE.inOut(seg(t, it.strike + .3, it.strike + .62)) : 0;
      const slot = (rowH + gap) * (pre ? kin : 1) * (1 - kout), h = rowH * (1 - kout);
      if (kout < .999) {
        const rx = box.x + pad - (pre ? 0 : (1 - kin) * 46), rw = box.w - pad * 2, ry = y + (rowH - h) / 2 - (pre ? (1 - kin) * (rowH + gap) : 0);
        const live = o.live !== false && kin > .9 && kout < .05 && ry >= box.y - 1 && ry + h <= box.y + box.h + 1;
        CX.save(); CX.globalAlpha *= clamp(kin * (pre ? 4 : 2)) * (1 - kout);
        const fl = it.flash != null ? kick(t, it.flash, { tau: .35 }) : 0;
        rr(rx, ry, rw, h, 6); CX.fillStyle = mixCol(it.fill || S.white, S.mint, fl); CX.fill();
        if (it.hatch) hatch(rx, ry, rw, h, { r: 6, col: it.hatch, alpha: .35, lw: 6, gap: 18 });
        CX.lineWidth = 3 + 2 * fl; CX.strokeStyle = S.ink; rr(rx, ry, rw, h, 6); CX.stroke();
        CX.save(); CX.translate(0, ry + h / 2); CX.scale(1, Math.max(.01, 1 - kout)); CX.translate(0, -(ry + h / 2));
        (it.cells || []).forEach((c, j) => {
          const ca = c.at == null ? 1 : backOut(seg(t, c.at, c.at + .3));
          if (ca <= 0) return;
          const id = live && (c.at == null || t > c.at + .3) ? (c.id || `${it.id || 'row'}:${j}`) : null, cs = c.size || size;
          if (c.tag) { const ts = Math.max(28, cs * .82), tw = wOf(c.s, { size: ts }) + ts * .84; const tx = c.x === 'right' ? rx + rw - 12 - tw : rx + c.x;
            CX.save(); CX.translate(tx + tw / 2, ry + rowH / 2); CX.scale(ca, ca); CX.translate(-(tx + tw / 2), -(ry + rowH / 2)); tag(id, c.s, tx, ry + rowH / 2, { fill: c.tag, size: ts }); CX.restore(); }
          else { const tx = c.x === 'right' ? rx + rw - 18 : rx + 18 + c.x; say(id, c.s, tx, ry + rowH / 2 + cs * .36, { size: cs, align: c.x === 'right' ? 'right' : 'left', color: c.col || S.ink, alpha: clamp(ca) }); }
        });
        CX.restore();
        if (it.strike != null && t >= it.strike) lineTo([[rx - 6, ry + h / 2], [rx + rw + 6, ry + h / 2]], EASE.outExpo(seg(t, it.strike, it.strike + .22)), S.ink, 7);
        CX.restore();
      }
      y += slot;
    }
    if (pre) CX.restore();
  }

  // ---------- messages ----------
  // packet(pts, t, t0, t1, o): a message travelling the route pts from t0 to t1 on EASE.inOut, drawn over the wires.
  // It pops out of the sender and leaves a short coloured trace on the wire. o: label (registered '~': it moves too
  // fast to read, so say what it carries elsewhere too), fill (the sender's colour), key (a second label on a mint
  // tab: an id the message carries), dot: true (a plain dot, no label), into: the receiving box: the message carries
  // on through its wall as if through a slot (clipped to outside the box) and is fully in at t1; without into it
  // shrinks into the route's end after t1. lost: a time at which it hops off the wire (o.hop px/s up, default 620:
  // about 60 px), drifts sideways (o.drift px/s), spins and falls out of frame; draw a cross() where it was lost.
  // Returns { x, y, k } or null when it isn't on screen.
  function extend(pts, d) {
    const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [...pts, [b[0] + (b[0] - a[0]) / l * d, b[1] + (b[1] - a[1]) / l * d]];
  }
  function packet(pts, t, t0, t1, o = {}) {
    if (t < t0) return null;
    const size = o.size || 28, lw_ = o.dot ? 0 : wOf(o.label || '', { size }), w = lw_ + size * 1.1, h = size * 1.7;
    const kw = o.key ? wOf(o.key, { size }) + size * .9 : 0, half = o.dot ? 19 : (w + kw) / 2 + 5;
    const into = o.into, lost = o.lost != null && t > o.lost;
    if (into && t >= t1 && !lost) return null;
    const route = into ? extend(pts, half + S.lw) : pts, P_ = tt => along(route, EASE.inOut(seg(tt, t0, t1)));
    let [x, y] = P_(Math.min(t, o.lost ?? t)), rot = 0, alpha = 1, s = .35 + .65 * springStep(t - t0, 'snappy');
    if (lost) {
      const d = t - o.lost, a = P_(o.lost), b = P_(o.lost - 1 / 60), vx = (a[0] - b[0]) * 60 * .2 + (o.drift ?? 0), vy = -(o.hop ?? 620);
      x = a[0] + vx * d; y = a[1] + vy * d + .5 * 3800 * d * d; rot = (Math.sign(vx) || 1) * 5 * d; alpha = 1 - seg(d, .75, .95);   // out of frame before it fades
      if (alpha <= 0) return null;
    } else if (!into && t > t1) { s *= 1 - EASE.exit(seg(t, t1, t1 + .1)); if (s <= .02) return null; }
    CX.save();
    if (into && !lost) { CX.beginPath(); CX.rect(-1e5, -1e5, 2e5, 2e5); CX.rect(into.x - S.lw / 2, into.y - S.lw / 2, into.w + S.lw, into.h + S.lw); CX.clip('evenodd'); }
    // the trace: the stretch of wire it covered in the last .12 s, in its colour
    if (o.trail !== false && !lost) {
      const pa = EASE.inOut(seg(t - .12, t0, t1)), pb = EASE.inOut(seg(Math.min(t, t1), t0, t1));
      if (pb - pa > .004) { const seg_ = cut(route, pa, pb); CX.save(); CX.globalAlpha *= .9 * (1 - seg(t, t1, t1 + .12)); roundPath(seg_, 18); CX.lineCap = 'round'; CX.lineJoin = 'round';
        CX.lineWidth = S.lw + 9; CX.strokeStyle = S.ink; CX.stroke(); CX.lineWidth = S.lw + 3; CX.strokeStyle = o.fill || S.butter; CX.stroke(); CX.restore(); }
    }
    CX.globalAlpha *= alpha; CX.translate(x, y); CX.rotate(rot); CX.scale(s, s);
    if (o.dot) { circle(4, 4, 15, S.ink); circle(0, 0, 15, o.fill || S.mint, { stroke: S.ink, lw: 4 }); CX.restore(); return { x, y, k: s }; }
    const x0 = -(w + kw) / 2;
    rr(x0 + 5, -h / 2 + 5, w + kw, h, 7); CX.fillStyle = S.ink; CX.fill();
    if (o.key) { rr(x0, -h / 2, kw + 10, h, 7); CX.fillStyle = S.mint; CX.fill(); CX.lineWidth = 4; CX.strokeStyle = S.ink; CX.stroke();
      say(null, o.key, x0 + size * .45, size * .36, { size }); }
    rr(x0 + kw, -h / 2, w, h, 7); CX.fillStyle = o.fill || S.butter; CX.fill(); CX.lineWidth = 4; CX.strokeStyle = S.ink; CX.stroke();
    // the label registers only while the whole message is outside its receiver (once it enters the slot it is clipped)
    const Lr = lengths(route), outside = !into || Lr[Lr.length - 1] * (1 - EASE.inOut(seg(t, t0, t1))) > half * 2 + S.lw;
    say(s > .9 && !lost && outside ? `~packet:${o.label}` : null, o.label || '', x0 + kw + size * .55, size * .36, { size });
    CX.restore();
    return { x, y, k: s };
  }

  // ---------- states ----------
  // stamp(id, str, x, y, t, t0, o): a rubber stamp that slams down at t0 (it drops from 1.7x scale on easeIn, so it
  // hits hard, then recoils) and lifts off at o.off. o: fill (default coral), rot (degrees, default -6), size (type,
  // default 64). The text registers once it has landed. Cue a 'thump' or 'hit' at t0.
  function stamp(id, str, x, y, t, t0, o = {}) {
    const fall = .14; if (t < t0 - fall) return;
    const off = o.off ?? Infinity, kl = seg(t, t0 - fall, t0), kf = easeIn(kl);
    let s = lerp(1.7, 1, kf) * (1 - .06 * Math.sin(Math.PI * seg(t, t0, t0 + .14))), a = clamp(kl * 3);
    if (t > off) { const e = EASE.exit(seg(t, off, off + .22)); s *= 1 + .3 * e; a *= 1 - e; }
    if (a <= .01) return;
    const size = o.size || 64, tw = measure(str, { family: S.display, weight: 900, size, tracking: 2 }), w = tw + size * .95, h = size * 1.5, sh = S.shadow * lerp(3, 1, kf);   // high up, its shadow falls further away
    CX.save(); CX.translate(x, y); CX.rotate((o.rot ?? -6) * Math.PI / 180); CX.scale(s, s); CX.globalAlpha *= a;
    CX.save(); CX.globalAlpha *= lerp(.15, 1, kf); rr(-w / 2 + sh, -h / 2 + sh, w, h, 8); CX.fillStyle = S.ink; CX.fill(); CX.restore();
    rr(-w / 2, -h / 2, w, h, 8); CX.fillStyle = o.fill || S.coral; CX.fill(); CX.lineWidth = S.lw; CX.strokeStyle = S.ink; CX.stroke();
    rr(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 4); CX.lineWidth = 2.5; CX.stroke();
    big(kf >= 1 && t < off ? id : null, str, 0, size * .36, { size, align: 'center', tracking: 2 });
    CX.restore();
  }
  // ring(x, y, r, t, t0, dur, o): a timer that drains clockwise from full at t0 to empty at t0 + dur. o.stop: the time
  // it is cancelled (a reply came): it freezes, then refills over .35 s. o.from: its level at t0 (it refills from there
  // first, so a restart after a time-out reads as a reset). o.fill (default butter; coral in the last 15%). Once it
  // runs out it flashes and stays coral. Returns the level left (0..1).
  function ring(x, y, r, t, t0, dur, o = {}) {
    const ref = o.from == null ? 1 : lerp(o.from, 1, EASE.outExpo(seg(t, t0, t0 + .25)));
    let left = t < t0 ? (o.from ?? 1) : clamp(ref - (t - t0) / dur);
    const stopped = o.stop != null && t >= o.stop;
    if (stopped) { const at_ = clamp(1 - (o.stop - t0) / dur); left = lerp(at_, 1, EASE.outExpo(seg(t, o.stop, o.stop + .35))); }
    const out = !stopped && t >= t0 + dur, flash = out ? kick(t, t0 + dur, { tau: .2 }) : 0;
    const col = (left < .15 && t > t0 && !stopped) || out ? S.coral : (o.fill || S.butter);
    circle(x + 4, y + 4, r, S.ink);
    circle(x, y, r * (1 + .12 * flash), out ? mixCol(S.white, S.coral, .35 + .65 * flash) : S.white, { stroke: S.ink, lw: 4 });
    const a0 = -Math.PI / 2 + TAU * (1 - left);
    if (left > .002) { CX.beginPath(); CX.moveTo(x, y); CX.arc(x, y, r - 7, a0, -Math.PI / 2 + TAU); CX.closePath(); CX.fillStyle = col; CX.fill(); CX.lineWidth = 2.5; CX.strokeStyle = S.ink; CX.stroke(); }
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; line([[x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)], [x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7)]], S.ink, 3); }
    circle(x, y, 4.5, S.ink);
    return left;
  }

  // note(id, str, x, y, t, at, o): an annotation card (a rule, a limit, a cost) that pops in at `at`: white, outlined,
  // with a hard shadow, its top-left at (x, y). o.ring: [t0, dur] puts a small timer ring at its left (a lease, an
  // expiry); o.size (type, default 30), o.fill. Returns its box.
  function note(id, str, x, y, t, at_, o = {}) {
    const k = springStep(t - at_, POP); if (k <= .04) return null;
    const size = o.size || 30, rr_ = o.ring ? size * .78 : 0, pad = size * .55, gap = o.ring ? rr_ * 2 + pad * .7 : 0;
    const w = wOf(str, { size }) + pad * 2 + gap, h = Math.max(size * 1.9, rr_ * 2 + pad * 1.1), cx = x + w / 2, cy = y + h / 2;
    CX.save(); CX.translate(cx, cy); CX.scale(k, k); CX.translate(-cx, -cy); CX.globalAlpha *= clamp(k * 4);
    rr(x + 7, y + 7, w, h, 8); CX.fillStyle = S.ink; CX.fill();
    rr(x, y, w, h, 8); CX.fillStyle = o.fill || S.white; CX.fill(); CX.lineWidth = 4; CX.strokeStyle = S.ink; CX.stroke();
    if (o.ring) ring(x + pad + rr_, cy, rr_, t, o.ring[0], o.ring[1]);
    say(t - at_ > .55 ? id : null, str, x + pad + gap, cy + size * .36, { size });   // timed, as in node()
    CX.restore();
    return { x, y, w, h };
  }

  // ---------- gauges: a level and the number that measures it ----------
  // Both take the same keys, so the number moves with the thing it counts (the atlas's "counters tied to the physical
  // change they measure"). keys: [[t, value, spring?], ...] on follow() (key times are when each move STARTS; default
  // spring 'smooth', or o.spring), or, with o.ease (e.g. kit.js linear for a steady drain or pour), on kf() (key times
  // are when each value is REACHED).
  const level = (t, keys, o) => o.ease ? kf(t, keys, o.ease) : follow(t, keys, o.spring || 'smooth');
  // the spans of time over which the value is changing; a hold too short to read a number in (o.hold, default 1.4 s)
  // joins the moves either side of it
  function moving(t, keys, o) {
    const win = [];
    for (let i = 1; i < keys.length; i++) if (keys[i][1] !== keys[i - 1][1])
      win.push(o.ease ? [keys[i - 1][0], keys[i][0]] : [keys[i][0], keys[i][0] + springSettle(keys[i][2] || o.spring || 'smooth')]);
    for (let i = win.length - 1; i > 0; i--) if (win[i][0] - win[i - 1][1] < (o.hold ?? 1.4)) { win[i - 1][1] = Math.max(win[i - 1][1], win[i][1]); win.splice(i, 1); }
    return win.some(([a, b]) => t >= a && t < b);   // a number can't change before its key
  }
  // meter(x, y, w, h, t, keys, o): a bar that fills or drains (a lease running down, a glass filling, a quota), in a
  // white well with an ink outline and a hard shadow; values 0..1. o: fill (default butter), dir ('right', default,
  // fills left to right; 'up' fills bottom to top, like a pour), ticks (marks every 1/ticks, every fifth longer),
  // units (n cells with ink walls: a count of discrete things), limit (a level drawn as a coral line through the bar;
  // past it the fill turns coral), bad ('above', default, or 'below': which side of the limit is wrong), plus
  // spring/ease as above. Returns the level.
  function meter(x, y, w, h, t, keys, o = {}) {
    const v = level(t, keys, o), lv = clamp(v), up = o.dir === 'up', r = Math.min(8, w / 4, h / 4);
    const wrong = o.limit != null && (o.bad === 'below' ? lv < o.limit - 1e-4 : lv > o.limit + 1e-4);
    rr(x + 7, y + 7, w, h, r); CX.fillStyle = S.ink; CX.fill();
    rr(x, y, w, h, r); CX.fillStyle = S.white; CX.fill();
    CX.save(); rr(x, y, w, h, r); CX.clip();
    if (lv > .001) {
      CX.fillStyle = wrong ? S.coral : (o.fill || S.butter);
      if (up) CX.fillRect(x, y + h * (1 - lv), w, h * lv); else CX.fillRect(x, y, w * lv, h);
      CX.fillStyle = S.ink; if (up) CX.fillRect(x, y + h * (1 - lv) - 2, w, 4); else CX.fillRect(x + w * lv - 2, y, 4, h);   // the level's edge
    }
    for (let i = 1; i < (o.units || 0); i++) { const k = i / o.units; line(up ? [[x, y + h * (1 - k)], [x + w, y + h * (1 - k)]] : [[x + w * k, y], [x + w * k, y + h]], S.ink, 3.5, { cap: 'butt' }); }
    for (let i = 1; i < (o.ticks || 0); i++) {
      const k = i / o.ticks, L = (i % 5 ? .18 : .34) * (up ? w : h);
      line(up ? [[x, y + h * (1 - k)], [x + L, y + h * (1 - k)]] : [[x + w * k, y + h], [x + w * k, y + h - L]], S.ink, 3, { cap: 'butt' });
    }
    CX.restore();
    rr(x, y, w, h, r); CX.lineWidth = o.lw || 4; CX.strokeStyle = S.ink; CX.stroke();
    if (o.limit != null) { const k = o.limit, pts = up ? [[x - 12, y + h * (1 - k)], [x + w + 12, y + h * (1 - k)]] : [[x + w * k, y - 12], [x + w * k, y + h + 12]];
      line(pts, S.ink, 10); line(pts, S.coral, 5); }
    return v;
  }
  // count(id, x, y, t, keys, o): the number those keys measure, in the diagram face with y its baseline (or on a tag
  // with o.tag, a fill colour, with y its centre). o: map (value -> number, default the value itself), fmt (number -> string), size (default 36), align,
  // color, plus spring/ease as above. It registers as '~id' while it is changing (and over holds too short to read)
  // and as id once it has settled; pass id null for decoration. Returns the number.
  function count(id, x, y, t, keys, o = {}) {
    const n = Math.round((o.map || (v => v))(level(t, keys, o))), str = (o.fmt || String)(n), size = o.size || 36;
    const rid = id == null ? null : moving(t, keys, o) ? `~${id}` : id;
    if (o.tag) tag(rid, str, x, y, { fill: o.tag, size: Math.max(28, size * .82), align: o.align });
    else say(rid, str, x, y, { size, align: o.align, color: o.color || S.ink });
    return n;
  }

  // ---------- the step bar ----------
  // caption(t, steps, o): the numbered step title in screen space (draw it after the camera is restored). steps:
  // [{ t, n, title, col }] in time order: a square tile with the step number (coloured col) and the title in heavy
  // condensed caps. It slides in at steps[0].t; at each later step the tile flips to the new number and colour, the
  // title swaps in .24 s (a light blur out and in, so the new title is legible almost at once: the viewer reads it
  // exactly then) and the bar's width springs to fit. Keep titles to three or four words (--inspect wants 1 s + 3
  // words a second). o: x, y (top left; default the safe corner), size (type, default 58).
  function caption(t, steps, o = {}) {
    if (!steps.length || t < steps[0].t) return;
    const sr = safeRect(), size = o.size || 58, h = Math.round(size * 1.62), x0 = o.x ?? sr[0], y0 = o.y ?? sr[1] + 8, inset = 12, tile = h - inset * 2;
    let i = 0; while (i + 1 < steps.length && t >= steps[i + 1].t) i++;
    const s = steps[i], prev = steps[i - 1], tw = st => measure(st.title, { family: S.display, weight: 900, size, tracking: 1 });
    const w = follow(t, steps.map(st => [st.t, tile + inset * 2 + 26 + tw(st)]), 'snappy');
    const kin = EASE.outExpo(seg(t, steps[0].t, steps[0].t + .5)), x = x0 - (1 - kin) * 50, y = y0;
    CX.save(); CX.globalAlpha *= clamp(kin * 2.5);
    rr(x + S.shadow, y + S.shadow, w, h, 10); CX.fillStyle = S.ink; CX.fill();
    rr(x, y, w, h, 10); CX.fillStyle = S.white; CX.fill(); CX.lineWidth = S.lw; CX.strokeStyle = S.ink; CX.stroke();
    // the tile flips (squashes to a line and opens again) to the new number and colour
    const pf = prev ? seg(t, s.t, s.t + .32) : 1, show = pf < .5 ? prev : s, sy = Math.abs(Math.cos(Math.PI * pf));
    CX.save(); CX.translate(x + inset + tile / 2, y + h / 2); CX.scale(1, Math.max(.02, sy));
    rr(-tile / 2, -tile / 2, tile, tile, 6); CX.fillStyle = show.col || S.butter; CX.fill(); CX.lineWidth = 4; CX.stroke();
    big(kin > .95 && sy > .9 ? 'step#n' : null, String(show.n), 0, size * .36, { size: size * 1.05, align: 'center' });
    CX.restore();
    // the title, swapped inside the bar
    CX.save(); rr(x, y, w, h, 10); CX.clip();
    const tx = x + inset * 2 + tile + 14, ty = y + h / 2 + size * .36, live = kin > .95;
    const draw = st => () => big(live ? 'step' : null, st.title, tx, ty, { size });
    const p = prev ? seg(t, s.t, s.t + .24) : 1;
    if (p < 1) swap(p, draw(prev), draw(s), { blur: 4, lift: 8 }); else draw(s)();
    CX.restore(); CX.restore();
  }

  return { S, POP, at, cell, pin, port, elbow, along, cut, wire, paper, view, say, big, tag, hatch, cross, tick, led, node, list, packet, stamp, ring, note, meter, count, caption };
})();
