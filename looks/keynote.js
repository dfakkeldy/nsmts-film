// looks/keynote.js: "Apple keynote light". One product at a time on bright white: a phone or a laptop drawn in code
// and turned in fake 3D, its screen a UI drawn in code, a soft studio shadow on the floor under it, slow confident
// moves, a big clean headline with room round it, features called out one per beat with leader lines, a calm end card.
// Card: looks/keynote.md. Specimen: specimens/keynote.
//
// Devices are modelled in points (pt), like a design file: the phone body is 400 x 840 pt and its screen 368 x 808 pt;
// the laptop's screen is 1152 x 716 pt. KN.phone(x, y, s, rot, drawScreen, o) puts the phone's centre at frame (x, y)
// at s frame pixels per pt; rot is the yaw in radians (positive turns the right edge away) or { yaw, roll }.
// KN.laptop(x, y, s, rot, drawScreen, o) puts the laptop's hinge centre at (x, y); rot may carry lid (the lid's tilt
// back from vertical, radians: -1.57 shut, about -0.8 half open, 0 upright, 0.2 open). drawScreen(B) paints the screen
// in screen points (B = { x: 0, y: 0, w, h, r }) with the ordinary draw.js helpers and KN.ui; what it returns comes back
// as dev.ui, and dev.at(u, v) maps a screen point to the frame, so callouts and flights can find UI elements.
//
// A shared camera: KN.camera(ax, ay, fx, fy, z) puts world point (ax, ay) at frame point (fx, fy), z frame px per world
// px. Pass it as o.cam to every device and their x, y, s become world values: key [fx, fy, z] on springs with the
// anchor on the hero, and one move frames every product (a pull-back that reveals a second device reads as a camera).
//
// How the 3D is faked: the device is a set of flat rounded rectangles in 3D (front, back, screen; deck and lid). Their
// outlines are projected point by point (exact perspective) and filled; stacking a few outlines between front and back
// makes the side edge. The screen is painted into an offscreen canvas and drawn onto its plane in thin strips (or, for a
// laptop lid that is both turned and tilted, a grid of cells), each with its own setTransform, so the near edge comes
// out taller than the far one. dev.open says whether a laptop's lid faces the camera. Pure functions of t throughout.

const KN = (() => {
  const S = Object.assign({
    top: '#FBFBFC', bg: '#F5F5F7', floor: '#ECECEF',               // the white studio: top of the sweep, middle, floor
    ink: '#1D1D1F', mute: '#86868B', line: '#8E8E93', accent: '#F2612E',
    body: '#2E2F33', bodyLit: '#8A8C93', bodyDark: '#141518',        // phone: graphite frame, lit and shaded edge
    alu: '#D9DADE', alu2: '#BCBEC3', alu3: '#9D9FA5',                // laptop: aluminium top, edges, underside
    screen: '#0E0E10', font: 'Space Grotesk', mono: 'IBM Plex Mono',
    f: 2800, shadow: .30, grain: .018,
  }, P.keynote || {});
  // keynote moves: long glides that settle; springs for the camera and the hero (critically damped, no wobble)
  const EASE_K = { glide: bezier(.3, 0, .08, 1), settle: bezier(.2, .7, .15, 1) };
  const SPRING_K = {
    reveal: { stiffness: 9, damping: 6, mass: 1 },     // a product turning in: ~1.9 s, no overshoot
    cam: { stiffness: 16, damping: 8, mass: 1 },       // camera pushes and pulls: ~1.5 s, no overshoot
    lid: { stiffness: 22, damping: 8.5, mass: 1 },     // a laptop lid settling open: a hair of overshoot
    bloom: { stiffness: 170, damping: 17, mass: 1 },   // an icon or a dot appearing
  };

  // ---------- geometry ----------
  // rrPts: a rounded rectangle as a closed list of points (clockwise); r is a number or [tl, tr, br, bl]
  const _rr = new Map();
  function rrPts(x, y, w, h, r, seg = 8) {
    const key = [x, y, w, h, r, seg].join('|'); if (_rr.has(key)) return _rr.get(key);
    const R = (Array.isArray(r) ? r : [r, r, r, r]).map(v => Math.max(0, Math.min(v, w / 2, h / 2)));
    const C = [[x + w - R[1], y + R[1], R[1], -Math.PI / 2], [x + w - R[2], y + h - R[2], R[2], 0], [x + R[3], y + h - R[3], R[3], Math.PI / 2], [x + R[0], y + R[0], R[0], Math.PI]];
    const out = [];
    for (const [cx, cy, rad, a0] of C) for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; out.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); }
    _rr.set(key, out); return out;
  }
  function path(pts) { CX.beginPath(); pts.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y)); CX.closePath(); }
  function bounds(pts) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }

  // rig(x, y, s, rot, f, eye, cam): a pinhole projection for one device. p(X, Y, Z) takes a device point in pt (Y down,
  // Z away from the viewer) to the frame: yaw about the vertical axis, perspective with focal length f (pt), an eye
  // `eye` pt above the device origin (so floors are seen from above), then roll in the picture plane. With cam (a
  // KN.camera), x, y and s are world values, mapped through it first; rig.s is then the scale in frame pixels.
  function rig(x, y, s, rot, f, eye, cam) {
    if (cam) { [x, y] = cam.p(x, y); s = cam.s(s); }
    const r = typeof rot === 'number' ? { yaw: rot } : (rot || {}), yaw = r.yaw || 0, roll = r.roll || 0;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
    const p = (X, Y, Z) => { const xr = X * cy - Z * sy, zr = X * sy + Z * cy, k = f / (f + zr), px = xr * k, py = (Y + eye) * k - eye;
      return [x + s * (px * cr - py * sr), y + s * (px * sr + py * cr)]; };
    return { p, yaw, roll, s, x, y, f, lid: r.lid };
  }
  // camera(ax, ay, fx, fy, z): world point (ax, ay) shown at frame point (fx, fy), at z frame px per world px. Devices
  // take it as o.cam. Keep the anchor on the hero and spring [fx, fy, z]: the hero's path is then exactly that spring,
  // and every other device rides the same move (cam.p maps any world point, cam.s any world length).
  function camera(ax, ay, fx = W / 2, fy = H / 2, z = 1) { return { ax, ay, fx, fy, z, p: (x, y) => [fx + (x - ax) * z, fy + (y - ay) * z], s: v => v * z }; }
  // the current canvas scale (KN.push, or any transform a film wraps round a device): textures are sized for it
  const zoomNow = () => { const M = CX.getTransform(); return Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 1; };
  const area = pts => { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; a += x0 * y1 - x1 * y0; } return a / 2; };

  // ---------- the screen texture ----------
  // paint(name, sw, sh, res, r, fn, yaw): paints fn(B) into an offscreen canvas at res texels per pt, clipped to the
  // screen's rounded rectangle, then lays a glass sheen over it that slides with the yaw. While fn runs, CX is the
  // offscreen context, so every draw.js helper works unchanged; the texts it registers are lifted out for remapping.
  // Each texture is allocated once at its largest size (max texels per pt), whatever frame comes first: a canvas
  // sized by the first frame drawn would sample its edge differently later, and frames would depend on render order.
  const TEX = {};
  function paint(name, sw, sh, res, r, fn, yaw, max = 2.6) {
    res = Math.min(res, max); const tw = Math.ceil(sw * res), th = Math.ceil(sh * res), key = `${name}|${sw}|${sh}|${max}`;
    let c = TEX[key]; if (!c) { c = document.createElement('canvas'); c.width = Math.ceil(sw * max) + 4; c.height = Math.ceil(sh * max) + 4; c.g = c.getContext('2d'); TEX[key] = c; }
    const g = c.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowColor = 'transparent'; g.shadowBlur = 0;
    g.clearRect(0, 0, Math.min(c.width, tw + 4), Math.min(c.height, th + 4)); g.setTransform(res, 0, 0, res, 0, 0);
    const saved = CX, n0 = TEXTS.length; let ret;
    CX = g;
    try { g.save(); rr(0, 0, sw, sh, r); g.clip(); ret = fn({ x: 0, y: 0, w: sw, h: sh, r }); g.globalAlpha = 1; g.filter = 'none'; sheen(sw, sh, yaw); g.restore(); }
    finally { CX = saved; }
    return { c, tw, th, ret, texts: TEXTS.splice(n0) };
  }
  // the glass: a faint diagonal band of light that slides across as the device turns, plus a lift at the top
  function sheen(w, h, yaw) {
    const off = (yaw || 0) * w * 1.7, g = CX.createLinearGradient(off - w * .5, -h * .05, off + w * .9, h * .75);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.40, 'rgba(255,255,255,0)'); g.addColorStop(.47, 'rgba(255,255,255,.075)');
    g.addColorStop(.56, 'rgba(255,255,255,.025)'); g.addColorStop(.64, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    CX.fillStyle = g; CX.fillRect(0, 0, w, h);
    const v = CX.createLinearGradient(0, 0, 0, h * .35); v.addColorStop(0, 'rgba(255,255,255,.035)'); v.addColorStop(1, 'rgba(255,255,255,0)'); CX.fillStyle = v; CX.fillRect(0, 0, w, h * .35);
  }
  // warp(src, tw, th, P, cols, n): draws texture [0, tw] x [0, th] onto the plane P(a, b) (a, b in 0..1 -> frame point)
  // in n strips: columns when cols is true (exact for a plane turned about the vertical axis), rows otherwise (a lid
  // tilted about the hinge). Each strip gets the affine map of its own corners; each overlaps the next by at least 1.6
  // frame pixels, so the antialiased strip edges never let what is underneath show through as a hairline.
  function warp(src, tw, th, P, cols, n) {
    const B0 = CX.getTransform(), L = cols ? tw : th, step = Math.max(1, Math.ceil(L / Math.max(1, n)));
    CX.save(); CX.imageSmoothingQuality = 'low';
    for (let a0 = 0; a0 < L; a0 += step) {
      const a1 = Math.min(L, a0 + step);
      let m, len;
      if (cols) {
        const TL = P(a0 / tw, 0), TR = P(a1 / tw, 0), BL = P(a0 / tw, 1), BR = P(a1 / tw, 1);
        const ax = (TR[0] - TL[0]) / (a1 - a0), ay = (TR[1] - TL[1]) / (a1 - a0), cx = (BL[0] + BR[0] - TL[0] - TR[0]) / 2 / th, cy = (BL[1] + BR[1] - TL[1] - TR[1]) / 2 / th;
        m = [ax, ay, cx, cy, TL[0] - ax * a0, TL[1] - ay * a0]; len = Math.min(L - a0, a1 - a0 + Math.max(1, Math.ceil(1.6 / (Math.hypot(ax, ay) || 1))));
        CX.setTransform(B0.multiply(new DOMMatrix(m))); CX.drawImage(src, a0, 0, len, th, a0, 0, len, th);
      } else {
        const TL = P(0, a0 / th), BL = P(0, a1 / th), TR = P(1, a0 / th), BR = P(1, a1 / th);
        const cx = (BL[0] - TL[0]) / (a1 - a0), cy = (BL[1] - TL[1]) / (a1 - a0), ax = (TR[0] + BR[0] - TL[0] - BL[0]) / 2 / tw, ay = (TR[1] + BR[1] - TL[1] - BL[1]) / 2 / tw;
        m = [ax, ay, cx, cy, TL[0] - cx * a0, TL[1] - cy * a0]; len = Math.min(L - a0, a1 - a0 + Math.max(1, Math.ceil(1.6 / (Math.hypot(cx, cy) || 1))));
        CX.setTransform(B0.multiply(new DOMMatrix(m))); CX.drawImage(src, 0, a0, tw, len, 0, a0, tw, len);
      }
    }
    CX.restore();
  }
  // warpGrid(src, tw, th, P, nc, nr): the same for a plane that is both turned and tilted (a laptop lid with yaw), where
  // neither rows nor columns are exact: nc x nr cells, each with the affine map that best fits its four projected
  // corners. With the laptop's long focal length the error is far below a pixel at a dozen cells across. Each cell
  // reaches 1.6 frame pixels into its right and lower neighbours, which are drawn after it, so no seam shows.
  function warpGrid(src, tw, th, P, nc, nr) {
    const B0 = CX.getTransform(), us = [], vs = [];
    for (let i = 0; i <= nc; i++) us.push(Math.round(i * tw / nc));
    for (let j = 0; j <= nr; j++) vs.push(Math.round(j * th / nr));
    const G = vs.map(v => us.map(u => P(u / tw, v / th)));   // the grid's corners in the frame, each computed once
    CX.save(); CX.imageSmoothingQuality = 'low';
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
      const u0 = us[i], u1 = us[i + 1], v0 = vs[j], v1 = vs[j + 1], du = u1 - u0, dv = v1 - v0; if (du <= 0 || dv <= 0) continue;
      const TL = G[j][i], TR = G[j][i + 1], BL = G[j + 1][i], BR = G[j + 1][i + 1];
      const ax = (TR[0] - TL[0] + BR[0] - BL[0]) / 2 / du, ay = (TR[1] - TL[1] + BR[1] - BL[1]) / 2 / du;
      const cx = (BL[0] - TL[0] + BR[0] - TR[0]) / 2 / dv, cy = (BL[1] - TL[1] + BR[1] - TR[1]) / 2 / dv;
      const mx = (TL[0] + TR[0] + BL[0] + BR[0]) / 4, my = (TL[1] + TR[1] + BL[1] + BR[1]) / 4, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      const lu = Math.min(tw - u0, du + Math.max(1, Math.ceil(1.6 / (Math.hypot(ax, ay) || 1)))), lv = Math.min(th - v0, dv + Math.max(1, Math.ceil(1.6 / (Math.hypot(cx, cy) || 1))));
      CX.setTransform(B0.multiply(new DOMMatrix([ax, ay, cx, cy, mx - ax * uc - cx * vc, my - ay * uc - cy * vc])));
      CX.drawImage(src, u0, v0, lu, lv, u0, v0, lu, lv);
    }
    CX.restore();
  }
  // remap(texts, ...): the screen's registered texts, moved from texel space to the frame through the same plane, so
  // the checks see where they really are. Screen UI is decorative ('~' ids) unless o.readable; a box that leaves the
  // frame, or decorative text that leaves the safe area (a device sliding out), is dropped rather than reported, since
  // nobody is meant to read it there.
  function remap(list, res, sw, sh, P, readable) {
    const M = CX.getTransform(), [sx, sy, sw2, sh2] = safeRect();
    for (const e of list) {
      const [bx, by, bw, bh] = e.box;
      const q = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]].map(([x, y]) => { const p = P(x / res / sw, y / res / sh); return [M.a * p[0] + M.c * p[1] + M.e, M.b * p[0] + M.d * p[1] + M.f]; });
      const [x0, y0, x1, y1] = bounds(q); if (x0 < 0 || y0 < 0 || x1 > W || y1 > H) continue;
      if (!readable && (x0 < sx || y0 < sy || x1 > sx + sw2 || y1 > sy + sh2)) continue;
      const px = e.px ? e.px * (y1 - y0) / (bh || 1) : null;
      TEXTS.push({ ...e, id: readable || e.id.startsWith('~') ? e.id : '~' + e.id, box: [x0, y0, x1 - x0, y1 - y0].map(Math.round), ...(px ? { px: Math.round(px) } : {}) });
    }
  }

  // ---------- studio ----------
  // stage(t, o): the white sweep: near-white at the top, a touch greyer at the floor, a soft pool of light behind the
  // product at o.light = [x, y] (default centre) and a whisper of grain so the gradient doesn't band in H.264
  function stage(t, o = {}) {
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0);
    const g = CX.createLinearGradient(0, 0, 0, H); g.addColorStop(0, S.top); g.addColorStop(.62, S.bg); g.addColorStop(1, S.floor); CX.fillStyle = g; CX.fillRect(0, 0, W, H);
    const [lx, ly] = o.light || [W / 2, H * .46], R = Math.max(W, H) * (o.pool ?? .55), l = CX.createRadialGradient(lx, ly, 0, lx, ly, R);
    l.addColorStop(0, 'rgba(255,255,255,.85)'); l.addColorStop(.55, 'rgba(255,255,255,.25)'); l.addColorStop(1, 'rgba(255,255,255,0)'); CX.fillStyle = l; CX.fillRect(0, 0, W, H);
    CX.restore();
  }
  function finish() { if (S.grain > 0) grain(S.grain); }
  // shadow(cx, cy, w, o): a soft studio shadow on the floor: a wide pale penumbra and a tighter contact core.
  // o.lift 0..1 (0 resting on the floor, 1 floating well above it) spreads and fades it; o.flat is the ellipse's
  // height as a fraction of its width; o.alpha scales it.
  function shadow(cx, cy, w, o = {}) {
    const lift = clamp(o.lift ?? 0), a = (o.alpha ?? 1) * S.shadow, flat = o.flat ?? .085, rx = w * (.52 + .3 * lift);
    blob(cx, cy, rx * 1.3, rx * flat * 2.6, a * .5 * (1 - .35 * lift));
    blob(cx, cy, rx * .8, rx * flat, a * (1 - .75 * lift));
  }
  function blob(cx, cy, rx, ry, a) {
    if (a <= .002 || rx < 1) return;
    CX.save(); CX.translate(cx, cy); CX.scale(1, ry / rx);
    const g = CX.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(20,20,28,${a.toFixed(4)})`); g.addColorStop(.45, `rgba(20,20,28,${(a * .5).toFixed(4)})`); g.addColorStop(1, 'rgba(20,20,28,0)');
    CX.fillStyle = g; CX.fillRect(-rx, -rx, rx * 2, rx * 2); CX.restore();
  }

  // ---------- the phone ----------
  const PHONE = { w: 400, h: 840, r: 68, d: 36, rim: 5, bezel: 16, sr: 54 };
  // the shade of a slice of the side edge: k is 1 at the back face, near 0 at the front; the visible side is lit when
  // it faces the key light (upper left), so a phone turned with yaw > 0 shows a bright left edge
  function edgeCol(k, yaw) { const lit = yaw > 0 ? .78 : .38, bump = Math.sin(Math.PI * clamp(1 - k * .9)); return mixCol(S.bodyDark, S.bodyLit, lit * (.35 + .65 * bump)); }
  // phoneMap: where things are, without drawing (for planning a flight to a screen point at another time)
  function phoneMap(x, y, s, rot, o = {}) { const R = rig(x, y, s, rot, o.f ?? S.f, o.eye ?? 0, o.cam), D = PHONE, sw = D.w - 2 * D.bezel, sh = D.h - 2 * D.bezel; return { rig: R, at: (u, v) => R.p(u - sw / 2, v - sh / 2, 0), screen: [sw, sh] }; }
  function phone(x, y, s, rot, drawScreen, o = {}) {
    const D = PHONE, R = rig(x, y, s, rot, o.f ?? S.f, o.eye ?? 0, o.cam), out = rrPts(-D.w / 2, -D.h / 2, D.w, D.h, D.r);
    s = R.s;
    const glass = rrPts(-D.w / 2 + D.rim, -D.h / 2 + D.rim, D.w - 2 * D.rim, D.h - 2 * D.rim, D.r - D.rim);
    const proj = (pts, z) => pts.map(([u, v]) => R.p(u, v, z)), F = proj(out, 0), bb = bounds(F.concat(proj(out, D.d)));
    const sw = D.w - 2 * D.bezel, sh = D.h - 2 * D.bezel, P = (a, b) => R.p(-sw / 2 + a * sw, -sh / 2 + b * sh, 0);
    CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha;
    if (o.shadow !== false) shadow((bb[0] + bb[2]) / 2, bb[3] + (o.hover ?? 26) * s, Math.max(bb[2] - bb[0], D.w * s * .55) * 1.05, { lift: o.lift ?? .15, alpha: o.shadowAlpha });
    // the side edge: outlines stacked from the back face to the front
    const sn = Math.abs(Math.sin(R.yaw)), n = Math.max(1, Math.min(26, Math.ceil(sn * D.d * s / 1.3)));
    if (sn > .004) for (let i = n; i >= 1; i--) { path(proj(out, D.d * i / n)); CX.fillStyle = edgeCol(i / n, R.yaw); CX.fill(); }
    // the front: metal rim, black glass, the screen, a hairline of light on the rim
    path(F); CX.fillStyle = S.body; CX.fill();
    path(proj(glass, 0)); CX.fillStyle = '#050506'; CX.fill();
    const res = clamp(s * zoomNow() * (o.res ?? 1.25), .3, 2.6), scr = paint('phone', sw, sh, res, D.sr, drawScreen, R.yaw, 2.6);
    const pw = Math.abs(P(1, .5)[0] - P(0, .5)[0]), hd = Math.abs((P(1, 1)[1] - P(1, 0)[1]) - (P(0, 1)[1] - P(0, 0)[1]));
    warp(scr.c, scr.tw, scr.th, P, true, sn < .003 && !R.roll ? 1 : Math.min(260, Math.ceil(Math.max(pw / 4, hd / .5))));
    remap(scr.texts, res, sw, sh, P, o.readable);
    const cam = R.p(0, -sh / 2 + 22, 0); circle(cam[0], cam[1], 5.2 * s, '#0B0B0D'); circle(cam[0] - 1.2 * s, cam[1] - 1.2 * s, 1.6 * s, 'rgba(90,100,130,.55)');
    path(F); CX.lineWidth = Math.max(.8, 1.4 * s); CX.strokeStyle = 'rgba(255,255,255,.16)'; CX.stroke();
    CX.restore();
    return { at: (u, v) => R.p(u - sw / 2, v - sh / 2, 0), ui: scr.ret, box: bb, rig: R, screen: [sw, sh] };
  }

  // ---------- the laptop ----------
  // pt: lid lw x lh (rounded lr), screen sw x sh inset st from the top of the lid, deck dw x dd x dt
  const LAP = { lw: 1200, lh: 780, lr: [30, 30, 10, 10], rim: 7, lt: 10, sw: 1152, sh: 716, st: 24, dw: 1290, dd: 860, dt: 24, dr: 44 };
  function laptopRig(x, y, s, rot, o = {}) {
    const r = typeof rot === 'number' ? { yaw: rot } : (rot || {}), lid = r.lid ?? .2, R = rig(x, y, s, r, o.f ?? S.f * 2.2, o.eye ?? 520, o.cam), cb = Math.cos(lid), sb = Math.sin(lid);
    // a lid point: u across, q down from the lid's top edge, th behind its face
    const LP = (u, q, th = 0) => { const v = LAP.lh - q; return R.p(u, -v * cb + th * sb, v * sb + th * cb); };
    const P = (a, b) => LP(-LAP.sw / 2 + a * LAP.sw, LAP.st + b * LAP.sh);
    return { R, LP, P, lid, at: (u, v) => LP(u - LAP.sw / 2, LAP.st + v) };
  }
  function laptopMap(x, y, s, rot, o = {}) { const L = laptopRig(x, y, s, rot, o); return { rig: L.R, at: L.at, screen: [LAP.sw, LAP.sh] }; }
  function laptop(x, y, s, rot, drawScreen, o = {}) {
    const L = LAP, { R, LP, P, at, lid } = laptopRig(x, y, s, rot, o), DP = (u, w, yy = 0) => R.p(u, yy, w);
    s = R.s;
    const lidOut = rrPts(-L.lw / 2, 0, L.lw, L.lh, L.lr), deckOut = rrPts(-L.dw / 2, -L.dd, L.dw, L.dd, L.dr);
    const F = lidOut.map(([u, q]) => LP(u, q)), Bk = lidOut.map(([u, q]) => LP(u, q, L.lt)), top = deckOut.map(([u, w]) => DP(u, w, 0)), bot = deckOut.map(([u, w]) => DP(u, w, L.dt));
    const bb = bounds(F.concat(Bk, top, bot));
    // which side of the lid the camera sees: its projected outline winds the same way as the outline itself while the
    // face (the screen) looks at the camera. It turns away only when the lid is almost shut (about -1.49 with the
    // default eye), which is also when the lid starts to cover the deck: so a lid that faces away is drawn after it.
    const front = area(F) * area(lidOut) > 0;
    CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha;
    if (o.shadow !== false) shadow((bb[0] + bb[2]) / 2, bb[3] + 4 * s, (bb[2] - bb[0]) * 1.02, { lift: o.lift ?? 0, flat: .05, alpha: o.shadowAlpha });
    // the screen is always painted, so dev.ui is there even while the lid is shut (a flight can aim at it)
    const res = clamp(s * zoomNow() * (o.res ?? 1.2), .25, 1.6), scr = paint('laptop', L.sw, L.sh, res, 6, drawScreen, (R.yaw || 0) + (lid - .2) * .6, 1.6);
    const ln = Math.max(2, Math.min(10, Math.ceil(L.lt * s / .8))), shell = (i, k) => { path(lidOut.map(([u, q]) => LP(u, q, L.lt * k))); CX.fillStyle = mixCol(S.alu3, S.alu2, 1 - k * .7); CX.fill(); };
    const drawLid = () => {
      if (front) {
        // its back shell shows as a thin edge, then the face (aluminium rim, black glass), then the screen
        for (let i = ln; i >= 1; i--) shell(i, i / ln);
        path(F); CX.fillStyle = S.alu2; CX.fill();
        path(rrPts(-L.lw / 2 + L.rim, L.rim, L.lw - 2 * L.rim, L.lh - 2 * L.rim, [24, 24, 6, 6]).map(([u, q]) => LP(u, q))); CX.fillStyle = '#060607'; CX.fill();
        // facing square on, rows are exact (every point of a row is at one depth); turned, it takes a grid
        const ph = Math.hypot(P(.5, 1)[0] - P(.5, 0)[0], P(.5, 1)[1] - P(.5, 0)[1]), pw = Math.hypot(P(1, .5)[0] - P(0, .5)[0], P(1, .5)[1] - P(0, .5)[1]);
        if (Math.abs(R.yaw) < .003) warp(scr.c, scr.tw, scr.th, P, false, Math.min(220, Math.ceil(ph / 3)));
        else warpGrid(scr.c, scr.tw, scr.th, P, Math.round(clamp(pw / 44, 8, 36)), Math.round(clamp(ph / 44, 6, 26)));
        remap(scr.texts, res, L.sw, L.sh, P, o.readable);
      } else {
        // shut, or nearly: the face looks away, so the shell builds up from the face to the aluminium back, lit at
        // the edge nearest the camera
        for (let i = 0; i < ln; i++) shell(i, i / ln);
        const a = LP(0, L.lh, L.lt), b = LP(0, 0, L.lt), g = CX.createLinearGradient(a[0], a[1], b[0], b[1]);
        g.addColorStop(0, mixCol(S.alu, S.alu2, .25)); g.addColorStop(1, mixCol(S.alu, '#FFFFFF', .3));
        path(Bk); CX.fillStyle = g; CX.fill();
        line([LP(-L.lw / 2 + L.lr[0], 0, L.lt), LP(L.lw / 2 - L.lr[1], 0, L.lt)], 'rgba(255,255,255,.8)', Math.max(.8, 1.4 * s));
      }
    };
    // the deck: underside slices for the edge, the top, the keyboard well with its rows, the trackpad, a lit front edge
    const drawDeck = () => {
      const dn = Math.max(3, Math.min(24, Math.ceil(L.dt * s / .6)));
      for (let i = dn; i >= 1; i--) { path(deckOut.map(([u, w]) => DP(u, w, L.dt * i / dn))); CX.fillStyle = mixCol(S.alu3, mixCol(S.alu2, S.alu, .4), Math.pow(1 - i / dn, .7)); CX.fill(); }
      const a = DP(0, 0), b = DP(0, -L.dd), g = CX.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, mixCol(S.alu, '#FFFFFF', .2)); g.addColorStop(1, S.alu);
      path(top); CX.fillStyle = g; CX.fill();
      if (front) {   // under a shut lid the keyboard and trackpad are hidden (and the trackpad would peep past its edge)
        path(rrPts(-560, -470, 1120, 360, 16).map(([u, w]) => DP(u, w))); CX.fillStyle = '#2C2D31'; CX.fill();
        for (let i = 1; i < 5; i++) { const w = -470 + 360 * i / 5; line([DP(-548, w), DP(548, w)], 'rgba(255,255,255,.10)', Math.max(.6, s)); }
        path(rrPts(-250, -800, 500, 290, 18).map(([u, w]) => DP(u, w))); CX.fillStyle = mixCol(S.alu, S.alu2, .35); CX.fill();
      }
      line([DP(-L.dw / 2 + L.dr, -L.dd), DP(L.dw / 2 - L.dr, -L.dd)], 'rgba(255,255,255,.75)', Math.max(.8, 1.6 * s));
    };
    if (front) { drawLid(); drawDeck(); } else { drawDeck(); drawLid(); }
    CX.restore();
    return { at, ui: scr.ret, box: bb, rig: R, screen: [L.sw, L.sh], lid, open: front };
  }
  // lidWake(lid): how awake a laptop's screen should be at this lid angle: dark until the lid is past about -0.3 (so a
  // near-shut lid shows black glass, not specks of UI), fully lit by about 0.15. Pass it as the screen's wake.
  const lidWake = (lid, from = -.3, span = .45) => easeOut(clamp((lid - from) / span));
  // device(kind, x, y, s, rot, drawScreen, o): 'phone' or 'laptop'
  function device(kind, x, y, s, rot, drawScreen, o) { return (kind === 'laptop' ? laptop : phone)(x, y, s, rot, drawScreen, o); }

  // ---------- type in the frame ----------
  const TT = (id, str, x, y, o = {}) => text(id, str, x, y, { family: S.font, weight: 600, color: S.ink, ...o });
  // headline(id, str, x, y, t, o): a big line whose words land one after another (o.t0), and which leaves (o.t1)
  // by lifting and blurring out on the exit curve. Defaults: 104 px, weight 600, tight tracking, centred.
  function headline(id, str, x, y, t, o = {}) {
    const size = o.size ?? 104, out = o.t1 != null ? EASE.exit(seg(t, o.t1, o.t1 + (o.out ?? .32))) : 0; if (out >= 1) return 0;
    CX.save(); CX.globalAlpha *= 1 - out; if (out > 0) CX.filter = `blur(${(9 * out).toFixed(2)}px)`; CX.translate(0, -(o.lift ?? 18) * out);
    const w = words(id, str, x, y, o.t0 ?? 0, t, { family: S.font, weight: 600, color: S.ink, tracking: -size * .022, stagger: .08, dur: .42, blur: 14, rise: size * .22, align: 'center', ...o, size });
    CX.restore(); return w;
  }
  // lockup(id, head, sub, x, y, t, o): a headline with a quieter subhead under it (o.subT0, default .3 s later),
  // mute grey, weight 500, at o.subSize (default 40% of the headline), its baseline o.gap below (default 1.0 x size)
  function lockup(id, head, sub, x, y, t, o = {}) {
    const size = o.size ?? 104; headline(id, head, x, y, t, o);
    if (sub) headline(id + ':sub', sub, x, y + (o.gap ?? size * 1.0), t, { ...o, t0: o.subT0 ?? (o.t0 ?? 0) + .3, size: o.subSize ?? Math.round(size * .4), weight: 500, color: S.mute, tracking: 0, rise: 14, blur: 10, stagger: .05 });
  }
  // callout(id, str, t, o): a feature label tied to a point on the product by a thin leader line. o.at: the anchor
  // [x, y] (from dev.at(), live). o.label: the label's x (its right end when o.align is 'right', the default), and its
  // baseline then follows the anchor so the leader stays level; or [x, y] to place the baseline yourself (o.level: true
  // still levels it). o.elbow: x where a line that isn't level bends to the label's height (default 56 px past the
  // label). o.t0: when the label lands (default 0; the line starts o.lead s earlier, default .32). o.t1: when it all
  // draws back (leave it out and the callout stays until the shot ends). The anchor gets a white ring (o.ringR, default
  // 13 px), which frames a button or a knob without covering it; o.dot: true puts an accent dot on a bare point instead.
  function callout(id, str, t, o) {
    const t0 = o.t0 ?? 0, t1 = o.t1, lead = o.lead ?? .32, size = o.size ?? 40, right = (o.align ?? 'right') === 'right';
    const draw = EASE.outExpo(seg(t, t0 - lead, t0 + .05)), back = t1 != null ? EASE.exit(seg(t, t1, t1 + .34)) : 0, p = draw * (1 - back);
    if (p <= .001) return;
    const [ax, ay] = o.at, lx = typeof o.label === 'number' ? o.label : o.label[0], level = typeof o.label === 'number' || o.level;
    const ly = level ? ay + size * .34 : o.label[1], my = ly - size * .34, end = right ? lx + (o.gap ?? 22) : lx - (o.gap ?? 22), ex = o.elbow ?? (right ? end + 56 : end - 56);
    CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha;
    lineTo(Math.abs(my - ay) < 1.5 ? [[ax, ay], [end, my]] : [[ax, ay], [ex, my], [end, my]], p, o.color ?? S.line, o.lw ?? 2);
    const pr = seg(t, t0 - lead, t0 - lead + .8), dk = EASE.punch(seg(t, t0 - lead, t0 - lead + .25)) * (1 - back);
    if (pr < 1) circle(ax, ay, 8 + 26 * easeOut(pr), null, { stroke: rgba(S.accent, .7 * (1 - pr)), lw: 2 });
    if (o.dot) { circle(ax, ay, 8 * dk, '#FFFFFF'); circle(ax, ay, 5.5 * dk, S.accent); }
    else circle(ax, ay, (o.ringR ?? 13) * dk, null, { stroke: '#FFFFFF', lw: 2.5 });
    const kin = EASE.punch(seg(t, t0 - .05, t0 + .34)), kout = t1 != null ? EASE.exit(seg(t, t1 - .04, t1 + .22)) : 0;
    if (kin > 0 && kout < 1) TT(id, str, lx, ly + 12 * (1 - kin) - 8 * kout, { size, weight: o.weight ?? 600, align: right ? 'right' : 'left', alpha: kin * (1 - kout), blur: 10 * (1 - kin) + 8 * kout, color: o.textColor ?? S.ink });
    CX.restore();
  }

  // ---------- the through-line dot, the icon, the end card ----------
  // dot(x, y, r, o): the hero accent dot, with a soft contact shadow so it reads as an object, not a pixel
  function dot(x, y, r, o = {}) {
    if (r <= .05) return; CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha;
    CX.shadowColor = `rgba(20,20,28,${(.22 * (o.shadow ?? 1)).toFixed(3)})`; CX.shadowBlur = r * 1.6; CX.shadowOffsetY = r * .5;
    circle(x, y, r, o.color ?? S.accent); CX.restore();
  }
  // flight(t, t0, t1, a, b, o) -> { x, y, r, k } | null: the dot travelling from point a to point b (both may move: pass
  // them live) on an arc lifted o.lift px, growing to o.peak px radius mid-air (it comes towards the camera) from
  // o.r0 to o.r1. flyDot() draws it with a smear: one tapered ribbon through where it was over the last o.trail s
  // (default .045, about 3 frames at 60 fps; 0 for none), so it is long when the dot is fast and gone when it rests,
  // with the head stretched over its last o.smear s so motion-blur sub-frames merge.
  function flight(t, t0, t1, a, b, o = {}) {
    if (t < t0 || t > t1) return null;
    const k = EASE.inOut(seg(t, t0, t1)), lift = o.lift ?? 160, c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - lift];
    const q = u => [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
    const r = lerp(o.r0 ?? 6, o.r1 ?? 6, k) + ((o.peak ?? 16) - lerp(o.r0 ?? 6, o.r1 ?? 6, .5)) * Math.sin(Math.PI * k);
    const [x, y] = q(k); return { x, y, r, k, at: q };
  }
  function flyDot(t, t0, t1, a, b, o = {}) {
    const f = flight(t, t0, t1, a, b, o); if (!f) return null;
    const tr = o.trail ?? .045, N = 12;
    if (tr > 0) {
      const pts = []; for (let i = 0; i <= N; i++) { const g = flight(Math.max(t0, t - tr * i / N), t0, t1, a, b, o); pts.push([g.x, g.y, g.r * Math.pow(1 - i / N, .75)]); }
      if (Math.hypot(pts[N][0] - pts[0][0], pts[N][1] - pts[0][1]) > 1) {
        const L = [], R = [];
        for (let i = 0; i <= N; i++) {
          const p = pts[Math.max(0, i - 1)], q = pts[Math.min(N, i + 1)], d = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1, nx = -(p[1] - q[1]) / d, ny = (p[0] - q[0]) / d, [x, y, r] = pts[i];
          L.push([x + nx * r, y + ny * r]); R.push([x - nx * r, y - ny * r]);
        }
        const g = CX.createLinearGradient(pts[0][0], pts[0][1], pts[N][0], pts[N][1]);
        g.addColorStop(0, rgba(S.accent, .6)); g.addColorStop(.5, rgba(S.accent, .22)); g.addColorStop(1, rgba(S.accent, 0));
        CX.save(); if (o.alpha != null) CX.globalAlpha *= o.alpha; path(L.concat(R.reverse())); CX.fillStyle = g; CX.fill(); CX.restore();
      }
    }
    // the head itself is stretched over its last o.smear s (default .006, about three motion-blur sub-frame gaps at 4
    // sub-frames) and its edge softened with its speed, so the sub-frames merge into one smear instead of stacking up
    // as offset discs. At rest it is a crisp dot.
    const h = flight(Math.max(t0, t - (o.smear ?? .006)), t0, t1, a, b, o), sp = Math.hypot(f.x - h.x, f.y - h.y), soft = Math.min(f.r * .35, sp * .2);
    CX.save(); if (soft > .3) CX.filter = `blur(${soft.toFixed(2)}px)`;
    if (sp > .5) line([[h.x, h.y], [f.x, f.y]], S.accent, 2 * lerp(h.r, f.r, .5), { alpha: o.alpha });
    dot(f.x, f.y, f.r, { alpha: o.alpha, shadow: 1 - clamp(sp / 12) * .6 }); CX.restore(); return f;
  }
  // appIcon(x, y, size, k, o): the app's icon: an ink squircle with a white track and the accent dot (your place).
  // k 0..1 blooms it out from the dot (pass a spring); o.track 0..1 draws the track out from the dot; o.pos is where
  // the dot sits along the track (default .4). iconDot(x, y, size, o) -> [x, y, r] of the dot, for a flight to land on.
  function iconDot(x, y, size, o = {}) { return [x + size * (-.27 + .54 * (o.pos ?? .4)), y, size * .085]; }
  function appIcon(x, y, size, k, o = {}) {
    const [dx, dy, dr] = iconDot(x, y, size, o), s = size * k, cx = lerp(dx, x, clamp(k)), cy = lerp(dy, y, clamp(k));
    if (s > .5) { CX.save(); CX.shadowColor = 'rgba(20,20,28,.16)'; CX.shadowBlur = s * .14; CX.shadowOffsetY = s * .05; box(cx - s / 2, cy - s / 2, s, s, s * .225, S.ink); CX.restore(); }
    const tr = o.track ?? 1, x0 = x - size * .27, x1 = x + size * .27, lw = size * .042;
    if (tr > 0 && k > .2) { CX.save(); CX.globalAlpha *= clamp((k - .2) / .4);
      line([[dx, dy], [lerp(dx, x0, tr), dy]], '#FFFFFF', lw); line([[dx, dy], [lerp(dx, x1, tr), dy]], rgba('#FFFFFF', .32), lw); CX.restore(); }
    dot(dx, dy, dr * (o.dotScale ?? 1), { shadow: .4 });
  }
  // focus(px, fn, alpha): rack focus and fades. Draws fn() (a device, its shadow) into a frame-sized layer and lays it
  // down through a blur of px pixels at opacity alpha, so a product can arrive soft and pull into focus, soften while
  // the eye goes elsewhere, or fade. One layer, one blur, one alpha: never blur or fade a device's strips one by one
  // (overlapping strips would show as seams). Costs a few ms when it is in use.
  let _layer = null;
  function focus(px, fn, alpha = 1) {
    if (alpha <= .002) return null;
    if (!(px > .3) && alpha >= .998) return fn();
    if (!_layer || _layer.width !== W || _layer.height !== H) { _layer = document.createElement('canvas'); _layer.width = W; _layer.height = H; _layer.g = _layer.getContext('2d'); }
    const g = _layer.g, M = CX.getTransform(), saved = CX; let ret;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.setTransform(M);
    CX = g; try { ret = fn(); } finally { CX = saved; }
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalAlpha *= alpha; if (px > .3) CX.filter = `blur(${px.toFixed(2)}px)`; CX.drawImage(_layer, 0, 0); CX.restore();
    return ret;
  }
  // push(z): a slow camera push over the whole frame about (cx, cy) (call inside CX.save()/restore())
  function push(z, cx = W / 2, cy = H / 2) { CX.translate(cx, cy); CX.scale(z, z); CX.translate(-cx, -cy); }

  // ---------- the screen kit (inside drawScreen, in screen points) ----------
  const WHITE = '#FFFFFF', DIM = '#9A9AA0', ui = {};
  ui.T = (id, s, x, y, o = {}) => text(id == null ? null : `ui:${id}`, s, x, y, { family: S.font, weight: 600, color: WHITE, ...o });
  // status(B, o): a status bar: the time on the left, signal and battery on the right (no carrier, no maker marks)
  ui.status = (B, o = {}) => { const c = o.color || WHITE, y = o.y ?? 34;
    ui.T('clock', o.time || '8:15', 30, y + 6, { size: 16 });
    for (let i = 0; i < 4; i++) { rr(B.w - 96 + i * 6, y + 4 - (4 + i * 2.2), 4, 4 + i * 2.2, 1); CX.fillStyle = c; CX.fill(); }
    rr(B.w - 62, y - 7, 25, 12.5, 3.6); CX.lineWidth = 1.2; CX.strokeStyle = rgba(c, .45); CX.stroke(); rr(B.w - 60, y - 5, 17, 8.5, 2.2); CX.fillStyle = c; CX.fill();
    rr(B.w - 36, y - 3, 2, 4.5, 1); CX.fillStyle = rgba(c, .45); CX.fill(); };
  // cover(x, y, s, o): book or album art drawn in code; o.v picks a design (0 sun and road, 1 moon and sea, 2 hills,
  // 3 lit windows), all in the palette (accent, a cream, ink)
  ui.cover = (x, y, s, o = {}) => {
    const A = S.accent, cream = '#F3EADB', ink = '#1D1D1F', v = (o.v || 0) % 4;
    CX.save(); rr(x, y, s, s, s * (o.r ?? .05)); CX.clip(); CX.translate(x, y); CX.scale(s / 100, s / 100);
    if (v === 0) { const g = CX.createLinearGradient(0, 0, 0, 62); g.addColorStop(0, cream); g.addColorStop(1, mixCol(A, cream, .5)); CX.fillStyle = g; CX.fillRect(0, 0, 100, 100);
      circle(50, 50, 17, A); CX.fillStyle = ink; CX.fillRect(0, 62, 100, 38);
      CX.beginPath(); CX.moveTo(47.5, 62); CX.lineTo(52.5, 62); CX.lineTo(70, 100); CX.lineTo(30, 100); CX.closePath(); CX.fillStyle = cream; CX.fill();
      for (let i = 0; i < 4; i++) { const yy = 66 + i * i * 2.6 + i * 2; CX.fillStyle = ink; CX.fillRect(49.3 - i * .4, yy, 1.4 + i * .8, 1.2 + i * .9); } }
    else if (v === 1) { CX.fillStyle = ink; CX.fillRect(0, 0, 100, 100); circle(64, 34, 12, cream); circle(69, 30, 10.5, ink);
      for (let i = 0; i < 5; i++) line([[8, 62 + i * 7], [92, 62 + i * 7]], i === 2 ? A : rgba(cream, .5), 1.6); }
    else if (v === 2) { CX.fillStyle = A; CX.fillRect(0, 0, 100, 100); CX.fillStyle = cream; CX.beginPath(); CX.moveTo(0, 70); CX.quadraticCurveTo(35, 40, 70, 64); CX.quadraticCurveTo(88, 74, 100, 66); CX.lineTo(100, 100); CX.lineTo(0, 100); CX.fill();
      CX.fillStyle = ink; CX.beginPath(); CX.moveTo(0, 86); CX.quadraticCurveTo(50, 64, 100, 84); CX.lineTo(100, 100); CX.lineTo(0, 100); CX.fill(); }
    else { CX.fillStyle = cream; CX.fillRect(0, 0, 100, 100); for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { rr(16 + i * 18, 14 + j * 15, 12, 10, 1.5); CX.fillStyle = i === 2 && j === 1 ? A : ink; CX.fill(); } }
    CX.restore(); };
  // track(x, y, w, pos, o): a scrubber: the played part white, the rest dim, chapter ticks (o.ticks: positions, drawn
  // out to o.tickP 0..1), the knob in the accent (o.knob 0..1 scales it: 0 while the dot is away), o.ring a pulse 0..1
  ui.track = (x, y, w, pos, o = {}) => { const h = o.h ?? 4, kx = x + w * clamp(pos);
    rr(x, y - h / 2, w, h, h / 2); CX.fillStyle = rgba(WHITE, .22); CX.fill(); rr(x, y - h / 2, Math.max(h, kx - x), h, h / 2); CX.fillStyle = rgba(WHITE, .9); CX.fill();
    (o.ticks || []).forEach((p, i, a) => { const k = EASE.outExpo(clamp((o.tickP ?? 0) * (a.length + 2) - i)); if (k > 0) { rr(x + w * p - 1, y - h / 2 - 5 * k, 2, h + 10 * k, 1); CX.fillStyle = rgba(WHITE, .75 * k); CX.fill(); } });
    if (o.ring > 0 && o.ring < 1) circle(kx, y, (o.kr ?? 8) + 20 * easeOut(o.ring), null, { stroke: rgba(S.accent, .8 * (1 - o.ring)), lw: 2 });
    const kk = o.knob ?? 1; if (kk > 0) circle(kx, y, (o.kr ?? 8) * kk, S.accent);
    return [kx, y]; };
  // skip(x, y, r, sec, dir): a circular arrow with the seconds inside (dir -1 back, 1 forward)
  ui.skip = (x, y, r, sec, dir = -1, col = WHITE) => { CX.save(); CX.lineWidth = r * .13; CX.strokeStyle = col; CX.lineCap = 'round';
    CX.beginPath(); CX.arc(x, y, r, -Math.PI / 2 + .55, -Math.PI / 2 + TAU - .05); CX.stroke(); CX.translate(x, y - r); CX.scale(-dir, 1);
    CX.beginPath(); CX.moveTo(r * .34, -r * .26); CX.lineTo(0, 0); CX.lineTo(r * .34, r * .26); CX.stroke(); CX.restore();
    ui.T(null, String(sec), x, y + r * .3, { size: r * .78, align: 'center', color: col }); };
  // play(x, y, r, k): a white disc with pause bars (k 1) or a play triangle (k 0)
  ui.play = (x, y, r, k = 1, col = WHITE) => { circle(x, y, r, col); CX.save(); CX.fillStyle = S.screen;
    if (k > .5) { rr(x - r * .3, y - r * .36, r * .2, r * .72, r * .05); CX.fill(); rr(x + r * .1, y - r * .36, r * .2, r * .72, r * .05); CX.fill(); }
    else { CX.beginPath(); CX.moveTo(x - r * .22, y - r * .38); CX.lineTo(x + r * .4, y); CX.lineTo(x - r * .22, y + r * .38); CX.closePath(); CX.fill(); } CX.restore(); };
  // moon(x, y, r, on): a sleep-timer button: a crescent; on 0..1 fills a disc behind it in the accent
  ui.moon = (x, y, r, on = 0) => { const k = Math.max(0, on); if (k > 0) circle(x, y, r * 1.9 * Math.min(1.08, k), S.accent);
    CX.save(); CX.beginPath(); CX.arc(x, y, r, 0, TAU); CX.clip(); CX.beginPath(); CX.arc(x, y, r, 0, TAU);
    CX.moveTo(x + r * 1.28, y - r * .34); CX.arc(x + r * .42, y - r * .34, r * .86, 0, TAU); CX.fillStyle = WHITE; CX.fill('evenodd'); CX.restore(); };
  ui.list = (x, y, s, col = WHITE) => { for (let i = 0; i < 3; i++) { circle(x - s * .55, y - s * .4 + i * s * .4, s * .07, col); line([[x - s * .3, y - s * .4 + i * s * .4], [x + s * .55, y - s * .4 + i * s * .4]], col, s * .11); } };
  // toast(x, y, w, str, k): a small notification pill sliding down from the top (k 0..1)
  ui.toast = (x, y, w, str, k, o = {}) => { if (k <= .01) return; CX.save(); CX.globalAlpha *= clamp(k * 1.4); CX.translate(0, -24 * (1 - k));
    box(x - w / 2, y - 22, w, 44, 22, '#2A2A2E'); circle(x - w / 2 + 24, y, 6, S.accent); ui.T('toast', str, x - w / 2 + 40, y + 5.5, { size: 15, weight: 500, ...o }); CX.restore(); };
  // rows(x, y, w, items, o): list rows, each a cover thumbnail, a title and a quieter line under it. items are
  // [title, sub] pairs or { title, sub, v }; o: rowH (72), thumb (48), hi (index of the highlighted row), k (0..1: rows
  // slide in one after another), ids (id prefix). Returns the y of each row's centre.
  ui.rows = (x, y, w, items, o = {}) => { const rh = o.rowH ?? 72, th = o.thumb ?? 48, k = o.k ?? 1, ys = [];
    items.forEach((it, i) => { const [tt, sub, v] = Array.isArray(it) ? it : [it.title, it.sub, it.v], ry = y + i * rh, a = clamp(k * (items.length + 2) - i);
      ys.push(ry + th / 2); if (a <= 0) return; CX.save(); CX.globalAlpha *= easeOut(a); CX.translate(0, 14 * (1 - EASE.outExpo(a)));
      if (o.hi === i) box(x - 14, ry - 8, w, th + 16, 12, 'rgba(255,255,255,.08)');
      ui.cover(x, ry, th, { v: v ?? i, r: .1 }); ui.T(`${o.ids || 'row'}${i}`, tt, x + th + 14, ry + th * .46, { size: 16 }); ui.T(`${o.ids || 'row'}${i}:sub`, sub, x + th + 14, ry + th * .88, { size: 13, weight: 500, color: DIM });
      CX.restore(); }); return ys; };
  // button(x, y, w, h, label, o): a pill button: a white fill with dark text, or o.outline (a colour) for a quiet one;
  // o.fill, o.color, o.size (default 40% of h), o.press 0..1 (shrinks it a touch), o.id
  ui.button = (x, y, w, h, label, o = {}) => { const p = 1 - .04 * (o.press || 0); CX.save(); CX.translate(x + w / 2, y + h / 2); CX.scale(p, p); CX.translate(-x - w / 2, -y - h / 2);
    if (o.outline) { rr(x + .75, y + .75, w - 1.5, h - 1.5, h / 2); CX.lineWidth = 1.5; CX.strokeStyle = o.outline; CX.stroke(); } else box(x, y, w, h, h / 2, o.fill || WHITE);
    ui.T(o.id ?? `button:${label}`, label, x + w / 2, y + h / 2 + (o.size || h * .4) * .36, { size: o.size || h * .4, align: 'center', color: o.color || (o.outline ? WHITE : S.screen) }); CX.restore(); };
  const clock = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  ui.clock = clock;

  // player(B, st): a phone's now-playing screen. st: { wake 0..1, pos 0..1, len (s), title, author, chapter,
  // knob 0..1, ring 0..1, ticks [positions], tickP 0..1, sleep 0..1, sleepLeft (s), playing 0..1, v (cover design) }.
  // Returns anchors in screen points: { knob, moon, chapter, cover, title } for callouts and flights.
  function player(B, st = {}) {
    const k = clamp(st.wake ?? 1), w = B.w, A = S.accent, pos = st.pos ?? .25, len = st.len ?? 17608;
    CX.fillStyle = S.screen; CX.fillRect(0, 0, w, B.h);
    const anchors = { knob: [34 + 300 * pos, 520], moon: [52, 752], chapter: [34, 580], cover: [184, 246], title: [34, 448] };
    if (k <= 0) return anchors;
    CX.save(); CX.globalAlpha *= k; CX.translate(w / 2, B.h / 2); CX.scale(1 + .035 * (1 - k), 1 + .035 * (1 - k)); CX.translate(-w / 2, -B.h / 2);
    const g = CX.createLinearGradient(0, 0, 0, B.h * .72); g.addColorStop(0, mixCol(A, S.screen, .62)); g.addColorStop(1, S.screen); CX.fillStyle = g; CX.fillRect(0, 0, w, B.h);
    ui.status(B, { time: st.time });
    CX.save(); CX.shadowColor = 'rgba(0,0,0,.45)'; CX.shadowBlur = 30; CX.shadowOffsetY = 12; rr(34, 96, 300, 300, 15); CX.fillStyle = '#000'; CX.fill(); CX.restore();
    ui.cover(34, 96, 300, { v: st.v ?? 0 });
    ui.T('title', st.title ?? 'The Salt Road', 34, 448, { size: 26, weight: 700 });
    ui.T('author', st.author ?? 'Wren Castellan', 34, 478, { size: 18, weight: 500, color: DIM });
    const kx = ui.track(34, 520, 300, pos, { knob: st.knob ?? 1, ring: st.ring ?? 0, ticks: st.ticks, tickP: st.tickP ?? 0 })[0];
    anchors.knob = [kx, 520];
    ui.T('elapsed', clock(pos * len), 34, 548, { size: 12, family: S.mono, weight: 700, color: DIM });
    ui.T('left', '-' + clock(len * (1 - pos)), 334, 548, { size: 12, family: S.mono, weight: 700, color: DIM, align: 'right' });
    ui.T('chapter', st.chapter ?? 'Chapter 7 · The Harbour', 34, 586, { size: 16, weight: 500, color: mixCol(A, WHITE, .25) });
    ui.skip(100, 664, 21, 15, -1); ui.play(184, 664, 34, st.playing ?? 1); ui.skip(268, 664, 21, 30, 1);
    ui.moon(52, 752, 10, st.sleep ?? 0);
    if ((st.sleep ?? 0) > .05) ui.T('sleep', clock(st.sleepLeft ?? 1800), 90, 758, { size: 15, family: S.mono, weight: 700, color: WHITE, alpha: clamp(st.sleep * 2 - 1) });
    ui.T('speed', '1.2×', 184, 758, { size: 17, align: 'center', color: DIM, alpha: 1 - clamp(st.sleep ?? 0) * .6 });
    ui.list(316, 752, 22, DIM);
    CX.restore();
    return anchors;
  }
  // desktop(B, st): the same app on a laptop: a library sidebar, the book large, a wide scrubber, a toast.
  // st: { wake, pos, len, knob, ticks, tickP, toast 0..1, rows 0..1, books: [[title, author], ...] }. Returns { knob, toast }.
  function desktop(B, st = {}) {
    const k = clamp(st.wake ?? 1), A = S.accent, pos = st.pos ?? .25, len = st.len ?? 17608;
    CX.fillStyle = S.screen; CX.fillRect(0, 0, B.w, B.h);
    const anchors = { knob: [310 + 800 * pos, 450], toast: [706, 40] };
    if (k <= 0) return anchors;
    CX.save(); CX.globalAlpha *= k;
    const g = CX.createLinearGradient(260, 0, 260, B.h); g.addColorStop(0, mixCol(A, S.screen, .72)); g.addColorStop(.6, S.screen); CX.fillStyle = g; CX.fillRect(260, 0, B.w - 260, B.h);
    CX.fillStyle = '#17171A'; CX.fillRect(0, 0, 260, B.h);
    ui.T('library', 'Library', 28, 64, { size: 24, weight: 700 });
    const books = st.books || [['The Salt Road', 'Wren Castellan'], ['Low Tide', 'M. Okafor'], ['A House of Hills', 'Ida Brenner'], ['Night Windows', 'J. Sato'], ['Small Hours', 'R. Quill']];
    ui.rows(28, 100, 232, books.map(([tt, au], i) => [tt, au, i % 4]), { hi: 0, k: st.rows ?? 1 });
    CX.save(); CX.shadowColor = 'rgba(0,0,0,.5)'; CX.shadowBlur = 34; CX.shadowOffsetY = 14; rr(310, 86, 290, 290, 14); CX.fillStyle = '#000'; CX.fill(); CX.restore();
    ui.cover(310, 86, 290, { v: 0 });
    ui.T('d:title', books[0][0], 636, 176, { size: 42, weight: 700 });
    ui.T('d:author', books[0][1], 636, 214, { size: 20, weight: 500, color: DIM });
    ui.T('d:chapter', st.chapter ?? 'Chapter 7 · The Harbour', 636, 254, { size: 17, weight: 500, color: mixCol(A, WHITE, .25) });
    ui.button(636, 292, 132, 38, 'Chapters', { outline: rgba(WHITE, .35), size: 15 });
    const kx = ui.track(310, 450, 800, pos, { knob: st.knob ?? 1, ticks: st.ticks, tickP: st.tickP ?? 1, kr: 9, h: 5 })[0];
    anchors.knob = [kx, 450];
    ui.T('d:elapsed', clock(pos * len), 310, 480, { size: 13, family: S.mono, weight: 700, color: DIM });
    ui.T('d:left', '-' + clock(len * (1 - pos)), 1110, 480, { size: 13, family: S.mono, weight: 700, color: DIM, align: 'right' });
    ui.skip(630, 572, 24, 15, -1); ui.play(710, 572, 38, 1); ui.skip(790, 572, 24, 30, 1);
    ui.toast(706, 40, 330, st.toastText ?? 'Picked up from your phone', st.toast ?? 0);
    CX.restore();
    return anchors;
  }

  return { S, EASE: EASE_K, SPRING: SPRING_K, PHONE, LAP, rig, camera, rrPts, path, warp, warpGrid, paint, stage, finish, shadow, phone, phoneMap,
    laptop, laptopMap, lidWake, device, focus, headline, lockup, callout, dot, flight, flyDot, appIcon, iconDot, push, ui, player, desktop, T: TT };
})();
