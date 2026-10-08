// draw.js: Canvas 2D helpers for flat motion graphics (UI, type, shapes, charts). They draw into CX, the output
// canvas's context, at frame pixels (W x H). Looks build on these; nothing here keeps state between frames.

const PAL = Object.assign({ bg: '#EDEBE6', ink: '#111111', paper: '#FAFAF7', mute: '#8A8781', accent: '#FF5A1F' }, P.palette || {});

function bg(col = PAL.bg) { CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.fillStyle = col; CX.fillRect(0, 0, W, H); CX.restore(); }
// rounded rectangle path; r is a number or [tl, tr, br, bl], clamped so it never exceeds half the short side
function rr(x, y, w, h, r = 0) {
  const R = (Array.isArray(r) ? r : [r, r, r, r]).map(v => Math.max(0, Math.min(v, Math.abs(w) / 2, Math.abs(h) / 2)));
  CX.beginPath(); CX.moveTo(x + R[0], y); CX.lineTo(x + w - R[1], y); CX.arcTo(x + w, y, x + w, y + R[1], R[1]);
  CX.lineTo(x + w, y + h - R[2]); CX.arcTo(x + w, y + h, x + w - R[2], y + h, R[2]); CX.lineTo(x + R[3], y + h);
  CX.arcTo(x, y + h, x, y + h - R[3], R[3]); CX.lineTo(x, y + R[0]); CX.arcTo(x, y, x + R[0], y, R[0]); CX.closePath();
}
// fill a rounded rect, with an optional soft shadow { blur, y, color }
function box(x, y, w, h, r, fill, o = {}) {
  CX.save();
  if (o.shadow) { CX.shadowColor = o.shadow.color || 'rgba(0,0,0,.18)'; CX.shadowBlur = o.shadow.blur ?? 40; CX.shadowOffsetY = o.shadow.y ?? 12; }
  if (o.alpha != null) CX.globalAlpha *= o.alpha;
  rr(x, y, w, h, r); CX.fillStyle = fill; CX.fill();
  if (o.stroke) { CX.shadowColor = 'transparent'; CX.lineWidth = o.lw || 2; CX.strokeStyle = o.stroke; CX.stroke(); }
  CX.restore();
}
function circle(x, y, r, fill, o = {}) { CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha; CX.beginPath(); CX.arc(x, y, Math.max(0, r), 0, TAU); if (fill) { CX.fillStyle = fill; CX.fill(); } if (o.stroke) { CX.lineWidth = o.lw || 2; CX.strokeStyle = o.stroke; CX.stroke(); } CX.restore(); }
function line(pts, col = PAL.ink, lw = 3, o = {}) {
  CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha; CX.beginPath(); pts.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y));
  CX.lineWidth = lw; CX.strokeStyle = col; CX.lineCap = o.cap || 'round'; CX.lineJoin = 'round'; if (o.dash) CX.setLineDash(o.dash); CX.stroke(); CX.restore();
}
// part of a polyline up to arc-length fraction p (0..1): charts that draw themselves, underlines, signatures
function lineTo(pts, p, col, lw, o) {
  if (p <= 0 || pts.length < 2) return; const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const want = L[L.length - 1] * clamp(p), out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { if (L[i] <= want) { out.push(pts[i]); continue; } const k = (want - L[i - 1]) / (L[i] - L[i - 1]); out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); break; }
  line(out, col, lw, o); return out[out.length - 1];
}
function rgba(hex, a = 1) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function mixCol(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0'); }

// ---------- type ----------
// font(size, o) builds a CSS font string. Families that ship with the engine: 'Space Grotesk' (300-700),
// 'Fraunces' (100-900), 'IBM Plex Mono' (700), 'Barlow Condensed' (900).
// each shipped face's only (or best) weight, so the browser never fakes a weight the file doesn't have
const FONT_WEIGHT = { 'IBM Plex Mono': 700, 'Barlow Condensed': 900 };
const font = (size, o = {}) => { const fam = o.family || P.font || 'Space Grotesk'; return `${o.italic ? 'italic ' : ''}${o.weight || FONT_WEIGHT[fam] || 600} ${Math.round(size)}px "${fam}"`; };
// text(id, str, x, y, o): draws one line and registers it for the checks (pass id null for decorative text the viewer
// needn't read). o: size, weight, family, color, align ('left'|'center'|'right'), base ('alphabetic'|'middle'|'top'),
// alpha, tracking (px between letters), blur (px), maxW (shrinks to fit). Returns { w, h, x0 } in frame pixels.
function text(id, str, x, y, o = {}) {
  str = String(str); let size = o.size || 48;
  CX.save(); CX.font = font(size, o);
  if (o.maxW) { let w = measure(str, o, size); while (w > o.maxW && size > 8) { size *= .96; w = measure(str, o, size); } CX.font = font(size, o); }
  CX.textAlign = 'left'; CX.textBaseline = o.base || 'alphabetic';
  if ('letterSpacing' in CX) CX.letterSpacing = (o.tracking || 0) + 'px';
  const m = CX.measureText(str), w = m.width, asc = m.actualBoundingBoxAscent ?? size * .72, desc = m.actualBoundingBoxDescent ?? size * .2;   // ?? not ||: caps have a descent of 0
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const a = (o.alpha ?? 1) * CX.globalAlpha;
  CX.globalAlpha = a; if (o.blur > .2) CX.filter = `blur(${o.blur.toFixed(2)}px)`;
  CX.fillStyle = o.color || PAL.ink; CX.fillText(str, x0, y);
  // the box in frame pixels, through whatever transform (camera) is current
  const M = CX.getTransform(), pts = [[x0, y - asc], [x0 + w, y - asc], [x0 + w, y + desc], [x0, y + desc]].map(([px, py]) => [M.a * px + M.c * py + M.e, M.b * px + M.d * py + M.f]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  if (id != null && (o.blur || 0) < 4) readable(id, str, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), a, size * Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)));
  CX.restore();
  return { w, h: asc + desc, x0, size };
}
function measure(str, o = {}, size = o.size || 48) { CX.save(); CX.font = font(size, o); if ('letterSpacing' in CX) CX.letterSpacing = (o.tracking || 0) + 'px'; const w = CX.measureText(String(str)).width; CX.restore(); return w; }
// fitSize(str, o, maxW, lo, hi): the largest size in [lo, hi] at which str fits maxW
const _FIT = new Map();
function fitSize(str, o, maxW, lo = 12, hi = 400) { const key = `${str}|${font(100, o)}|${o.tracking || 0}|${maxW}|${lo}|${hi}`; if (_FIT.has(key)) return _FIT.get(key);
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (measure(str, o, mid) > maxW) hi = mid; else lo = mid; } const r = Math.floor(lo); _FIT.set(key, r); return r; }
// wrap(str, o, maxW) -> lines that fit maxW at o.size
function wrap(str, o, maxW) { const words = String(str).split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const next = cur ? cur + ' ' + w : w; if (cur && measure(next, o) > maxW) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur); return lines; }

// ---------- swaps and reveals ----------
// swap(p, drawOut, drawIn, o): content changing inside a container: the old content blurs and fades out over the
// first half while the new one blurs in over the second, each with its OWN timing so the two never overlap legibly.
// p 0..1; o.blur (px, default 14), o.lift (px the content moves, default 10), o.overlap (0..1, default .15).
function swap(p, drawOut, drawIn, o = {}) {
  const b = o.blur ?? 14, lift = o.lift ?? 10, ov = o.overlap ?? .15;
  const pa = clamp(p / (.5 + ov / 2)), pb = clamp((p - (.5 - ov / 2)) / (.5 + ov / 2));
  if (pa < 1 && drawOut) { CX.save(); CX.globalAlpha *= 1 - easeIn(pa); if (pa > 0) CX.filter = `blur(${(b * pa).toFixed(2)}px)`; CX.translate(0, -lift * pa); drawOut(1 - pa); CX.restore(); }
  if (pb > 0 && drawIn) { CX.save(); CX.globalAlpha *= easeOut(pb); if (pb < 1) CX.filter = `blur(${(b * (1 - pb)).toFixed(2)}px)`; CX.translate(0, lift * (1 - pb)); drawIn(pb); CX.restore(); }
}
// words(id, str, x, y, t0, t, o): a line whose words land one after another (a stagger of o.stagger s, default
// .06), each blurring in from o.blur px and rising o.rise px over o.dur s on the punch curve. Returns its width.
function words(id, str, x, y, t0, t, o = {}) {
  const ws = String(str).split(' '), st = o.stagger ?? .06, d = o.dur ?? .3, gap = measure(' ', o);
  const total = ws.reduce((s, w) => s + measure(w, o), 0) + gap * (ws.length - 1);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  ws.forEach((w, i) => {
    const k = EASE.punch(seg(t, t0 + i * st, t0 + i * st + d));
    if (k > 0) text(k > .9 ? `${id}#${i}` : null, w, cx, y + (o.rise ?? 36) * (1 - k), { ...o, align: 'left', alpha: (o.alpha ?? 1) * k, blur: (o.blur ?? 16) * (1 - k) });
    cx += measure(w, o) + gap;
  });
  if (EASE.punch(seg(t, t0 + (ws.length - 1) * st, t0 + (ws.length - 1) * st + d)) > .9) readable(id, str, (o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x), y - (o.size || 48) * .75, total, (o.size || 48) * .95, o.alpha ?? 1);
  return total;
}

// ---------- camera ----------
// cam(cx, cy, zoom, rot): world point (cx, cy) at the frame centre, scaled by zoom. Call inside CX.save()/restore().
function cam(cx, cy, zoom = 1, rot = 0) { CX.translate(W / 2, H / 2); CX.rotate(rot); CX.scale(zoom, zoom); CX.translate(-cx, -cy); }
// frame(rect, fill): the [cx, cy, zoom] that fits world rect [x, y, w, h] into fill (0..1) of the frame
function frameOn(rect, fill = .7) { const [x, y, w, h] = rect; return [x + w / 2, y + h / 2, Math.min(W * fill / w, H * fill / h)]; }

// ---------- finishing ----------
// grain(amount): fine film grain over the frame, re-seeded every frame from the frame index (deterministic).
let _grain = null;
function grain(amount = .05, scale = 1) {
  if (!_grain) { _grain = document.createElement('canvas'); _grain.width = _grain.height = 256; const g = _grain.getContext('2d'), id = g.createImageData(256, 256), r = rnd(91);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }
  const f = Math.round(T * FPS), ox = Math.floor(hash(f) * 256), oy = Math.floor(hash(f + 7) * 256);
  CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalAlpha = amount; CX.globalCompositeOperation = 'overlay';
  CX.translate(-ox, -oy); CX.scale(scale, scale); CX.fillStyle = CX.createPattern(_grain, 'repeat'); CX.fillRect(0, 0, (W + 512) / scale, (H + 512) / scale); CX.restore();
}
function vignette(amount = .25, col = '#000') { CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); const g = CX.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, amount)); CX.fillStyle = g; CX.fillRect(0, 0, W, H); CX.restore(); }
// image(src) preloads a picture before the first frame (a screenshot, a logo); draw it with CX.drawImage(img(src), ...)
const _IMGS = new Map();
function image(src) { if (!_IMGS.has(src)) { const im = new Image(); im.src = src; _IMGS.set(src, im); whenReady(im.decode().catch(e => { throw new Error(`image ${src} failed to load: ${e}`); })); } return _IMGS.get(src); }
const img = src => _IMGS.get(src) || image(src);
