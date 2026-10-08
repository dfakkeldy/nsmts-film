// looks/silhouette.js: paper cut-out shadow theatre. Flat black silhouettes (figures with hinged limbs that walk, push,
// turn and bow; houses with doors, trees, lamp posts, a handcart, a rooster, birds) in parallax layers against a sky that
// moves through the times of day, framed by stage curtains, with captions on hanging paper cards. Light is the plot: a
// lantern, windows, lamps and the sun come and go as the beats.
// Card: looks/silhouette.md. Specimen: specimens/silhouette.
//
// A film is one stage. SIL.stage(t, { hour, cam: [x, zoom], layers }) paints the sky for the hour, then every layer
// back to front, sorted by depth (then z, then list order): 0 is the sky, 1 is the street the figures walk on, more
// than 1 passes in front of it. A layer's draw(L) works in that layer's own world coordinates (the camera's parallax
// and zoom are already applied), and L.col is the silhouette colour for its depth: far layers fade toward the horizon.
// SIL.curtains(open) and SIL.card(t, cards) go on top in screen space; SIL.finish() adds grain and a vignette.
// Everything is flat, so the order things are drawn in IS the depth: draw back to front, explicitly, every frame.

const SIL = (() => {
  const S = Object.assign({
    ink: '#120C11', amber: '#FFB04A', flame: '#FFE3A6', dim: '#3A1E16',
    paper: '#EFE3C6', paperInk: '#2A1B17', cord: '#1B1013',
    curtain: '#5E1720', curtainDark: '#330A12', curtainLight: '#7C2731', trim: '#C08A45',
    font: 'Fraunces', ground: .835, haze: .8,
  }, P.silhouette || {});
  const GY = () => H * S.ground;   // the street's ground line, in street-layer coordinates

  // ---------- light ----------
  // light(t, on, off): a lamp's level 0..1. It catches at `on` with a quick flicker (a filament or a wick taking) and
  // fades out over .3 s from `off`. Either may be omitted.
  function light(t, on = -1e9, off = 1e9) {
    const up = ease(seg(t, on, on + .12)) * (1 - .4 * Math.exp(-Math.pow((t - on - .17) / .045, 2)));
    return clamp(up * (1 - ease(seg(t, off, off + .3))));
  }
  // glow(x, y, r, a, col): a soft additive halo (a radial gradient: cheap, no blur filter)
  function glow(x, y, r, a = .5, col = S.amber) {
    if (a <= .004 || r <= 1) return;
    CX.save(); CX.globalCompositeOperation = 'lighter';
    const g = CX.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(.3, rgba(col, a * .38)); g.addColorStop(1, rgba(col, 0));
    CX.fillStyle = g; CX.fillRect(x - r, y - r, 2 * r, 2 * r); CX.restore();
  }
  // pool(x, y, rx, ry, a): light falling on the ground, an ellipse that fades out
  function pool(x, y, rx, ry, a = .3, col = S.amber) {
    if (a <= .004) return;
    CX.save(); CX.globalCompositeOperation = 'lighter'; CX.translate(x, y); CX.scale(1, ry / rx);
    const g = CX.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    CX.fillStyle = g; CX.fillRect(-rx, -rx, 2 * rx, 2 * rx); CX.restore();
  }
  // a lit pane: amber with a brighter centre, at level `on`
  function lit(path, x, y, w, h, on) {
    if (on <= .003) return;
    CX.save(); CX.globalAlpha *= on; path();
    const g = CX.createRadialGradient(x + w / 2, y + h * .55, 0, x + w / 2, y + h * .55, Math.max(w, h) * .75);
    g.addColorStop(0, S.flame); g.addColorStop(1, S.amber); CX.fillStyle = g; CX.fill(); CX.restore();
  }

  // ---------- the sky by time of day ----------
  // hour: [top, middle, horizon]. Night is lifted off black on purpose: a near-black frame is this look's commonest fault.
  const SKY = [
    [0, '#151A45', '#24285A', '#3E3670'],
    [4.0, '#171D4A', '#2B2F63', '#4C3F78'],
    [5.0, '#1F2759', '#3E3E79', '#7A5885'],
    [5.7, '#2F3A74', '#79598D', '#D88376'],
    [6.3, '#4A5B98', '#C88A8E', '#FFB27C'],
    [7.0, '#6A84BD', '#E3AE9C', '#FFD39C'],
    [8.5, '#86ADD8', '#D8D3C6', '#FBE6BE'],
    [12, '#6FA6DA', '#A9CBE6', '#E6EEEA'],
    [16.5, '#7CA2D0', '#DCCDB4', '#F6D9A6'],
    [18.3, '#6276B2', '#E59F84', '#FFBE7E'],
    [19.1, '#45478A', '#C96C80', '#FF9A6C'],
    [19.8, '#2B2F6E', '#6F4C86', '#C98088'],
    [20.6, '#1B2253', '#36376F', '#5E4A80'],
    [21.5, '#151A45', '#24285A', '#3E3670'],
    [24, '#151A45', '#24285A', '#3E3670'],
  ];
  // skyAt(hour) -> { top, mid, hor, night (1 = full night), sun (1 = up) }
  function skyAt(hour) {
    const h = ((hour % 24) + 24) % 24; let i = 0; while (i + 2 < SKY.length && h >= SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1], k = ease(invLerp(a[0], b[0], h));
    return { top: mixCol(a[1], b[1], k), mid: mixCol(a[2], b[2], k), hor: mixCol(a[3], b[3], k), hour: h,
      night: h < 12 ? 1 - ease(seg(h, 4.7, 6.3)) : ease(seg(h, 19.3, 21)),
      sun: h < 12 ? ease(seg(h, 5.8, 6.9)) : 1 - ease(seg(h, 18.7, 19.6)) };
  }
  // sky(t, hour, o): the backdrop. o: { horizon (y px, default .66 H), stars (count), seed, sun: [x, y, r],
  // moon: [x, y, r] } (sun and moon in screen px; each shows only when its hour allows). Returns skyAt(hour).
  function sky(t, hour, o = {}) {
    const c = skyAt(hour), hy = o.horizon ?? H * .66;
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0);
    const g = CX.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, c.top); g.addColorStop(.55, c.mid); g.addColorStop(1, c.hor);
    CX.fillStyle = g; CX.fillRect(0, 0, W, hy); CX.fillStyle = c.hor; CX.fillRect(0, hy - 1, W, H - hy + 1);
    if (c.night > .02) {   // stars: seeded, twinkling, thinning toward the horizon
      const r = rnd(o.seed ?? 7); CX.fillStyle = '#FFF4DC';
      for (let i = 0; i < (o.stars ?? 150); i++) {
        const x = r() * W, y = r() * hy * .82, s = .9 + r() * r() * 2.1, ph = r() * 50;
        CX.globalAlpha = c.night * (1 - y / hy * .7) * (.55 + .45 * noise(t * 1.3 + ph, 11));
        CX.fillRect(x - s / 2, y - s / 2, s, s);
      }
      CX.globalAlpha = 1;
    }
    if (o.moon && c.night > .02) {   // a crescent: the disc clipped by a second circle
      const [mx, my, mr] = o.moon, a = Math.pow(c.night, .7);
      glow(mx, my, mr * 5, .1 * a, '#E8E2FF');
      CX.save(); CX.globalAlpha = a; CX.beginPath(); CX.rect(mx - mr * 2, my - mr * 2, mr * 4, mr * 4); CX.arc(mx + mr * .45, my - mr * .2, mr * .88, 0, TAU);
      CX.clip('evenodd'); circle(mx, my, mr, '#F4ECD6'); CX.restore();
    }
    if (o.sun && c.sun > .01) {
      const [sx, sy, sr] = o.sun, col = mixCol('#FF9C5C', '#FFF1CC', clamp((c.hour - 6.2) / 2.5));
      glow(sx, sy, sr * 9, .32 * c.sun, col); glow(sx, sy, sr * 2.6, .45 * c.sun, col);
      CX.save(); CX.globalAlpha = c.sun; circle(sx, sy, sr, col); CX.restore();
    }
    CX.restore();
    c.hy = hy;
    return c;
  }
  // skyCol(c, y): the sky's colour at screen height y (c from skyAt/sky/stage): for things that tint toward the sky
  function skyCol(c, y) { const u = clamp(y / (c.hy || H * .66)); return u < .55 ? mixCol(c.top, c.mid, u / .55) : mixCol(c.mid, c.hor, (u - .55) / .45); }
  // tint(depth, sky): the silhouette colour at a depth: the ink, faded toward the horizon for far layers
  const tint = (d, c) => d >= 1 ? S.ink : mixCol(S.ink, c.hor, S.haze * Math.pow(1 - clamp(d), 1.25));

  // ---------- the stage: camera and layers ----------
  // stage(t, o): o: { hour, sky: {...sky options}, cam: [x, zoom] (x = the world x at the frame centre for depth 1),
  // anchor (y the zoom pushes toward, default the ground line), layers: [{ depth, z, draw(L) }] }. A layer at depth d
  // moves d times as far as the street and zooms 1 + (zoom - 1) * d. L: { t, depth, z (its zoom), ay (zoom anchor y),
  // col, sky, gy (ground), x0, x1 (visible world range, for culling), vis (how strongly lamps glow: weaker by day) }.
  function stage(t, o) {
    const c = sky(t, o.hour, o.sky || {});
    const [cx, zoom] = o.cam || [W / 2, 1], off = cx - W / 2, ay = o.anchor ?? GY();
    const list = o.layers.map((l, i) => [l, i]).sort((a, b) => (a[0].depth - b[0].depth) || ((a[0].z || 0) - (b[0].z || 0)) || (a[1] - b[1]));
    for (const [l] of list) {
      const d = l.depth, z = 1 + (zoom - 1) * Math.min(d, 1.5);
      CX.save(); CX.translate(W / 2, ay); CX.scale(z, z); CX.translate(-W / 2 - off * d, -ay);
      l.draw({ t, depth: d, z, ay, col: tint(d, c), sky: c, gy: GY(), x0: off * d + W / 2 - W / 2 / z, x1: off * d + W / 2 + W / 2 / z, vis: .45 + .55 * c.night });
      CX.restore();
    }
    return c;
  }

  // ---------- land ----------
  // ridge(L, o): a hill line from seeded noise, filled down past the frame. o: { y, amp, freq, seed, col }
  function ridge(L, o) {
    const step = 12, amp = o.amp ?? 40, f = o.freq ?? .004, s = o.seed ?? 1;
    CX.beginPath(); CX.moveTo(L.x0 - 40, H * 2);
    for (let x = Math.floor((L.x0 - 40) / step) * step; x <= L.x1 + 40 + step; x += step) CX.lineTo(x, o.y + amp * noise(x * f, s) + amp * .35 * noise(x * f * 2.7, s + 5));
    CX.lineTo(L.x1 + 60, H * 2); CX.closePath(); CX.fillStyle = o.col || L.col; CX.fill();
  }
  const ridgeY = (x, o) => o.y + (o.amp ?? 40) * noise(x * (o.freq ?? .004), o.seed ?? 1) + (o.amp ?? 40) * .35 * noise(x * (o.freq ?? .004) * 2.7, (o.seed ?? 1) + 5);
  // ground(L, y): the flat street, filled to below the frame
  function ground(L, y = L.gy) { CX.fillStyle = L.col; CX.fillRect(L.x0 - 40, y, L.x1 - L.x0 + 80, H * 1.5); }

  // ---------- buildings ----------
  // house(L, x, o): a house on the ground at x (its left edge). o: { y (ground), w, h (walls), roof (gable height; 0 =
  // flat), eaves, chimney: { at (0..1 along the width), w, h }, windows: [{ x, y (bottom, up from the ground), w, h,
  // on, round, panes: [cols, rows], inside(x, y, w, h) (drawn over the light: goods, a cat) }], door: { x (centre),
  // w, h, open (0..1, swinging in), hinge ('left' default | 'right': the latch is on the other side, where a figure
  // pushes), light (0..1 inside), spill }, awning: { x, w, y, depth },
  // inDoor() (drawn in the doorway BEFORE the door panel: a figure going in or coming out), col }.
  // Draw order: walls, roof, chimney, lit panes, awning, window glows, doorway, inDoor(), door panel.
  function house(L, x, o) {
    const gy = o.y ?? L.gy, w = o.w, h = o.h, top = gy - h, col = o.col || L.col, ev = o.eaves ?? 14;
    CX.fillStyle = col;
    CX.fillRect(x, top, w, h + 2);
    if (o.roof) { CX.beginPath(); CX.moveTo(x - ev, top + 1); CX.lineTo(x + w / 2, top - o.roof); CX.lineTo(x + w + ev, top + 1); CX.closePath(); CX.fill(); }
    else CX.fillRect(x - ev, top - 10, w + ev * 2, 12);
    if (o.chimney) { const c = o.chimney, cx = x + w * c.at; CX.fillRect(cx - c.w / 2, top - c.h, c.w, c.h + 4); CX.fillRect(cx - c.w / 2 - 5, top - c.h - 8, c.w + 10, 10); }
    const glows = [];
    for (const win of o.windows || []) {
      const wx = x + win.x, wy = gy - win.y - win.h, on = win.on || 0;
      const path = win.round ? () => { CX.beginPath(); CX.arc(wx + win.w / 2, wy + win.h / 2, win.w / 2, 0, TAU); } : () => { CX.beginPath(); CX.rect(wx, wy, win.w, win.h); };
      lit(path, wx, wy, win.w, win.h, on);
      if (on > .003) {
        if (win.inside) { CX.save(); path(); CX.clip(); CX.fillStyle = col; win.inside(wx, wy, win.w, win.h, on); CX.restore(); }
        const [c_, r_] = win.panes || [2, 2], lw = Math.max(3, win.w * .045); CX.fillStyle = col;
        for (let i = 1; i < c_; i++) CX.fillRect(wx + win.w * i / c_ - lw / 2, wy, lw, win.h);
        for (let j = 1; j < r_; j++) CX.fillRect(wx, wy + win.h * j / r_ - lw / 2, win.w, lw);
        if (!win.round) { CX.fillRect(wx - 6, wy + win.h - 1, win.w + 12, 7); }   // the sill
        glows.push([wx + win.w / 2, wy + win.h / 2, Math.max(win.w, win.h) * 1.9, .28 * on * L.vis]);
        pool(wx + win.w / 2, gy + 6, win.w * 1.1, 14, .16 * on * L.vis);
      }
    }
    if (o.awning) { const a = o.awning, ax = x + a.x, ay = gy - a.y, n = Math.max(3, Math.round(a.w / 34));
      CX.fillStyle = col; CX.beginPath(); CX.moveTo(ax - 6, ay - a.depth); CX.lineTo(ax + a.w + 6, ay - a.depth); CX.lineTo(ax + a.w + 12, ay); CX.lineTo(ax - 12, ay); CX.closePath(); CX.fill();
      for (let i = 0; i < n; i++) { CX.beginPath(); CX.arc(ax - 12 + (a.w + 24) * (i + .5) / n, ay - 1, (a.w + 24) / n / 2, 0, Math.PI); CX.fill(); }
      }
    for (const g of glows) glow(...g);
    const d = o.door;
    if (d) {
      const dx = x + d.x - d.w / 2, dy = gy - d.h, open = clamp(d.open || 0), li = clamp(d.light || 0);
      if (open > .002) {
        CX.fillStyle = S.dim; rr(dx, dy, d.w, d.h, [d.w / 2, d.w / 2, 0, 0]); CX.fill();   // a dark warm interior until something lights it
        if (li > .01) { lit(() => rr(dx, dy, d.w, d.h, [d.w / 2, d.w / 2, 0, 0]), dx, dy, d.w, d.h, li * open);
          glow(dx + d.w / 2, dy + d.h * .5, d.h * 1.1, .22 * li * open * L.vis);
          if (d.spill !== false) { CX.save(); CX.globalCompositeOperation = 'lighter'; const g = CX.createLinearGradient(0, gy, 0, gy + 150); g.addColorStop(0, rgba(S.amber, .34 * li * open)); g.addColorStop(1, rgba(S.amber, 0));
            CX.fillStyle = g; CX.beginPath(); CX.moveTo(dx, gy); CX.lineTo(dx + d.w, gy); CX.lineTo(dx + d.w * 2.1, gy + 150); CX.lineTo(dx - d.w * 1.1, gy + 150); CX.closePath(); CX.fill(); CX.restore(); }
        }
      }
      if (o.inDoor) o.inDoor();
      // the door panel: it swings in on its hinge, so it narrows toward that side; clipped to the arch so a nearly
      // open door never pokes above the doorway, and not drawn at all once it is a sliver
      const pw = d.w * (1 - open);
      if (pw > d.w * .02) { CX.save(); rr(dx, dy, d.w, d.h, [d.w / 2, d.w / 2, 0, 0]); CX.clip(); CX.fillStyle = col;
        CX.fillRect(d.hinge === 'right' ? dx + d.w - pw : dx, dy - 1, pw, d.h + 2); CX.restore(); }
      CX.fillStyle = col; CX.fillRect(dx - 8, gy - 6, d.w + 16, 6);   // the step
    }
  }
  // roofPerches(x, o, n, side): n points along a gable house's roof slope (house(L, x, o) with o.roof), from the eave
  // to just short of the peak, for birds to sit on. side: 'left' (default) or 'right'. Layer coordinates.
  function roofPerches(x, o, n = 5, side = 'left', gy = GY()) {
    const ev = o.eaves ?? 14, top = (o.y ?? gy) - o.h, a = side === 'left' ? [x - ev, top + 1] : [x + o.w + ev, top + 1], b = [x + o.w / 2, top - o.roof];
    return Array.from({ length: n }, (_, i) => { const u = .14 + .74 * i / Math.max(1, n - 1); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; });
  }
  // sign(x, y, s, t, emblem): a shop sign hanging from a wall bracket at (x, y) (the wall point), swinging a little.
  // emblem(s) draws centred at the origin; SIL.emblems has a pretzel.
  function sign(x, y, s, t, emblem, o = {}) {
    const dir = o.dir ?? -1, len = s * 1.15, col = o.col || S.ink;
    CX.save(); CX.fillStyle = col; CX.strokeStyle = col; CX.lineCap = 'round';
    CX.lineWidth = s * .07; CX.beginPath(); CX.moveTo(x, y); CX.lineTo(x + dir * len, y); CX.stroke();
    CX.lineWidth = s * .04; CX.beginPath(); CX.moveTo(x, y + s * .35); CX.quadraticCurveTo(x + dir * len * .3, y + s * .05, x + dir * len * .8, y); CX.stroke();
    const px = x + dir * len * .78, a = .07 * noise(t * .7, 13) + .03 * Math.sin(t * 2.1);
    CX.translate(px, y); CX.rotate(a); CX.lineWidth = s * .03; CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(0, s * .28); CX.stroke();
    CX.translate(0, s * .28 + s * .42); emblem(s * .84, col); CX.restore();
  }
  const emblems = {
    // a pretzel: one thick stroked knot
    pretzel(s, col) { CX.save(); CX.strokeStyle = col; CX.lineWidth = s * .17; CX.lineCap = 'round'; CX.lineJoin = 'round'; CX.beginPath();
      const q = (x, y) => [x * s * .5, y * s * .5];
      CX.moveTo(...q(.44, .36)); CX.bezierCurveTo(...q(.22, .06), ...q(.06, -.2), ...q(-.12, -.42));
      CX.bezierCurveTo(...q(-.3, -.74), ...q(-.78, -.78), ...q(-.84, -.3)); CX.bezierCurveTo(...q(-.9, .22), ...q(-.46, .74), ...q(0, .74));
      CX.bezierCurveTo(...q(.46, .74), ...q(.9, .22), ...q(.84, -.3)); CX.bezierCurveTo(...q(.78, -.78), ...q(.3, -.74), ...q(.12, -.42));
      CX.bezierCurveTo(...q(-.06, -.2), ...q(-.22, .06), ...q(-.44, .36)); CX.stroke(); CX.restore(); },
    board(s, col) { CX.save(); CX.fillStyle = col; rr(-s * .5, -s * .3, s, s * .6, s * .06); CX.fill(); CX.restore(); },
  };
  // fence(L, x0, x1, o): a picket fence; o: { h, gap, y }
  function fence(L, x0, x1, o = {}) {
    const y = o.y ?? L.gy, h = o.h ?? 52, gap = o.gap ?? 20; CX.fillStyle = o.col || L.col;
    CX.fillRect(x0, y - h * .72, x1 - x0, 5); CX.fillRect(x0, y - h * .3, x1 - x0, 5);
    for (let x = x0; x <= x1; x += gap) { CX.beginPath(); CX.moveTo(x - 4, y); CX.lineTo(x - 4, y - h + 6); CX.lineTo(x, y - h); CX.lineTo(x + 4, y - h + 6); CX.lineTo(x + 4, y); CX.closePath(); CX.fill(); }
  }
  // lamp(L, x, o): a street lamp. o: { y, h, on (0..1) }. Its glow and the pool under it fade by day (L.vis).
  function lamp(L, x, o = {}) {
    const y = o.y ?? L.gy, h = o.h ?? 250, on = o.on ?? 0, col = o.col || L.col, top = y - h;
    if (on > .003) pool(x, y + 4, 130, 20, .3 * on * L.vis);
    CX.fillStyle = col;
    CX.beginPath(); CX.moveTo(x - 16, y); CX.lineTo(x - 9, y - 34); CX.lineTo(x + 9, y - 34); CX.lineTo(x + 16, y); CX.closePath(); CX.fill();
    CX.fillRect(x - 4.5, top, 9, h - 30); CX.fillRect(x - 24, top + 46, 48, 5);   // post, ladder bar
    CX.beginPath(); CX.moveTo(x - 13, top + 2); CX.lineTo(x - 19, top - 44); CX.lineTo(x + 19, top - 44); CX.lineTo(x + 13, top + 2); CX.closePath(); CX.fill();   // the cage
    lit(() => { CX.beginPath(); CX.moveTo(x - 9, top - 4); CX.lineTo(x - 13, top - 39); CX.lineTo(x + 13, top - 39); CX.lineTo(x + 9, top - 4); CX.closePath(); }, x - 13, top - 39, 26, 35, on);
    CX.fillStyle = col; CX.fillRect(x - 1.5, top - 40, 3, 38);
    CX.beginPath(); CX.moveTo(x - 25, top - 42); CX.lineTo(x, top - 62); CX.lineTo(x + 25, top - 42); CX.closePath(); CX.fill();   // the cap
    circle(x, top - 66, 5, col);
    if (on > .003) glow(x, top - 22, 200, .42 * on * L.vis);
  }
  // cart(L, x, o): a baker's handcart at rest: one big spoked wheel (the sky shows between the spokes), a bed, the
  // shafts propped on a leg, and a basket of long loaves standing up. x is the wheel's centre. o: { y, dir (the side
  // the shafts point to, default 1), load (0..1: how many loaves are in it), r (wheel radius), seed }
  function cart(L, x, o = {}) {
    const y = o.y ?? L.gy, R = o.r ?? 40, col = o.col || L.col, s = o.dir ?? 1, load = o.load ?? 1;
    CX.save(); CX.translate(x, y); CX.scale(s, 1); CX.fillStyle = col; CX.strokeStyle = col; CX.lineCap = 'round';
    CX.lineWidth = 6; CX.beginPath(); CX.arc(0, -R, R - 3, 0, TAU); CX.stroke();   // rim
    CX.lineWidth = 3.5; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .2; CX.beginPath(); CX.moveTo(0, -R); CX.lineTo(Math.cos(a) * (R - 3), -R + Math.sin(a) * (R - 3)); CX.stroke(); }
    circle(0, -R, 8, col);
    CX.fillRect(-58, -R - 54, 118, 10); CX.fillRect(-58, -R - 54, 8, 40); CX.fillRect(52, -R - 54, 8, 40); CX.fillRect(-58, -R - 18, 118, 9);   // the bed's frame
    CX.lineWidth = 7; CX.beginPath(); CX.moveTo(56, -R - 14); CX.lineTo(150, -R + 2); CX.stroke();   // a shaft
    CX.lineWidth = 5; CX.beginPath(); CX.moveTo(112, -R - 4); CX.lineTo(116, 0); CX.stroke();          // its prop leg
    // the basket and its loaves: long ones standing at angles, two rounds in front
    CX.beginPath(); CX.moveTo(-46, -R - 54); CX.lineTo(-40, -R - 92); CX.lineTo(36, -R - 92); CX.lineTo(42, -R - 54); CX.closePath(); CX.fill();
    const r = rnd(o.seed ?? 12);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .17 + (r() - .5) * .1, len = 62 + r() * 30, bx = -26 + i * 13;
      if (i / 5 >= load) continue;
      CX.lineWidth = 11; CX.beginPath(); CX.moveTo(bx, -R - 88); CX.lineTo(bx + Math.cos(a) * len, -R - 88 + Math.sin(a) * len); CX.stroke(); }
    if (load > .2) for (const [bx, rr_] of [[-24, 17], [16, 19]]) { CX.beginPath(); CX.ellipse(bx, -R - 92, rr_, rr_ * .8, 0, Math.PI, TAU); CX.fill(); }
    CX.restore();
  }

  // ---------- trees ----------
  const _trees = new Map();
  // treeGeo(size, seed): a bare branching tree, cached (it depends only on its arguments): { segs, forks }
  function treeGeo(size, seed) {
    const key = size + '|' + seed; if (_trees.has(key)) return _trees.get(key);
    const r = rnd(seed), segs = [], forks = [];
    const grow = (x, y, ang, len, w, depth) => {
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len; segs.push([x, y, x1, y1, w]);
      if (depth === 2) forks.push([x1, y1]);
      if (depth === 0) return;
      const n = depth > 4 ? 2 : r() < .55 ? 2 : 3;
      for (let i = 0; i < n; i++) grow(x1, y1, ang + (i - (n - 1) / 2) * (.42 + r() * .3) + (r() - .5) * .3, len * (.68 + r() * .14), w * .64, depth - 1);
    };
    grow(0, 0, -Math.PI / 2 + (r() - .5) * .12, size * .3, size * .06, 6);
    const g = { segs, forks }; _trees.set(key, g); return g;
  }
  const sway = (t, seed, amt) => amt * (noise(t * .45, seed) + .4 * Math.sin(t * 1.3 + seed));
  // tree(L, x, o): a bare tree at x on the ground. o: { y, size, seed, sway }. treePerches(...) gives points to put
  // birds on, with the same sway applied.
  function tree(L, x, o = {}) {
    const y = o.y ?? L.gy, g = treeGeo(o.size ?? 300, o.seed ?? 1), sh = sway(L.t, o.seed ?? 1, o.sway ?? .012);
    CX.save(); CX.translate(x, y); CX.transform(1, 0, sh, 1, 0, 0); CX.strokeStyle = o.col || L.col; CX.lineCap = 'round';
    for (const [a, b, c, d, w] of g.segs) { CX.lineWidth = Math.max(1.2, w); CX.beginPath(); CX.moveTo(a, b); CX.lineTo(c, d); CX.stroke(); }
    const s = o.size ?? 300; CX.fillStyle = o.col || L.col; CX.beginPath(); CX.moveTo(-s * .07, 2); CX.quadraticCurveTo(-s * .02, -s * .04, -s * .02, -s * .14); CX.lineTo(s * .02, -s * .14); CX.quadraticCurveTo(s * .02, -s * .04, s * .07, 2); CX.closePath(); CX.fill();
    CX.restore();
  }
  function treePerches(t, x, o = {}) {
    const y = o.y ?? GY(), g = treeGeo(o.size ?? 300, o.seed ?? 1), sh = sway(t, o.seed ?? 1, o.sway ?? .012);
    return g.forks.map(([px, py]) => [x + px + sh * py, y + py]);
  }
  // roundTree(L, x, o): a lollipop-free round tree: trunk and three to five seeded canopy lobes. o: { y, size, seed }
  function roundTree(L, x, o = {}) {
    const y = o.y ?? L.gy, s = o.size ?? 120, r = rnd(o.seed ?? 2), col = o.col || L.col, n = 3 + Math.floor(r() * 3), sh = sway(L.t, o.seed ?? 2, .02);
    CX.fillStyle = col; CX.fillRect(x - s * .04, y - s * .45, s * .08, s * .46);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI + Math.PI + r() * .4, rr_ = s * (.2 + r() * .14); circle(x + Math.cos(a) * s * .22 + sh * s * .5, y - s * .62 + Math.sin(a) * s * .16, rr_, col); }
    circle(x + sh * s * .5, y - s * .7, s * .26, col);
  }

  // grass(L, x, o): a tuft of blades on the ground at x, swaying; put tufts in a layer deeper than 1 so they pass in
  // front of the street and show the parallax. o: { y, h, n (blades), spread, seed }
  function grass(L, x, o = {}) {
    const y = o.y ?? L.gy, h = o.h ?? 80, n = o.n ?? 9, r = rnd(o.seed ?? 1), sp = o.spread ?? h * .7, sw = sway(L.t, o.seed ?? 1, .12);
    CX.fillStyle = o.col || L.col;
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - .5) * sp, bh = h * (.45 + r() * .55), lean = (r() - .5) * .7 + sw * bh / h, w = 2.5 + r() * 4;
      const tx = bx + Math.sin(lean) * bh, ty = y - Math.cos(lean) * bh;
      CX.beginPath(); CX.moveTo(bx - w, y + 4); CX.quadraticCurveTo(bx + (tx - bx) * .25 - w * .4, y - bh * .55, tx, ty); CX.quadraticCurveTo(bx + (tx - bx) * .25 + w * .4, y - bh * .5, bx + w, y + 4); CX.closePath(); CX.fill();
    }
  }

  // ---------- the far town ----------
  const _towns = new Map();
  function townGeo(seed, x0, x1) {
    const key = [seed, x0, x1].join('|'); if (_towns.has(key)) return _towns.get(key);
    const r = rnd(seed), out = []; let x = x0, i = 0;
    while (x < x1) {
      const w = 30 + r() * 56, h = 22 + r() * 58, k = r(), spire = i === 6;
      const wins = []; for (let j = 0; j < 3; j++) if (r() < .55) wins.push([w * (.2 + r() * .6), h * (.25 + r() * .5), r()]);
      out.push({ x, w, h: spire ? h * 1.2 : h, roof: spire ? 'spire' : k < .55 ? 'gable' : k < .8 ? 'flat' : 'chimney', wins });
      x += w + (r() < .25 ? 12 + r() * 50 : -2); i++;
    }
    _towns.set(key, out); return out;
  }
  // town(L, o): a row of distant roofs (one church spire) whose tiny windows light up as the town wakes.
  // o: { y (ground), from, to (world x span), seed, wake: [t0, t1] (windows switch on through this span), scale }
  function town(L, o) {
    const y = o.y, s = o.scale ?? 1, col = o.col || L.col;
    CX.fillStyle = col;
    for (const b of townGeo(o.seed ?? 4, o.from, o.to)) {
      if (b.x + b.w < L.x0 - 80 || b.x > L.x1 + 80) continue;
      const bw = b.w * s, bh = b.h * s, top = y - bh; CX.fillRect(b.x, top, bw, bh + 4);
      CX.beginPath();
      if (b.roof === 'gable') { CX.moveTo(b.x - 3, top + 1); CX.lineTo(b.x + bw / 2, top - bw * .38); CX.lineTo(b.x + bw + 3, top + 1); }
      else if (b.roof === 'spire') { CX.fillRect(b.x + bw * .32, top - bh * .5, bw * .36, bh * .5 + 2); CX.moveTo(b.x + bw * .26, top - bh * .5 + 1); CX.lineTo(b.x + bw / 2, top - bh * 1.45); CX.lineTo(b.x + bw * .74, top - bh * .5 + 1); }
      else if (b.roof === 'chimney') { CX.rect(b.x + bw * .7, top - 12 * s, 7 * s, 13 * s); }
      CX.closePath(); CX.fill();
      if (o.wake) for (const [wx, wy, k] of b.wins) {
        const on = light(L.t, lerp(o.wake[0], o.wake[1], k));
        if (on > .01) { CX.save(); CX.globalAlpha = on; CX.fillStyle = S.amber; CX.fillRect(b.x + wx * s, y - wy * s - 5 * s, 4.5 * s, 5.5 * s); CX.restore(); CX.fillStyle = col; }
      }
    }
  }

  // ---------- smoke ----------
  // smoke(L, x, y, o): puffs from a chimney top, each a pure function of its age. Every puff is an opaque cut-paper
  // cloud (two or three seeded lobes filled as one shape), its ink mixed further toward the sky behind it as it ages, and
  // it shrinks away at the end of its life: overlaps read as stacked paper, never as darker translucent discs. Older
  // puffs are drawn first, so the newest sits on top at the chimney. o: { from (time it starts), every, life,
  // rise (px/s), drift (px/s), fade (how far a new puff is already mixed toward the sky, 0..1), seed }
  function smoke(L, x, y, o = {}) {
    const t0 = o.from ?? 0, ev = o.every ?? .34, life = o.life ?? 2.6, rise = o.rise ?? 58, drift = o.drift ?? 32, t = L.t, sd = o.seed ?? 5;
    if (t < t0) return;
    for (let n = Math.max(0, Math.ceil((t - life - t0) / ev)); n <= Math.floor((t - t0) / ev); n++) {
      const age = t - (t0 + n * ev); if (age < 0 || age > life) continue; const k = age / life;
      const px = x + drift * age + 30 * noise(age * .8 + n * 1.9, sd) * k, py = y - rise * age + 4 * age * age;
      const r = (8 + 24 * Math.sqrt(k)) * EASE.outExpo(seg(age, 0, .35)) * (1 - ease(seg(k, .68, 1)));
      if (r < .6) continue;
      const q = rnd(sd * 7919 + n), lobes = 2 + (q() < .5 ? 1 : 0);
      CX.beginPath();
      for (let j = 0; j < lobes; j++) { const a = q() * TAU, d = r * (.2 + .35 * q()), lr = r * (.55 + .3 * q()), cx = px + Math.cos(a) * d, cy = py + Math.sin(a) * d * .7;
        CX.moveTo(cx + lr, cy); CX.arc(cx, cy, lr, 0, TAU); }
      const sy = (L.ay ?? GY()) + (py - (L.ay ?? GY())) * (L.z ?? 1);   // where the puff is on screen, for the sky behind it
      CX.fillStyle = o.col || mixCol(L.col, skyCol(L.sky, sy), (o.fade ?? .3) + .5 * k); CX.fill();
    }
  }

  // ---------- birds ----------
  // perched(x, y, s, col, t, ph, face): a small bird sitting at (x, y), pecking now and then
  function perched(x, y, s, col, t, ph, face = 1) {
    const peck = Math.max(0, noise(t * 1.6 + ph, 21)) * .5;
    CX.save(); CX.translate(x, y); CX.scale(face, 1); CX.fillStyle = col;
    CX.beginPath(); CX.ellipse(0, -s * .36, s * .5, s * .3, -.15, 0, TAU); CX.fill();
    CX.beginPath(); CX.moveTo(-s * .35, -s * .32); CX.lineTo(-s * .95, -s * .12); CX.lineTo(-s * .8, -s * .02); CX.lineTo(-s * .25, -s * .2); CX.closePath(); CX.fill();
    const hx = s * .42, hy = -s * .62 + peck * s * .35; circle(hx, hy, s * .2, col);
    CX.beginPath(); CX.moveTo(hx + s * .15, hy - s * .05); CX.lineTo(hx + s * .38, hy + s * .03); CX.lineTo(hx + s * .15, hy + s * .07); CX.closePath(); CX.fill();
    CX.restore();
  }
  // flyer(x, y, s, phase, col, face): a bird in flight; phase drives the wingbeat. The downstroke stops with the wings
  // level, never folded under the body (folded wings read as a hat or a blob), and a short forked tail trails behind
  // (face: 1 flying right, -1 left) so it still reads as a bird with its wings down.
  function flyer(x, y, s, phase, col, face = 1) {
    const a = lerp(-.08, 1, .5 + .5 * Math.sin(phase));
    CX.save(); CX.translate(x, y); CX.fillStyle = col; CX.beginPath(); CX.moveTo(0, 0);
    CX.quadraticCurveTo(-s * .45, -s * (.25 + a * .55), -s, -s * (a * .85 + .05));
    CX.quadraticCurveTo(-s * .5, -s * (.02 + a * .25), 0, s * .2);
    CX.quadraticCurveTo(s * .5, -s * (.02 + a * .25), s, -s * (a * .85 + .05));
    CX.quadraticCurveTo(s * .45, -s * (.25 + a * .55), 0, 0); CX.fill();
    CX.scale(face, 1); CX.beginPath(); CX.ellipse(s * .02, s * .06, s * .34, s * .13, 0, 0, TAU); CX.fill();
    CX.beginPath(); CX.moveTo(-s * .24, s * .02); CX.lineTo(-s * .62, -s * .06); CX.lineTo(-s * .5, s * .09); CX.lineTo(-s * .64, s * .2); CX.lineTo(-s * .24, s * .12); CX.closePath(); CX.fill();   // the forked tail
    circle(s * .34, s * .02, s * .11, col); CX.restore();   // the head, leading
  }
  // rooster(x, y, s, t, o): a cockerel standing at (x, y) (between its feet), s px tall, facing o.dir (1 right). Before
  // o.wake it roosts (legs folded, head sunk into the body, breathing); it stands over .45 s, bobs its head, and at
  // o.crow it crows: chest up, neck stretched, head thrown back, beak open, for about a second. o: { dir, wake, crow, col }
  function rooster(x, y, s, t, o = {}) {
    const col = o.col || S.ink, up = o.wake == null ? 1 : ease(seg(t, o.wake, o.wake + .45));
    const cw = o.crow == null ? 0 : Math.min(EASE.outExpo(seg(t, o.crow - .08, o.crow + .14)), 1 - ease(seg(t, o.crow + .8, o.crow + 1.1)));
    const breathe = (1 - up) * .012 * Math.sin(t * 3.1), bob = up * (1 - cw) * .025 * noise(t * 1.8, 17);
    CX.save(); CX.translate(x, y); CX.scale((o.dir ?? 1) * s, s); CX.fillStyle = col; CX.strokeStyle = col; CX.lineCap = 'round'; CX.lineJoin = 'round';
    const legH = lerp(.05, .2, up), by = -legH - .17 - .03 * cw + breathe;
    CX.lineWidth = .035; for (const lx of [-.05, .04]) { CX.beginPath(); CX.moveTo(lx, 0); CX.lineTo(lx + .02, -legH - .02); CX.stroke(); CX.beginPath(); CX.moveTo(lx - .05, 0); CX.lineTo(lx + .07, 0); CX.stroke(); }
    // the tail: three sickle feathers arching up and back, swaying a little
    const sw = .03 * noise(t * .9, 23);
    CX.lineWidth = .055; for (const [cx, cy, ex, ey] of [[-.34, -.98, -.56, -.6], [-.46, -.86, -.6, -.46], [-.46, -.66, -.52, -.32]]) {
      CX.beginPath(); CX.moveTo(-.14, by - .08); CX.quadraticCurveTo(cx + sw, by + cy + .42, ex + sw, by + ey + .42); CX.stroke(); }
    // the body: a tilted egg that rears up as it crows
    CX.beginPath(); CX.ellipse(-.02, by, .28, .19 + .02 * cw, -.22 - .3 * cw, 0, TAU); CX.fill();
    // the neck and head: sunk in while roosting, up on watch, stretched up and thrown back to crow
    const hx = lerp(.17, .2, up) - .05 * cw, hy = by + lerp(-.2, -.42, up) - .1 * cw + bob, tilt = -.75 * cw + .1 * (1 - up);
    // the neck: broad hackles at the shoulders tapering to the head
    CX.beginPath(); CX.moveTo(-.02, by - .1); CX.quadraticCurveTo(hx - .1, (by + hy) / 2, hx - .07, hy + .02); CX.lineTo(hx + .06, hy + .05);
    CX.quadraticCurveTo(hx + .02, (by + hy) / 2 + .04, .24, by - .02); CX.closePath(); CX.fill();
    CX.translate(hx, hy); CX.rotate(tilt);
    circle(0, 0, .08, col);
    for (const [cx, cy, r] of [[-.05, -.08, .036], [-.005, -.1, .04], [.04, -.085, .034]]) circle(cx, cy, r, col);   // the comb
    CX.beginPath(); CX.ellipse(.055, .085, .025, .042, -.2, 0, TAU); CX.fill();   // the wattle
    const gape = .38 * cw;   // the beak: two halves that open as it crows
    for (const sg of [-1, 1]) { CX.save(); CX.translate(.06, 0); CX.rotate(sg * gape * .5);
      CX.beginPath(); CX.moveTo(0, sg * .03); CX.lineTo(sg < 0 ? .13 : .11, sg * .003); CX.lineTo(0, -sg * .004); CX.closePath(); CX.fill(); CX.restore(); }
    CX.restore();
  }
  // flock(L, o): birds perched at o.perches ([x, y] in the layer's coordinates) lift off one after another from o.t0
  // and fly away along o.dir, flapping, shrinking a little as they go. o: { perches, t0, stagger, dir: [dx, dy],
  // speed (px/s), size, seed, flap (wingbeats a second, default 6: slower strobes at 30 fps) }
  function flock(L, o) {
    const r = rnd(o.seed ?? 3), t = L.t, dir = o.dir ?? [-1, -.55], col = o.col || L.col;
    o.perches.forEach(([px, py], i) => {
      const ti = o.t0 + i * (o.stagger ?? .07) + r() * .06, s = (o.size ?? 13) * (.85 + r() * .3), head = Math.atan2(dir[1], dir[0]) + (r() - .5) * .45;
      const v = (o.speed ?? 430) * (.85 + r() * .3), ph = r() * TAU, face = dir[0] < 0 ? -1 : 1;
      if (t < ti) return perched(px, py, s, col, t, ph, i % 3 === 1 ? -face : face);
      const u = t - ti, dist = v * (u - (1 - Math.exp(-u * 3)) / 3), wob = 10 * Math.sin(u * 3 + ph) * seg(u, 0, .6);
      const x = px + Math.cos(head) * dist + wob * .4, y = py + Math.sin(head) * dist - 22 * seg(u, 0, .15) + wob;
      flyer(x, y, s * 1.3 / (1 + .1 * u), u * (o.flap ?? 6) * TAU + ph, col, face);
    });
  }

  // ---------- figures ----------
  // A figure is h px tall to the top of the head (hats add to it). gait(d, h, o) is its pose after walking d px: the
  // feet are planted on the ground and the knees solved from them (two-bone IK), so nothing slides while it walks.
  // It is a closed-form function of d, so any frame renders alone. d = 0 is the passing pose (feet together under the
  // hips), so a figure starts from it; stopX() ends a walk just short of a whole stride so the feet rest a hand apart.
  // o: { step (stride half, x h), lift, bob, swing, lean, stand (0..1 blend to standing) }.
  // Stopping never slides a foot: the foot carrying the weight stays where it is (the planted one in the first half of
  // a stride, the landing one in the second), the other comes down beside it (with a small lift if it has to move),
  // and the hips settle over the middle, so the body may finish a little ahead of or behind x.
  const LEG = .49;
  function gait(d, h, o = {}) {
    const st = (o.step ?? .44) * h, stand = ease(clamp(o.stand ?? 0)), legL = (LEG + .035) * h * .985;   // hip to sole
    const D = Math.max(0, d) + st / 2, n = Math.floor(D / st), f = D / st - n, nearDown = (n & 1) === 0;
    const plant = st / 2 - f * st, swing = -st / 2 + 2 * st * ease(f) - f * st, lift = (o.lift ?? .055) * h * Math.sin(Math.PI * f);
    const low = Math.sqrt(Math.max(0, legL * legL * .97 - (st / 2) ** 2)), high = Math.min(legL * .992, low + (o.bob ?? .03) * h);
    let hipY = lerp(low, high, Math.sin(Math.PI * f) ** 2), hipX = 0;
    let near = nearDown ? [plant, 0] : [swing, -lift], far = nearDown ? [swing, -lift] : [plant, 0];
    if (stand > 0) {
      const gap = .08 * h, swingIsNear = !nearDown, anchorIsNear = f < .5 ? nearDown : swingIsNear;
      const A = anchorIsNear ? near : far, M = anchorIsNear ? far : near;
      const tx = A[0] + clamp((M[0] - A[0]) / gap, -1, 1) * gap, arc = Math.sin(Math.PI * stand) * Math.min(.035 * h, Math.abs(M[0] - tx) * .4);
      const A2 = [A[0], lerp(A[1], 0, stand)], M2 = [lerp(M[0], tx, stand), lerp(M[1], 0, stand) - arc];
      near = anchorIsNear ? A2 : M2; far = anchorIsNear ? M2 : A2;
      hipX = lerp(0, (near[0] + far[0]) / 2, stand); hipY = lerp(hipY, legL * .99, stand);
    }
    const sw = (o.swing ?? .42) * (1 - stand);
    return { h, hip: [hipX, -hipY], near, far, armNear: -sw * (near[0] - hipX) / (st / 2), armFar: -sw * (far[0] - hipX) / (st / 2), lean: (o.lean ?? .05) * (1 - stand),
      cycle: Math.max(0, d) / (2 * st), stand };
  }
  // stand(h, o): a figure at rest, feet a little apart, arms hanging. o: { lean (a bow: about .4 from the hip) }
  function stand(h, o = {}) {
    return { h, hip: [0, -(LEG + .035) * h * .985 * .99], near: [.035 * h, 0], far: [-.045 * h, 0], armNear: 0, armFar: 0, lean: o.lean ?? 0, cycle: 0, stand: 1 };
  }
  // turn(t, t0, dur, from): a shadow puppet's turn: the cut-out flattens to a sliver and opens the other way. Returns
  // a dir for figure()'s look.dir, from `from` (1 faces right) through ~0 to -from, eased; use it at a beat.
  function turn(t, t0, dur = .3, from = 1) { const v = Math.cos(Math.PI * EASE.inOut(seg(t, t0, t0 + dur))); return from * (Math.abs(v) < .03 ? Math.sign(v || 1) * .03 : v); }
  function knee(hip, ank, a, b) {   // the knee for thigh a and shin b, bending forward (+x)
    const dx = ank[0] - hip[0], dy = ank[1] - hip[1], c = Math.min(Math.hypot(dx, dy), (a + b) * .9995), ang = Math.atan2(dy, dx);
    const k = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1)), k1 = ang - k, k2 = ang + k;
    const p1 = [hip[0] + Math.cos(k1) * a, hip[1] + Math.sin(k1) * a], p2 = [hip[0] + Math.cos(k2) * a, hip[1] + Math.sin(k2) * a];
    return p1[0] > p2[0] ? p1 : p2;
  }
  // figure(x, y, g, look): draws a pose from gait() or stand() standing on (x, y). look: { dir (1 faces right, -1 left;
  // anything between is a puppet mid-turn: see turn()), col, hat: 'toque' | 'cap' | 'bowler' | 'bun' | null, coat (0
  // none, .3 to the knee, .45 a long skirt), build (belly), head (scale), carry: 'lantern' | 'basket' | null,
  // lanternOn (0..1), vis, scale (1; a little less steps back into a doorway), arms: { near: [th, bend, k],
  // far: [th, bend, k] } }. arms make the figure act: th is the upper arm's angle from hanging straight down (+ is
  // forward, about 1.45 reaches straight ahead, 2.6 points up), bend the elbow (+ folds the forearm forward and up), k
  // (0..1, default 1) blends from the walk's own swing, so a reach can ease in and out. The near arm carries the
  // lantern; use the far arm for a push, a wave or a hand held out. Returns the lantern's world point if any.
  function figure(x, y, g, look = {}) {
    const h = g.h, col = look.col || S.ink, face = look.dir ?? 1, sc = look.scale ?? 1;
    const up = [Math.sin(g.lean), -Math.cos(g.lean)], fw = [-up[1], up[0]];
    const P_ = (p, a, b) => [p[0] + fw[0] * a + up[0] * b, p[1] + fw[1] * a + up[1] * b];
    const hip = g.hip, sh = P_(hip, 0, .3 * h), shoulder = P_(sh, -.01 * h, -.02 * h), a = .245 * h, b = .245 * h;
    const leg = foot => { const ank = [foot[0], foot[1] - .035 * h], kn = knee(hip, ank, a, b);
      CX.lineWidth = .088 * h; CX.beginPath(); CX.moveTo(hip[0], hip[1]); CX.lineTo(kn[0], kn[1]); CX.stroke();
      CX.lineWidth = .066 * h; CX.beginPath(); CX.moveTo(kn[0], kn[1]); CX.lineTo(ank[0], ank[1]); CX.stroke();
      CX.beginPath(); CX.moveTo(ank[0] - .035 * h, foot[1] + .004 * h); CX.lineTo(ank[0] + .09 * h, foot[1] + .004 * h); CX.quadraticCurveTo(ank[0] + .085 * h, foot[1] - .035 * h, ank[0] + .02 * h, foot[1] - .045 * h); CX.lineTo(ank[0] - .03 * h, foot[1] - .04 * h); CX.closePath(); CX.fill(); };
    // an arm: angle th from hanging straight down (+ forward), forearm bent by bend; returns the hand
    const arm = (th, bend) => { const el = [shoulder[0] + Math.sin(th) * .17 * h, shoulder[1] + Math.cos(th) * .17 * h], hd = [el[0] + Math.sin(th + bend) * .155 * h, el[1] + Math.cos(th + bend) * .155 * h];
      CX.lineWidth = .056 * h; CX.beginPath(); CX.moveTo(shoulder[0], shoulder[1]); CX.lineTo(el[0], el[1]); CX.stroke();
      CX.lineWidth = .046 * h; CX.beginPath(); CX.moveTo(el[0], el[1]); CX.lineTo(hd[0], hd[1]); CX.stroke(); circle(hd[0], hd[1], .026 * h, col); return { el, hd }; };
    const lantern = look.carry === 'lantern', basket = look.carry === 'basket';
    let thNear = lantern ? .3 + .1 * g.armNear : g.armNear, bendNear = lantern ? .95 : .22 + .4 * Math.max(0, g.armNear);
    let thFar = basket ? -.05 + .05 * g.armFar : g.armFar, bendFar = basket ? 1.45 : .22 + .4 * Math.max(0, g.armFar);
    const A = look.arms || {};
    if (A.near) { const k = clamp(A.near[2] ?? 1); thNear = lerp(thNear, A.near[0], k); bendNear = lerp(bendNear, A.near[1], k); }
    if (A.far) { const k = clamp(A.far[2] ?? 1); thFar = lerp(thFar, A.far[0], k); bendFar = lerp(bendFar, A.far[1], k); }
    // the lantern's place, worked out first so its glow can sit behind the body
    let lp = null;
    if (lantern) { const el = [shoulder[0] + Math.sin(thNear) * .17 * h, shoulder[1] + Math.cos(thNear) * .17 * h], hd = [el[0] + Math.sin(thNear + bendNear) * .155 * h, el[1] + Math.cos(thNear + bendNear) * .155 * h];
      const sa = .22 * Math.sin(TAU * g.cycle * 2 - 1.1) * (1 - g.stand); lp = { hd, sa, c: [hd[0] + Math.sin(-sa) * .1 * h, hd[1] + Math.cos(sa) * .1 * h] }; }
    CX.save(); CX.translate(x, y); CX.scale(face * sc, sc);
    const on = look.lanternOn ?? 1, vis = look.vis ?? 1;
    if (lp && on > .003) { glow(lp.c[0], lp.c[1], 1.25 * h, .34 * on * vis); pool(lp.c[0], 0, .7 * h, .07 * h, .3 * on * vis); }
    CX.fillStyle = col; CX.strokeStyle = col; CX.lineCap = 'round'; CX.lineJoin = 'round';
    // back to front: far arm, far leg, body, near leg, near arm, head, hat, what it carries
    const farArm = arm(thFar, bendFar); leg(g.far);
    CX.lineWidth = .15 * h; CX.beginPath(); CX.moveTo(hip[0], hip[1] - .02 * h); CX.lineTo(sh[0], sh[1] + .06 * h); CX.stroke();   // the cap stops short of the neck
    if (look.build) { CX.beginPath(); CX.ellipse(...P_(hip, .03 * h, .11 * h), .1 * h * look.build, .085 * h, g.lean, 0, TAU); CX.fill(); }
    if (look.coat) { const hem = look.coat * h, fx = Math.max(g.near[0], g.far[0], 0), bx = Math.min(g.near[0], g.far[0], 0);
      CX.beginPath(); CX.moveTo(...P_(hip, -.08 * h, .1 * h)); CX.lineTo(...P_(hip, .075 * h, .1 * h)); CX.lineTo(hip[0] + .1 * h + fx * .3, hip[1] + hem); CX.lineTo(hip[0] - .11 * h + bx * .3, hip[1] + hem); CX.closePath(); CX.fill(); }
    leg(g.near); arm(thNear, bendNear);
    const neck = P_(sh, .014 * h, .045 * h), hs = look.head ?? 1, hr = .066 * h * hs, hc = P_(neck, .022 * h, .06 * h * hs);
    CX.lineWidth = .052 * h; CX.beginPath(); CX.moveTo(sh[0], sh[1] + .02 * h); CX.lineTo(neck[0], neck[1]); CX.stroke();
    CX.beginPath(); CX.ellipse(hc[0], hc[1], hr, hr * 1.12, g.lean * .6, 0, TAU); CX.fill();
    CX.beginPath(); CX.moveTo(hc[0] + hr * .86, hc[1] - hr * .2); CX.lineTo(hc[0] + hr * 1.38, hc[1] + hr * .3); CX.lineTo(hc[0] + hr * .88, hc[1] + hr * .42); CX.closePath(); CX.fill();   // the nose: which way it faces
    CX.beginPath(); CX.moveTo(hc[0] + hr * .3, hc[1] + hr * .7); CX.quadraticCurveTo(hc[0] + hr * .95, hc[1] + hr * 1.0, hc[0] + hr * .8, hc[1] + hr * .5); CX.closePath(); CX.fill();   // the chin
    const top = hc[1] - hr * 1.1;
    if (look.hat === 'toque') { CX.beginPath(); CX.moveTo(hc[0] - hr * .98, top + hr * .3); CX.lineTo(hc[0] - hr * .85, top - .045 * h); CX.lineTo(hc[0] + hr * .9, top - .045 * h); CX.lineTo(hc[0] + hr * .9, top + hr * .2); CX.closePath(); CX.fill();
      CX.beginPath(); CX.ellipse(hc[0] + .004 * h, top - .075 * h, .08 * h, .045 * h, 0, 0, TAU); CX.fill();
      circle(hc[0] - .038 * h, top - .1 * h, .028 * h, col); circle(hc[0] + .012 * h, top - .113 * h, .03 * h, col); circle(hc[0] + .055 * h, top - .095 * h, .025 * h, col); }
    else if (look.hat === 'cap') { CX.beginPath(); CX.ellipse(hc[0] - hr * .05, top + hr * .38, hr * 1.06, hr * .55, 0, Math.PI, TAU); CX.fill();
      CX.beginPath(); CX.moveTo(hc[0] + hr * .5, top + hr * .2); CX.lineTo(hc[0] + hr * 1.6, top + hr * .5); CX.lineTo(hc[0] + hr * .5, top + hr * .55); CX.closePath(); CX.fill(); }
    else if (look.hat === 'bowler') { CX.beginPath(); CX.arc(hc[0], top + hr * .45, hr * .92, Math.PI, TAU); CX.fill(); CX.beginPath(); CX.ellipse(hc[0], top + hr * .45, hr * 1.38, hr * .13, 0, 0, TAU); CX.fill(); }
    else if (look.hat === 'bun') circle(hc[0] - hr * .85, hc[1] - hr * .55, hr * .5, col);
    if (basket) { const p = [lerp(farArm.el[0], farArm.hd[0], .45), lerp(farArm.el[1], farArm.hd[1], .45)];
      CX.lineWidth = .014 * h; CX.beginPath(); CX.arc(p[0], p[1] + .07 * h, .06 * h, Math.PI * 1.1, Math.PI * 1.9); CX.stroke();
      CX.beginPath(); CX.moveTo(p[0] - .075 * h, p[1] + .045 * h); CX.lineTo(p[0] + .075 * h, p[1] + .045 * h); CX.lineTo(p[0] + .055 * h, p[1] + .12 * h); CX.lineTo(p[0] - .055 * h, p[1] + .12 * h); CX.closePath(); CX.fill(); }
    if (lp) {   // the lantern: bail, cap, glass (lit), base
      CX.save(); CX.translate(lp.hd[0], lp.hd[1]); CX.rotate(lp.sa); const u = .1 * h;
      CX.lineWidth = .012 * h; CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(0, u * .25); CX.stroke();
      CX.beginPath(); CX.moveTo(-u * .32, u * .42); CX.lineTo(0, u * .22); CX.lineTo(u * .32, u * .42); CX.closePath(); CX.fill();
      CX.fillRect(-u * .3, u * .4, u * .6, u * .8); lit(() => { CX.beginPath(); CX.rect(-u * .2, u * .5, u * .4, u * .6); }, -u * .2, u * .5, u * .4, u * .6, on);
      CX.fillStyle = col; CX.fillRect(-u * .025, u * .5, u * .05, u * .6); CX.fillRect(-u * .36, u * 1.18, u * .72, u * .14); CX.restore();
    }
    CX.restore();
    return lp ? [x + face * sc * lp.c[0], y + sc * lp.c[1]] : null;
  }
  // travel(t, keys): where a walker is. keys: [[t0, x0], [t1, x1, { accel, decel }], ...]: each pair is one move (equal
  // x = a pause). accel/decel in seconds (default .35 / .5; accel 0 = already walking). Returns { x, d (distance walked:
  // the gait's clock), dir, speed (0..1 of cruise) }.
  function travel(t, keys) {
    let d = 0, x = keys[0][1], dir = Math.sign((keys[1] || keys[0])[1] - keys[0][1]) || 1, speed = 0;
    for (let i = 1; i < keys.length; i++) {
      const [ta, xa] = keys[i - 1], [tb_, xb, o = {}] = keys[i], dist = Math.abs(xb - xa), T_ = tb_ - ta;
      if (dist < 1e-6 || t <= ta) { if (t <= ta) break; continue; }
      const s = Math.sign(xb - xa), A = Math.min(o.accel ?? .35, T_ / 2), D = Math.min(o.decel ?? .5, T_ / 2), v = dist / (T_ - A / 2 - D / 2), u = Math.min(t, tb_) - ta;
      let p; if (u < A) p = v * u * u / (2 * A); else if (u < T_ - D) p = v * A / 2 + v * (u - A); else { const q = u - (T_ - D); p = v * A / 2 + v * (T_ - D - A) + v * (q - q * q / (2 * D)); }
      d += p; x = xa + s * p; dir = s;
      if (t < tb_) { speed = u < A ? u / A : u < T_ - D ? 1 : 1 - (u - (T_ - D)) / D; break; }
    }
    return { x, d, dir, speed };
  }
  // walker(t, w): a figure walking a path. w: { keys (travel), y (ground), h, step, look (figure's look; its dir is set
  // from the path unless look.dir is given), gait: {...gait options}, pose(g, p) (optional: adjust the pose before it
  // is drawn, e.g. a lean) }. End each walk at stopX() and the feet come to rest cleanly.
  // Returns { x, lantern (its world point), moving, hip (the body's world x) }.
  function walker(t, w) {
    const p = travel(t, w.keys), g = gait(p.d, w.h ?? 210, { step: w.step, ...(w.gait || {}), stand: 1 - clamp(p.speed / .55) });
    if (w.pose) w.pose(g, p);
    const sc = w.look?.scale ?? 1, lantern = figure(p.x, w.y ?? GY(), g, { ...w.look, dir: w.look?.dir ?? p.dir });
    return { x: p.x, lantern, moving: p.speed > 0, hip: p.x + p.dir * sc * g.hip[0] };
  }
  // stopX(x0, x1, h, step): the x near x1 at which a walk from x0 ends just short of a whole stride, the swing foot a
  // little behind the planted one, so the feet come to rest a hand apart without either sliding
  const stopX = (x0, x1, h, step = .44) => { const st = step * h, n = Math.max(1, Math.round(Math.abs(x1 - x0) / st + .08)); return x0 + Math.sign(x1 - x0 || 1) * (n - .08) * st; };

  // ---------- the proscenium ----------
  // curtains(open, o): velvet curtains in screen space. open 0 = closed, 1 = drawn back to the sides and tied (springs
  // may overshoot a little). As they open the folds bunch up toward the sides. o: { side (px of drape left showing),
  // folds (per side), valance (px) }
  function curtains(open, o = {}) {
    const k = clamp(open, 0, 1.08), side = o.side ?? W * .08, nf = o.folds ?? 6, vh = o.valance ?? H * .085, yT = H * .62, rows = 26;
    const edge = y => { const pinch = Math.exp(-Math.pow((y - yT) / (H * .2), 2)), flare = seg(y, yT, H) * .28;
      const opened = side * (1.3 - .62 * pinch + flare); return lerp(W / 2 + 16, opened, k); };   // closed, the two drapes overlap
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0);
    const E = []; for (let j = 0; j <= rows; j++) { const y = H * j / rows; E.push([y, edge(y)]); }
    for (const sgn of [1, -1]) {
      const X = (u, e) => sgn > 0 ? u * e : W - u * e;
      const band = (u0, u1, col) => { CX.beginPath(); E.forEach(([y, e], j) => j ? CX.lineTo(X(u0, e), y) : CX.moveTo(X(u0, e), y));
        for (let j = rows; j >= 0; j--) CX.lineTo(X(u1, E[j][1]), E[j][0]); CX.closePath(); CX.fillStyle = col; CX.fill(); };
      band(0, 1, S.curtain);
      // soft folds: each a ramp of translucent bands, light then shadow, at seeded widths so they never read as stripes
      const r = rnd(sgn > 0 ? 41 : 43), cuts = [0]; for (let i = 0; i < nf; i++) cuts.push(cuts[i] + .7 + r() * .6); const tot = cuts[nf];
      for (let i = 0; i < nf; i++) { const u0 = cuts[i] / tot, fw = (cuts[i + 1] - cuts[i]) / tot, at = (a, z) => [u0 + a * fw, u0 + z * fw];
        CX.globalAlpha = .38; band(...at(.08, .42), S.curtainLight); CX.globalAlpha = .45; band(...at(.16, .32), S.curtainLight);
        CX.globalAlpha = .4; band(...at(.5, 1), S.curtainDark); CX.globalAlpha = .5; band(...at(.62, .94), S.curtainDark); CX.globalAlpha = .45; band(...at(.74, .88), S.curtainDark); }
      CX.globalAlpha = 1;
      // the hem and the tie-back
      CX.fillStyle = S.curtainDark; CX.beginPath(); E.forEach(([y, e], j) => j ? CX.lineTo(X(1, e) - sgn * 6, y) : CX.moveTo(X(1, e) - sgn * 6, y)); for (let j = rows; j >= 0; j--) CX.lineTo(X(1, E[j][1]), E[j][0]); CX.closePath(); CX.fill();
      // the tie-back holds the drape open, so it lets go first when the curtains close
      if (k > .8) { const e = edge(yT), a = seg(k, .8, .97); CX.save(); CX.globalAlpha = a; CX.fillStyle = S.trim; rr(sgn > 0 ? 0 : W - e - 4, yT - 7, e + 4, 14, 7); CX.fill(); circle(X(1, e) - sgn * 2, yT + 18, 9, S.trim); CX.restore(); }
    }
    // the valance: a pelmet with scalloped hem and a shadow on the stage under it
    const sg = CX.createLinearGradient(0, vh, 0, vh + 46); sg.addColorStop(0, 'rgba(0,0,0,.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); CX.fillStyle = sg; CX.fillRect(0, vh, W, 46);
    CX.fillStyle = S.curtain; CX.fillRect(0, 0, W, vh);
    const n = 16, sw = W / n; for (let i = 0; i < n; i++) { CX.beginPath(); CX.arc(sw * (i + .5), vh, sw / 2, 0, Math.PI); CX.fill(); }
    for (let i = 0; i < n * 2; i++) { CX.fillStyle = i % 2 ? S.curtainDark : S.curtainLight; CX.globalAlpha = .55; CX.fillRect(sw * i / 2 + sw * .18, 0, sw * .1, vh * .82); }
    CX.globalAlpha = 1; CX.fillStyle = S.trim; CX.fillRect(0, vh * .86, W, 3);
    CX.restore();
  }

  // ---------- caption cards ----------
  // card(t, cards, o): a paper card hanging on two cords from the top of the frame, in front of the curtains. cards:
  // [{ t, text, id }]. The first drops in at its t on a springy cord and swings to rest; each later one flips the card
  // over (the old face folds up at the top edge, the new one unfolds down) centred on its t. o: { x (centre), y (rest
  // top), size (px), w (min width), out (time it lifts away) }. Text registers for --inspect only while the card faces
  // the viewer flat and has dropped into place.
  const CARD_SPRING = { stiffness: 190, damping: 15, mass: 1 }, CURTAIN_SPRING = { stiffness: 34, damping: 11.3, mass: 1 };   // the curtains: ~1.1 s to close, no overshoot
  let _paper = null;
  function paperTex() {
    if (_paper) return _paper; const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), id = g.createImageData(160, 160), r = rnd(31);
    for (let i = 0; i < id.data.length; i += 4) { const v = 200 + r() * 55 - (r() < .02 ? 60 : 0); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); _paper = c; return c;
  }
  function card(t, cards, o = {}) {
    const t0 = cards[0].t; if (t < t0) return;
    const size = o.size ?? 54, x = o.x ?? W / 2, restY = o.y ?? H * .1, ch = size * 2.25, F = .24;
    const keys = [[-1e4, 0], [t0, 1]]; if (o.out != null) keys.push([o.out, 0]);
    const drop = follow(t, keys, CARD_SPRING), top = lerp(-ch - 60, restY, drop);
    // which face shows, and how far it is turned
    let i = 0; while (i + 1 < cards.length && t >= cards[i + 1].t) i++;
    let sy = 1, shown = i; const nxt = cards[i + 1];
    if (nxt && t > nxt.t - F) { const p = EASE.inOut(seg(t, nxt.t - F, nxt.t)); sy = Math.cos(p * Math.PI / 2); }
    if (i > 0 && t < cards[i].t + F) { const p = EASE.inOut(seg(t, cards[i].t, cards[i].t + F)); sy = Math.sin(p * Math.PI / 2); shown = i; }
    // the swing: a decaying pendulum kicked by the drop and by every flip
    let ang = 0; for (const [te, A] of [[t0 + .12, .03], ...cards.slice(1).map(c => [c.t, .018])]) if (t > te) ang += A * Math.exp(-(t - te) * 2.3) * Math.sin((t - te) * 6.4);
    const c = cards[shown], font_ = { family: S.font, size, weight: 500 }, cw = Math.max(o.w ?? 0, ...cards.map(k => measure(k.text, font_) + size * 2.2));   // one width for every face
    CX.save(); CX.translate(x, 0); CX.rotate(ang);
    CX.strokeStyle = S.cord; CX.lineWidth = 2.5; for (const s of [-1, 1]) { CX.beginPath(); CX.moveTo(s * cw * .34, -20); CX.lineTo(s * cw * .34, top + 8); CX.stroke(); }
    CX.translate(0, top); CX.scale(1, Math.max(.001, sy));
    // a soft shadow on the curtain or the sky behind, faked with two offset fills (no blur filter)
    CX.fillStyle = 'rgba(8,4,6,.22)'; rr(-cw / 2 + 4, 10, cw, ch, 6); CX.fill(); CX.fillStyle = 'rgba(8,4,6,.14)'; rr(-cw / 2 + 8, 18, cw + 4, ch + 2, 10); CX.fill();
    rr(-cw / 2, 0, cw, ch, 3); CX.fillStyle = mixCol(S.paper, '#7A6A55', (1 - sy) * .6); CX.fill();
    CX.save(); rr(-cw / 2, 0, cw, ch, 3); CX.clip(); CX.globalCompositeOperation = 'multiply'; CX.globalAlpha = .55; CX.fillStyle = CX.createPattern(paperTex(), 'repeat'); CX.fillRect(-cw / 2, 0, cw, ch); CX.restore();
    CX.strokeStyle = rgba(S.paperInk, .45); CX.lineWidth = 1.5; rr(-cw / 2 + 10, 10, cw - 20, ch - 20, 2); CX.stroke();
    for (const s of [-1, 1]) circle(s * cw * .34, 8, 4.5, S.cord);
    text(sy > .97 && drop > .9 ? (c.id ?? 'card') : null, c.text, 0, ch * .63, { ...font_, color: S.paperInk, align: 'center' });
    CX.restore();
  }

  // ---------- finishing ----------
  function finish(o = {}) { vignette(o.vignette ?? .22, '#05030A'); grain(o.grain ?? .045); }

  return { S, CARD_SPRING, CURTAIN_SPRING, light, glow, pool, skyAt, sky, skyCol, tint, stage, ridge, ridgeY, ground, house, roofPerches, sign, emblems,
    fence, lamp, cart, tree, treePerches, roundTree, grass, town, smoke, perched, flyer, flock, rooster, gait, stand, turn, figure, travel, walker,
    stopX, curtains, card, finish };
})();
