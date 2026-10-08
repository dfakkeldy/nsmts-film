// looks/uimorph.js: "one shape, never cut". A single UI element morphs through states (button, loader, island,
// player, slider, toggle, tabs, chart, command palette, toast): its size, corner radius and colour ride springs, its
// content swaps with a short blur, a cursor drives every change, and the camera zooms so each state fills the frame.
// Card: looks/uimorph.md. Specimen: specimens/uimorph.
//
// A film is a list of STATES, each { t, w, h, r, fill, draw(box, k, t), fit }: from time t the shape heads for w x h with
// corner radius r and colour fill, and draw() paints its content inside box = { x, y, w, h, r } (k is 0..1 entrance
// progress; draw is also called with k = 1 while the state is current). UIM.film(t, STATES, o) draws everything.

const UIM = (() => {
  const S = Object.assign({ canvas: '#ECEAE5', ink: '#0E0E10', paper: '#FFFFFF', mute: '#8C8A86', line: '#D9D6D0', accent: null,
    font: 'Space Grotesk', stroke: 2.5, shadow: 'rgba(14,14,16,.16)' }, P.uimorph || {});
  const ACC = () => S.accent || S.ink;

  // ---------- the shape ----------
  function current(t, states) { let i = 0; while (i + 1 < states.length && t >= states[i + 1].t) i++; return i; }
  function geometry(t, states, spring) { return follow(t, states.map(s => [s.t, [s.w, s.h, s.r], s.spring]), spring); }
  function fillAt(t, states) {
    const i = current(t, states), s = states[i], prev = states[i - 1];
    return prev ? mixCol(prev.fill || S.ink, s.fill || S.ink, ease(seg(t, s.t, s.t + .28))) : (s.fill || S.ink);
  }
  // the camera: frames each state so it fills o.fill of the frame (or the state's own .fit), moving on a smooth spring
  // that starts a little BEFORE the state, so the frame is ready when the shape arrives
  function camera(t, states, o) {
    const lead = o.camLead ?? .08, fill = o.fill ?? .62;
    const z = s => Math.log(Math.min(W * (s.fit || fill) / s.w, H * (s.fit || fill) / s.h, o.maxZoom ?? 2.6));
    return Math.exp(follow(t, states.map(s => [s.t - lead, z(s)]), o.camSpring || 'smooth'));
  }

  // film(t, states, o): the whole frame. o: { at: [x, y] centre (default frame centre), spring (shape, default
  // 'snappy'), swap (content swap seconds, default .3), cursor: a path for cursor(), fill, maxZoom, shadow: false,
  // loop: L (seconds) for a seamless loop: the last state must look like the first, and the previous cycle's states
  // are prepended so every spring is mid-flight at t = 0 exactly as at t = L }
  function film(t, states, o = {}) {
    if (o.loop) states = loopStates(states, o.loop);
    bg(S.canvas);
    const [cx, cy] = o.at || [W / 2, H / 2], [w, h, r] = geometry(t, states, o.spring || 'snappy'), zoom = camera(t, states, o);
    const B = { x: cx - w / 2, y: cy - h / 2, w, h, r };
    CX.save(); cam(cx, cy, zoom);
    // the body: one soft contact shadow, the fill
    CX.save(); if (o.shadow !== false) { CX.shadowColor = S.shadow; CX.shadowBlur = 38 / zoom; CX.shadowOffsetY = 14 / zoom; }
    rr(B.x, B.y, w, h, r); CX.fillStyle = fillAt(t, states); CX.fill(); CX.restore();
    // the content, clipped to the body so nothing spills while it morphs
    const i = current(t, states), s = states[i], prev = states[i - 1], sw = o.swap ?? .3, p = seg(t, s.t, s.t + sw);
    CX.save(); rr(B.x, B.y, w, h, r); CX.clip();
    // each state's content is laid out at its OWN size, centred, and the morphing body clips it: text never grows or
    // shrinks with the container (which made the outgoing tab labels swell into each other mid-morph)
    const own = st => ({ x: cx - st.w / 2, y: cy - st.h / 2, w: st.w, h: st.h, r: st.r });
    if (prev && p < 1) swap(p, () => prev.draw && prev.draw(own(prev), 1, t, zoom), () => s.draw && s.draw(own(s), p, t, zoom), { blur: 10 / Math.sqrt(zoom), lift: 6 });
    else if (s.draw) s.draw(own(s), 1, t, zoom);
    CX.restore();
    if (o.cursor) { const c = cursor(t, o.cursor); if (c.shown > .01) pointer(c, zoom); }
    CX.restore();
    return { box: B, zoom, state: i };
  }
  const _loops = new WeakMap();
  function loopStates(states, L) { if (!_loops.has(states)) _loops.set(states, [...states.map(s => ({ ...s, t: s.t - L })), ...states.slice(1)]); return _loops.get(states); }
  // the pointer in world space, kept the same size on screen whatever the zoom
  function pointer(c, zoom) {
    CX.save(); CX.translate(c.x, c.y); const k = (1 - .14 * c.press) / zoom; CX.scale(k * 1.15, k * 1.15); CX.globalAlpha *= c.shown;
    CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(0, 30); CX.lineTo(7.5, 23); CX.lineTo(13, 35); CX.lineTo(18, 33); CX.lineTo(12.5, 21.5); CX.lineTo(22, 21.5); CX.closePath();
    CX.shadowColor = 'rgba(0,0,0,.25)'; CX.shadowBlur = 6; CX.shadowOffsetY = 2; CX.fillStyle = '#111'; CX.fill();
    CX.shadowColor = 'transparent'; CX.lineWidth = 2; CX.strokeStyle = '#fff'; CX.stroke(); CX.restore();
  }

  // ---------- content helpers (all draw inside box, in world units; sizes scale with box height) ----------
  const T = (id, s, x, y, o = {}) => text(id, s, x, y, { family: S.font, weight: 600, color: S.paper, ...o });
  function label(box, str, o = {}) { T(o.id ?? `label:${str}`, str, box.x + box.w / 2, box.y + box.h / 2 + (o.size || box.h * .3) * .36, { size: o.size || box.h * .3, align: 'center', color: o.color || S.paper, weight: o.weight || 600 }); }
  function iconStroke(col, lw = S.stroke) { CX.lineWidth = lw; CX.strokeStyle = col; CX.lineCap = 'round'; CX.lineJoin = 'round'; }
  // spinner: a 270-degree arc turning at turns/s, fixed stroke
  function spinner(box, t, o = {}) { const R = o.r || box.h * .22, x = box.x + box.w / 2, y = box.y + box.h / 2; CX.save(); iconStroke(o.track || 'rgba(255,255,255,.18)', o.lw || R * .2); CX.beginPath(); CX.arc(x, y, R, 0, TAU); CX.stroke();
    iconStroke(o.color || S.paper, o.lw || R * .2); const a = t * TAU * (o.turns || 1.4); CX.beginPath(); CX.arc(x, y, R, a, a + Math.PI * 1.4); CX.stroke(); CX.restore(); }
  // check: a tick drawn on over p (0..1)
  function check(box, p, o = {}) { const s = o.size || box.h * .42, x = box.x + box.w / 2 - s * .5, y = box.y + box.h / 2;
    CX.save(); iconStroke(o.color || S.paper, o.lw || s * .14); lineTo([[x, y], [x + s * .36, y + s * .34], [x + s, y - s * .4]], EASE.outExpo(p), o.color || S.paper, o.lw || s * .14); CX.restore(); }
  // bars: an audio level meter / waveform of n bars, animated by seeded noise
  function bars(x, y, w, h, t, o = {}) { const n = o.n || 5, gap = w / n, seed = o.seed || 3; CX.save(); CX.fillStyle = o.color || S.paper;
    for (let i = 0; i < n; i++) { const v = o.still ? .5 : .35 + .65 * Math.abs(noise(t * (o.speed || 3.2) + i * 1.7, seed)); const bh = Math.max(gap * .4, h * v); rr(x + i * gap + gap * .2, y + (h - bh) / 2, gap * .6, bh, gap * .3); CX.fill(); } CX.restore(); }
  // a square of artwork: a soft two-colour gradient (or an image) with rounded corners
  function art(x, y, s, o = {}) { CX.save(); rr(x, y, s, s, s * .18); CX.clip();
    if (o.img) CX.drawImage(img(o.img), x, y, s, s); else { const g = CX.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, o.a || '#F2A65A'); g.addColorStop(1, o.b || '#7A5CF0'); CX.fillStyle = g; CX.fillRect(x, y, s, s); }
    CX.restore(); }
  // play / pause that morph into each other: k 0 = play triangle, 1 = pause bars
  function playPause(x, y, s, k, col = S.paper) { CX.save(); CX.fillStyle = col; const a = ease(k), bw = s * .3;
    const L = [[x - s * .32, y - s * .5], [x - s * .32 + lerp(s * .4, bw, a), y - lerp(s * .25, s * .5, a)], [x - s * .32 + lerp(s * .4, bw, a), y + lerp(s * .25, s * .5, a)], [x - s * .32, y + s * .5]];
    const R = [[x + lerp(s * .08, s * .02, a), y - lerp(s * .25, s * .5, a)], [x + lerp(s * .5, s * .32, a), y - lerp(0, s * .5, a)], [x + lerp(s * .5, s * .32, a), y + lerp(0, s * .5, a)], [x + lerp(s * .08, s * .02, a), y + lerp(s * .25, s * .5, a)]];
    for (const q of [L, R]) { CX.beginPath(); q.forEach(([px, py], i) => i ? CX.lineTo(px, py) : CX.moveTo(px, py)); CX.closePath(); CX.fill(); } CX.restore(); }
  // a track with a fill to value (0..1) and a knob; o.stretch (px past the end, from rubber()) widens the far end
  function track(x, y, w, value, o = {}) { const h = o.h || 8, st = o.stretch || 0; CX.save();
    rr(x, y - h / 2, w + st, h, h / 2); CX.fillStyle = o.bg || 'rgba(255,255,255,.2)'; CX.fill();
    rr(x, y - h / 2, Math.max(h, (w + st) * clamp(value)), h, h / 2); CX.fillStyle = o.fg || S.paper; CX.fill();
    if (o.knob !== false) circle(x + (w + st) * clamp(value), y, (o.knobR || h * 1.4) * (1 + .2 * (o.press || 0)), o.fg || S.paper); CX.restore(); }
  // toggle: a pill switch; on = 0..1 position, the knob stretched by its two-edge springs (pass [a, b] from edges())
  function toggle(x, y, w, h, ab, o = {}) { CX.save(); const on = clamp((ab[0] + ab[1]) / 2);
    rr(x, y, w, h, h / 2); CX.fillStyle = mixCol(o.off || '#3A3A3E', o.on || (ACC() === S.ink ? '#FFFFFF' : ACC()), on); CX.fill();
    const pad = h * .1, kw = h - pad * 2, span = w - pad * 2 - kw; const a = x + pad + span * ab[0], b = x + pad + span * ab[1] + kw;
    rr(a, y + pad, b - a, kw, kw / 2); CX.fillStyle = mixCol(S.paper, S.ink, on); CX.fill(); CX.restore(); }
  // tabs: labels in equal cells with a liquid indicator; ab from edges() in cell units ([i, i + 1] for cell i)
  function tabs(box, labels, ab, o = {}) { const pad = o.pad || box.h * .12, cw = (box.w - pad * 2) / labels.length, ih = box.h - pad * 2;
    rr(box.x + pad + ab[0] * cw, box.y + pad, (ab[1] - ab[0]) * cw, ih, Math.min(box.r, ih / 2)); CX.fillStyle = o.ind || S.paper; CX.fill();
    labels.forEach((s, i) => { const on = clamp(1 - Math.abs((ab[0] + ab[1]) / 2 - (i + .5)) * 1.4);
      T(o.ids ? `${o.ids}:${s}` : null, s, box.x + pad + cw * (i + .5), box.y + box.h / 2 + box.h * .11, { size: box.h * .3, align: 'center', color: mixCol(o.offCol || '#9A9893', o.onCol || S.ink, on) }); }); }
  // chart: a line that draws itself over p, a value that counts up, an optional tooltip at hoverX (0..1)
  function chart(box, data, p, o = {}) { const pad = box.h * .12, x0 = box.x + pad, x1 = box.x + box.w - pad, y0 = box.y + box.h * .42, y1 = box.y + box.h - pad;
    const lo = Math.min(...data), hi = Math.max(...data), pts = data.map((v, i) => [lerp(x0, x1, i / (data.length - 1)), lerp(y1, y0, (v - lo) / (hi - lo || 1))]);
    CX.save(); for (let i = 0; i < 3; i++) line([[x0, lerp(y0, y1, i / 2)], [x1, lerp(y0, y1, i / 2)]], S.line, 1.5);
    const end = lineTo(pts, p, o.color || S.ink, o.lw || box.h * .018);
    const v = Math.round(lerp(o.from ?? 0, o.to ?? hi, EASE.outExpo(p)));
    T((p < .999 ? '~' : '') + (o.id || 'chart:value'), v.toLocaleString('en-US'), x0, box.y + box.h * .26, { size: box.h * .16, color: S.ink, weight: 700 });
    if (o.caption) T(o.id ? o.id + ':cap' : 'chart:cap', o.caption, x0, box.y + box.h * .34, { size: box.h * .066, color: S.mute, weight: 500 });
    if (o.hoverX != null && o.hoverP > 0) { const hx = lerp(x0, x1, o.hoverX), i = Math.min(data.length - 2, Math.floor(o.hoverX * (data.length - 1))), k = o.hoverX * (data.length - 1) - i, hy = lerp(pts[i][1], pts[i + 1][1], k);
      CX.globalAlpha *= o.hoverP; line([[hx, y0 - box.h * .04], [hx, y1]], S.line, 1.5, { dash: [4, 4] }); circle(hx, hy, box.h * .022, S.ink);
      const tv = Math.round(lerp(data[i], data[i + 1], k)).toLocaleString('en-US'), tw = measure(tv, { family: S.font, size: box.h * .05, weight: 600 }) + box.h * .06;
      box_(hx - tw / 2, hy - box.h * .14, tw, box.h * .08, box.h * .02, S.ink); T(null, tv, hx, hy - box.h * .085, { size: box.h * .05, align: 'center' }); }
    CX.restore(); }
  const box_ = (x, y, w, h, r, f) => { rr(x, y, w, h, r); CX.fillStyle = f; CX.fill(); };
  // command palette: a search row with typed text and a filtered list with a highlighted row
  function palette(box, query, items, o = {}) { const pad = box.h * .07, rowH = (box.h - pad * 2) / (items.length + 1.2), fs = rowH * .38;
    T(null, '⌕', box.x + pad + fs * .2, box.y + pad + rowH * .62, { size: fs * 1.1, color: S.mute }); T(o.id ? o.id + ':q' : 'palette:q', query.str + (query.caret ? '|' : ''), box.x + pad + fs * 1.6, box.y + pad + rowH * .64, { size: fs, color: S.ink, weight: 500 });
    line([[box.x, box.y + pad + rowH * 1.05], [box.x + box.w, box.y + pad + rowH * 1.05]], S.line, 1.5);
    items.forEach((it, i) => { const y = box.y + pad + rowH * (1.2 + i), a = it.a ?? 1; if (a < .01) return; CX.save(); CX.globalAlpha *= a;
      if (it.hi) box_(box.x + pad * .6, y, box.w - pad * 1.2, rowH * .92, rowH * .22, '#EFEDE9');
      T(o.id ? `${o.id}:${i}` : null, it.label, box.x + pad + fs * 1.6, y + rowH * .6, { size: fs, color: S.ink, weight: 500 });
      if (it.icon) T(null, it.icon, box.x + pad + fs * .2, y + rowH * .6, { size: fs, color: S.mute }); CX.restore(); }); }

  return { S, film, loopStates, current, geometry, camera, pointer, label, spinner, check, bars, art, playPause, track, toggle, tabs, chart, palette, T };
})();
