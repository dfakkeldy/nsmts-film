// looks/kinetic.js: "self-demonstrating type on flat colour". Words act out what they mean on full-bleed flat fields:
// crack splits the frame, whisk swirls in, stack piles up, a struck word gets struck. One recurring dot carries the
// film (an i's tittle, a thing tossed off the top of the frame, a full stop once, the pen of the strike), fields flip
// colour instead of cutting, and over half a second of nothing comes before the strike-out.
// Card: looks/kinetic.md. Specimen: specimens/kinetic.
//
// A film is a list of CARDS, each { t, until, field, ink, top, words: [WORD] }: from t the frame is the card's field
// colour (a hard flip on the beat). A WORD is { id, text, face, size | fit, x, y, mid, align, acts } and acts is the
// word's performances, [[t0, name, o], ...], applied in order: every letter's transform is the composition of them
// all, so a word can drop in, squash when the dot lands on it, and be struck out, from one list. KIN.film(t, CARDS,
// { dot: DOT }) draws the lot; KIN.shots(CARDS, o) registers one shot per card so motion blur never smears a flip.

const KIN = (() => {
  const S = Object.assign({ cream: '#F2EADB', ink: '#16120E', cobalt: '#2836CC', yolk: '#FFA914',
    display: 'Barlow Condensed', sans: 'Space Grotesk', mono: 'IBM Plex Mono' }, P.kinetic || {});
  // three jobs, three faces: the performers (ultra-condensed black), the voice (a bold grotesk), the note (mono)
  const FACE = { display: { family: S.display, weight: 900 }, sans: { family: S.sans, weight: 700 }, mono: { family: S.mono, weight: 700 } };
  const faceOf = f => typeof f === 'string' ? FACE[f] : f || FACE.display;
  const SC = Math.min(W, H) / 1080;   // the module's few pixel constants are set at 1080 and scale with the frame
  const val = v => typeof v === 'function' ? v() : v;

  // ---------- springs ----------
  // land: a letter or the dot hitting something (quick, two visible wobbles); wobble: slower, for a pile; whisk: the
  // orbit's settle (a small back-swing); door: halves parting (critically damped); roll: a slot-machine swap.
  const SPR = { land: { stiffness: 520, damping: 15, mass: 1 }, wobble: { stiffness: 160, damping: 8, mass: 1 },
    whisk: { stiffness: 150, damping: 18, mass: 1 }, door: { stiffness: 150, damping: 24.5, mass: 1 }, roll: { stiffness: 300, damping: 28, mass: 1 } };
  // impulse(tau, spec): a spring's response to a knock at tau = 0, scaled so its first peak is 1, then ringing down.
  // Closed form, so any frame renders on its own. squash = impulse * amount.
  const _imp = new Map();
  function impulse(tau, spec = SPR.land) {
    if (tau <= 0) return 0;
    const s = typeof spec === 'string' ? SPR[spec] || SPRING[spec] : spec, key = `${s.stiffness}|${s.damping}|${s.mass || 1}`;
    let k = _imp.get(key);
    if (!k) { const m = s.mass || 1, w0 = Math.sqrt(s.stiffness / m), z = Math.min(.95, s.damping / (2 * Math.sqrt(s.stiffness * m))), wd = w0 * Math.sqrt(1 - z * z);
      const tp = Math.atan(wd / (z * w0)) / wd; k = { a: z * w0, wd, peak: Math.exp(-z * w0 * tp) * Math.sin(wd * tp) }; _imp.set(key, k); }
    return Math.exp(-k.a * tau) * Math.sin(k.wd * tau) / k.peak;
  }

  // ---------- layout ----------
  // lay(text, face, size): each glyph's advance box from prefix widths (so kerning survives letter-by-letter drawing)
  // and its ink box. Cached by its inputs: measurement, not state.
  const _lay = new Map();
  function lay(str, face, size) {
    const key = `${str}|${face.family}|${face.weight}|${size}`; if (_lay.has(key)) return _lay.get(key);
    CX.save(); CX.font = font(size, face); if ('letterSpacing' in CX) CX.letterSpacing = '0px'; CX.textAlign = 'left'; CX.textBaseline = 'alphabetic';
    const glyphs = [...str].map((ch, i, a) => {
      const x = CX.measureText(a.slice(0, i).join('')).width, adv = CX.measureText(a.slice(0, i + 1).join('')).width - x, m = CX.measureText(ch);
      return { ch, x, adv, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent, ink: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - adv / 2, iw: m.actualBoundingBoxRight + m.actualBoundingBoxLeft };
    });
    const mi = CX.measureText('i'), xh = CX.measureText('x').actualBoundingBoxAscent, stem = mi.actualBoundingBoxRight + mi.actualBoundingBoxLeft;
    const L = { str, face, size, glyphs, w: CX.measureText(str).width, xh, stem, iAsc: mi.actualBoundingBoxAscent,
      asc: Math.max(...glyphs.map(g => g.asc)), desc: Math.max(0, ...glyphs.map(g => g.desc)) };
    CX.restore(); _lay.set(key, L); return L;
  }
  const _fit = new Map();
  function fit(str, face, maxW) { const key = `${str}|${face.family}|${face.weight}|${maxW}`; if (!_fit.has(key)) _fit.set(key, fitSize(str, face, maxW, 12, 1200)); return _fit.get(key); }
  // place(w): where a word sits. size: w.size, or the size at which w.fitText (default its own text) fills w.fit px.
  // x, y: the anchor (align 'center' by default); mid: true puts y at the middle of the ink instead of the baseline.
  function place(w) {
    const face = faceOf(w.face), size = w.size ? val(w.size) : fit(w.fitText || w.text, face, w.fit || W * .8), L = lay(w.text, face, size);
    const ax = val(w.x) ?? W / 2, ay = val(w.y) ?? H / 2;
    const x0 = w.align === 'left' ? ax : w.align === 'right' ? ax - L.w : ax - L.w / 2, y = w.mid ? ay + (L.asc - L.desc) / 2 : ay;
    return { w, L, x0, y, n: L.glyphs.length, cx: x0 + L.w / 2, cy: y - L.xh / 2, home: i => [x0 + L.glyphs[i].x + L.glyphs[i].adv / 2, y] };
  }

  // ---------- letters ----------
  // A letter's transform: dx, dy (px), sx, sy (scale about its baseline centre), rot (radians, about the same point),
  // a (alpha). Acts return deltas: offsets add, scales and alpha multiply, rotations add.
  const ID = () => ({ dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, a: 1 });
  function compose(A, B) { if (!B) return; A.dx += B.dx || 0; A.dy += B.dy || 0; A.sx *= B.sx ?? 1; A.sy *= B.sy ?? 1; A.rot += B.rot || 0; A.a *= B.a ?? 1; }
  // a point given in letter i's own frame (lx right of its advance centre, ly down from its baseline) -> frame px
  function at(c, T, i, lx, ly) { const [hx, hy] = c.home(i), x = lx * T.sx, y = ly * T.sy, cs = Math.cos(T.rot), sn = Math.sin(T.rot);
    return [hx + T.dx + x * cs - y * sn, hy + T.dy + x * sn + y * cs]; }

  // pose(t, w): every letter's transform at t, plus the acts' overlays, clip, halves and legibility. Draws nothing.
  function pose(t, w) {
    const c = place(w), tr = c.L.glyphs.map(ID), after = []; let legible = true, clip = null, halves = null;
    for (const [t0, act, o = {}] of w.acts || []) {
      const f = typeof act === 'function' ? act : ACTS[act]; if (!f) throw new Error(`kinetic: no act "${act}"`);
      const r = f(t, t0, c, o); if (!r) continue;
      if (r.letter) tr.forEach((T, i) => compose(T, r.letter(i, T)));
      if (r.after) after.push(r.after);
      if (r.legible === false) legible = false;
      if (r.clip) clip = r.clip; if (r.halves) halves = r.halves;
    }
    if (tr.some(T => T.a < .6)) legible = false;
    return { c, tr, after, legible, clip, halves };
  }

  function glyph(c, i, T, color) {
    if (T.a <= .003 || Math.abs(T.sx) < 1e-3 || Math.abs(T.sy) < 1e-3) return;
    const g = c.L.glyphs[i], [hx, hy] = c.home(i);
    CX.save(); CX.translate(hx + T.dx, hy + T.dy); if (T.rot) CX.rotate(T.rot); CX.scale(T.sx, T.sy); CX.globalAlpha *= clamp(T.a);
    if (c.w.dotless && c.w.dotless.includes(i)) { CX.beginPath(); CX.rect(-c.L.size, -c.L.xh * 1.05, c.L.size * 2, c.L.size * 2); CX.clip(); }   // the dot plays this i's tittle
    CX.font = font(c.L.size, c.L.face); if ('letterSpacing' in CX) CX.letterSpacing = '0px';
    CX.textAlign = 'center'; CX.textBaseline = 'alphabetic'; CX.fillStyle = color; CX.fillText(g.ch, 0, 0); CX.restore();
  }

  // word(t, w): draw a word through its acts and, while it reads, register it for the checks (as one piece of text,
  // never letter by letter, so touching letters don't count as colliding). Returns the pose.
  function word(t, w) {
    const p = pose(t, w), { c, tr } = p, color = w.color || S.ink;
    const paint = () => { tr.forEach((T, i) => glyph(c, i, T, color)); for (const f of p.after) f(tr, c); };
    CX.save(); if (p.clip) { CX.beginPath(); CX.rect(...p.clip); CX.clip(); }
    if (p.halves) drawHalves(p.halves, w, paint); else paint();
    CX.restore();
    if (p.legible && w.id !== null) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, a = 1, sc = 0;
      tr.forEach((T, i) => { const g = c.L.glyphs[i];
        for (const [lx, ly] of [[-g.adv / 2, -g.asc], [g.adv / 2, -g.asc], [g.adv / 2, g.desc], [-g.adv / 2, g.desc]]) { const [x, y] = at(c, T, i, lx, ly); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        a = Math.min(a, T.a); sc += Math.sqrt(Math.abs(T.sx * T.sy)); });
      if (p.clip) { const [cx, cy, cw, ch] = p.clip; x0 = Math.max(x0, cx); y0 = Math.max(y0, cy); x1 = Math.min(x1, cx + cw); y1 = Math.min(y1, cy + ch); }
      readable(w.id || w.text, w.text, x0, y0, x1 - x0, y1 - y0, a * CX.globalAlpha, c.L.size * sc / tr.length);
    }
    return p;
  }

  // ---------- the acts (each a pure function of t and its start t0) ----------
  const ACTS = {
    // drop: letters fall in from above the frame, accelerating (gravity) and stretching as they fall, then squash on
    // the floor and ring out. o: stagger (s, default .045), fall (s, .32), squash (.32), order 'ltr' | 'rtl' | 'mid'.
    drop(t, t0, c, o) {
      const st = o.stagger ?? .045, fall = o.fall ?? .32, sq = o.squash ?? .32, from = o.from ?? -(c.y + c.L.size * .3);
      const ord = o.order === 'rtl' ? i => c.n - 1 - i : o.order === 'mid' ? i => Math.abs(i - (c.n - 1) / 2) : i => i;
      const last = Math.max(...c.L.glyphs.map((g, i) => ord(i)));
      return { legible: t >= t0 + last * st + fall,
        letter: i => { const tau = t - t0 - ord(i) * st; if (tau < 0) return { a: 0 };
          if (tau < fall) { const s = (tau / fall) ** 2; return { dy: from * (1 - s), sy: 1 + .2 * s, sx: 1 - .08 * s }; }
          const k = impulse(tau - fall) * sq; return { sy: 1 - k, sx: 1 + k * .75 }; } };
    },
    // fall: the exit: letters drop out through the bottom of the frame with a small seeded tumble. o: stagger, dur.
    fall(t, t0, c, o) {
      const st = o.stagger ?? .03, d = o.dur ?? .38, g = (H - c.y + c.L.size * 1.2) / (d * d);
      return { legible: t < t0, letter: i => { const tau = t - t0 - i * st; if (tau <= 0) return null;
        return { dy: g * tau * tau, rot: (hash(i * 3.7 + 1) - .5) * 1.2 * Math.min(1, tau / d) }; } };
    },
    // squash: a knock. The word flattens and spreads, then rings out on the land spring. o.at (a letter index or an x
    // in px) makes it a ripple travelling out from that point at o.speed px/s; o.amt (default .25).
    squash(t, t0, c, o) {
      const amt = o.amt ?? .25, ax = o.at == null ? c.cx : o.at < c.n ? c.home(o.at)[0] : o.at, sp = o.speed ?? 3200;
      return { letter: i => { const hx = c.home(i)[0], k = impulse(t - t0 - Math.abs(hx - ax) / sp, o.spring) * amt; if (!k) return null;
        return { sy: 1 - k, sx: 1 + k * .8, dx: (hx - c.cx) * k * .5 }; } };
    },
    // stretch: the word is pulled wider from one end and snaps back. o: k (peak width factor, 1.6), anchor 'left' |
    // 'right' | 'center', hold (s at full stretch before release, .35). Rides snappy out, bouncy back.
    stretch(t, t0, c, o) {
      const k = (o.k ?? 1.6) - 1, rel = t0 + (o.hold ?? .35), ax = o.anchor === 'right' ? c.x0 + c.L.w : o.anchor === 'center' ? c.cx : c.x0;
      const s = 1 + k * (springStep(t - t0, 'snappy') - springStep(t - rel, 'bouncy'));
      return { legible: s < 1.9, letter: i => ({ sx: s, dx: (c.home(i)[0] - ax) * (s - 1) }) };
    },
    // push: a slow scale about the word's middle from t0 to o.until (o.amt, .03): life in a hold, never a move.
    push(t, t0, c, o) {
      const s = 1 + (o.amt ?? .03) * EASE.inOut(seg(t, t0, o.until ?? t0 + 1.5)); if (s === 1) return null;
      return { letter: i => { const [hx, hy] = c.home(i); return { sx: s, sy: s, dx: (hx - c.cx) * (s - 1), dy: (hy - c.cy) * (s - 1) }; } };
    },
    // shiver: a tremble that grows from a quarter of o.amp at t0 to all of it at o.until, and stops at o.stop
    // (anticipation: the egg before it cracks). o.amp (px, 4).
    shiver(t, t0, c, o) {
      const A = (o.amp ?? 4) * (.25 + .75 * ease(seg(t, t0, o.until ?? t0 + 1))) * (t >= t0 && t < (o.stop ?? Infinity) ? 1 : 0); if (!A) return null;
      return { letter: i => ({ dx: noise(t * 26 + i * 3.1, 11) * A, dy: noise(t * 23 + i * 5.3, 23) * A * .6, rot: noise(t * 19 + i * 7.9, 37) * A * .004 }) };
    },
    // orbit: letters swing round a centre. mode 'in': they start bunched at the centre (o.r0 of their distance),
    // turned o.turns, and unwind into the line on the whisk spring (a small back-swing, then still). mode 'out':
    // they wind up and spiral into the centre (o.c: [x, y] or a function of t; default the word's centre) and vanish.
    orbit(t, t0, c, o) {
      const st = o.stagger ?? .03, turns = (o.turns ?? 1) * (o.dir ?? 1), out = o.mode === 'out', d = o.dur ?? .32;
      if (out && t <= t0) return null;   // (and the centre isn't asked for: it may be a point on this very word)
      const [ox, oy] = typeof o.c === 'function' ? o.c(t) : o.c || [c.cx, c.cy], r0 = o.r0 ?? .12;
      // order: 'near' sends the letters nearest the centre first (a whirlpool), otherwise left to right
      const rank = o.order === 'near' ? (() => { const d = c.L.glyphs.map((g, i) => Math.abs(c.home(i)[0] - ox)), u = [...new Set(d.map(v => Math.round(v / (c.L.size * .3))))].sort((a, b) => a - b);
        return i => u.indexOf(Math.round(d[i] / (c.L.size * .3))); })() : i => i;
      const ks = c.L.glyphs.map((g, i) => { const tau = t - t0 - rank(i) * st; return out ? easeIn(seg(tau, 0, d)) : tau < 0 ? -1 : springStep(tau, o.spring || SPR.whisk); });
      return { legible: out ? t < t0 : ks.every(k => Math.abs(1 - k) < .035),
        letter: i => { const k = ks[i]; if (k < 0) return { a: 0 }; if (out && k <= 0) return null;
          const [hx, hy] = c.home(i), th = out ? turns * TAU * k : -turns * TAU * (1 - k), rho = out ? 1 - k : lerp(r0, 1, k);
          // the letter's middle travels the orbit; its baseline point hangs below the middle, turned with it
          const vx = (hx - ox) * rho, vy = (hy - c.L.xh / 2 - oy) * rho, cs = Math.cos(th), sn = Math.sin(th), s = out ? 1 - .75 * k : lerp(.35, 1, clamp(k)), m = c.L.xh / 2 * s;
          const px = ox + vx * cs - vy * sn - m * sn, py = oy + vx * sn + vy * cs + m * cs;
          return { dx: px - hx, dy: py - hy, rot: th, sx: s, sy: s, a: out ? 1 - seg(k, .75, 1) : clamp(k * 6) }; } };
    },
    // flip: each letter turns over about its middle with a small hop. o.turns: 1 = all the way round, .5 = upside
    // down (a second .5 later turns it back); o.stagger, o.hop (px).
    flip(t, t0, c, o) {
      const st = o.stagger ?? .04, turns = o.turns ?? 1, hop = o.hop ?? c.L.size * .15;
      const ks = c.L.glyphs.map((g, i) => springStep(t - t0 - i * st, o.spring || 'snappy'));
      return { legible: ks.every(k => k <= 0 || Math.abs(1 - k) < .03),
        // turn about the letter's middle as it stands now (T.sy: an earlier flip may have left it upside down)
        letter: (i, T) => { const k = ks[i]; if (k <= 0) return null; const cs = Math.cos(TAU * turns * k), h = c.L.glyphs[i].asc / 2;
          return { sy: Math.abs(cs) < .04 ? .04 * Math.sign(cs || 1) : cs, dy: -h * T.sy * (1 - cs) - hop * Math.sin(Math.PI * clamp(k)) }; } };
    },
    // stack: the letters are tossed in from above, last letter first, each turning over (o.flips) as it falls, and
    // land on one another in a pile centred on o.base = [x, baseline of the bottom letter] (first letter on top).
    // Each landing squashes the letter and, less, the ones beneath it. o: stagger (.25), fall (.3), squash (.3),
    // fall0 (the first letter in, which falls furthest, is in the air this long instead and still lands at
    // t0 + fall: set it so it is already in view when its field flips in), flat ([sx, sy] each letter keeps once
    // landed, [1.2, .88]: pancakes), gap (px), hits: [[t, amt]] extra knocks from above (something landing on top).
    stack(t, t0, c, o) {
      const n = c.n, st = o.stagger ?? .25, fall = o.fall ?? .3, sq = o.squash ?? .3, [fx, fy] = o.flat || [1.2, .88], gap = o.gap ?? c.L.size * .025;
      const [bx, by] = typeof o.base === 'function' ? o.base() : o.base || [c.cx, c.y], G = c.L.glyphs;
      const land = i => t0 + (n - 1 - i) * st + fall, air = i => i === n - 1 ? o.fall0 ?? fall : fall;
      // the squash each letter carries: its own landing, plus a share of each landing above it and of any hits
      const K = G.map((g, j) => { let k = impulse(t - land(j)) * sq; for (let i = 0; i < j; i++) k += impulse(t - land(i)) * sq * .3 * (1 - (j - i) / n);
        for (const [ht, ha] of o.hits || []) k += impulse(t - ht) * ha * (1 - j / (n + 1)); return clamp(k, -.4, .6); });
      const base = []; base[n - 1] = by; for (let i = n - 2; i >= 0; i--) base[i] = base[i + 1] - G[i + 1].asc * fy * (1 - K[i + 1]) - gap - G[i].desc * fy;
      return { legible: t >= land(0) + .04,
        letter: i => { const g = G[i], fa = air(i), tau = t - (land(i) - fa); if (tau < 0) return { a: 0 };
          const [hx, hy] = c.home(i), px = bx + (hash(i * 13.1 + (o.seed || 1)) - .5) * c.L.size * .1 - g.ink * fx, rj = (hash(i * 7.7 + (o.seed || 1)) - .5) * .05;
          if (tau < fa) { const p = tau / fa, cs = Math.cos(TAU * (o.flips ?? 1) * p), from = o.from ?? -(base[i] + c.L.size * .5);
            return { dx: px - hx, dy: base[i] - hy + from * (1 - p * p) - g.asc * fy / 2 * (1 - cs), sx: fx, sy: fy * (Math.abs(cs) < .04 ? .04 : cs), rot: rj * p }; }
          return { dx: px - hx, dy: base[i] - hy, sx: fx * (1 + K[i] * .7), sy: fy * (1 - K[i]), rot: rj }; } };
    },
    // tilt: the whole word (as it stands, after the acts before this one) turns about a pivot by o.angle(t) radians:
    // a sway, or a topple. o.pivot: [x, y] or a function of t. Reads while the angle is under o.reads (.2).
    tilt(t, t0, c, o) {
      if (t < t0) return null; const a = o.angle(t); if (!a) return null; const [px, py] = typeof o.pivot === 'function' ? o.pivot(t) : o.pivot, cs = Math.cos(a), sn = Math.sin(a);
      return { legible: Math.abs(a) < (o.reads ?? .2), letter: (i, T) => { const [hx, hy] = c.home(i), x = hx + T.dx - px, y = hy + T.dy - py;
        return { dx: x * cs - y * sn - x, dy: x * sn + y * cs - y, rot: a }; } };
    },
    // strike: a thick line drawn through the word over o.dur on the outExpo curve, from the left (o.from 'left') or
    // back from the right ('right'). o.left / o.right: the line's height at each end as a fraction of the x-height
    // (.5 = through the middle; .95 and .12 make a falling slash); o.over: px past each end; o.color, o.lw. The line is
    // cut into one piece per letter, so if the letters move afterwards (a roll, a fall) each carries its piece.
    // o.fade: [t1, t2] fades the pieces out over that window, letter i o.fadeStagger s later than letter 0 (give it
    // the roll's stagger, so each piece goes as its letter starts to leave and a swap doesn't drag a staircase).
    strike(t, t0, c, o) {
      const p = EASE.outExpo(seg(t, t0, t0 + (o.dur ?? .3))); if (p <= 0) return null;
      const fd = o.fade, fst = o.fadeStagger ?? 0, keep = i => fd ? 1 - EASE.inOut(seg(t, fd[0] + i * fst, fd[1] + i * fst)) : 1;
      if (fd && t >= fd[1] + (c.n - 1) * fst) return null;
      const [A, B] = strikeLine(c, o), [S0, S1] = o.from === 'right' ? [B, A] : [A, B], head = [lerp(S0[0], S1[0], p), lerp(S0[1], S1[1], p)];
      const lw = o.lw ?? c.L.size * .085, col = o.color || S.yolk;
      return { after: tr => tr.forEach((T, i) => { const a = T.a * keep(i); if (a <= .003) return; const g = c.L.glyphs[i], l = i ? c.x0 + g.x : -W, r = i < c.n - 1 ? c.x0 + g.x + g.adv : 2 * W;
        CX.save(); CX.beginPath(); CX.rect(l + T.dx - .75, -H, r - l + 1.5, 3 * H); CX.clip(); CX.translate(T.dx, T.dy); line([S0, head], col, lw, { alpha: a }); CX.restore(); }) };
    },
    // roll: half of a swap: the word rolls out upward (mode 'out') or in from below ('in'), letter by letter on the
    // roll spring, inside a band the height of the line, like a split-flap. Pair them with KIN.swap(t0).
    roll(t, t0, c, o) {
      const st = o.stagger ?? .04, h = o.dist ?? (c.L.asc + c.L.desc) * 1.3, out = o.mode === 'out', pad = o.pad ?? c.L.size * .12;
      const ks = c.L.glyphs.map((g, i) => springStep(t - t0 - i * st, o.spring || SPR.roll));
      if (out && t < t0) return null;   // (an out-roll doesn't clip the word before it starts: it may still be landing)
      return { clip: [0, c.y - c.L.asc - pad, W, c.L.asc + c.L.desc + pad * 2], legible: out ? ks.every(k => k < .08) : ks.every(k => k > .94),
        letter: i => out ? { dy: -h * ks[i] } : { dy: h * (1 - ks[i]) } };
    },
    // typewriter: the text appears a character at a time (kit.js typed(): o.cps, a hair of human jitter) with a caret
    // that blinks once it stops. o.caret: a colour, or false.
    type(t, t0, c, o) {
      const ty = typed(t, t0, c.w.text, o.cps ?? 16), n = [...ty.str].length;
      return { legible: ty.done, letter: i => ({ a: i < n && t >= t0 ? 1 : 0 }),
        after: () => { if (o.caret === false || !ty.caret || t < t0) return; const g = c.L.glyphs[n - 1], x = c.x0 + (n ? g.x + g.adv : 0) + c.L.size * .06;
          CX.save(); CX.fillStyle = o.caret || c.w.color || S.ink; CX.fillRect(x, c.y - c.L.asc * 1.02, c.L.size * .5, c.L.asc * 1.02 + c.L.desc * .4); CX.restore(); } };
    },
    // split: the frame cracks along a jagged line through the word (drawn on at o.line over .1 s in o.color, the
    // colour behind), then at t0 the two halves, field and all, part to the frame edges on the door spring. The card
    // that splits must be drawn last while it does (card.top). o: x (the crack's x, default the word's centre), seed.
    // The word still counts as read for .09 s after t0: the halves are under a third of the way apart, each one intact.
    split(t, t0, c, o) {
      const tl = o.line ?? t0 - .25, lp = seg(t, tl, tl + .1); if (lp <= 0) return null;
      return { halves: { pts: crack(c, o), lp, gap: springStep(t - t0, SPR.door) * (W / 2 + 80 * SC), color: o.color || S.ink }, legible: t < t0 + .09 };
    },
  };
  // the strike's two ends for a placed word
  // (left, right, overL, overR may be functions of the placed word, to meet something exactly: the dot)
  function strikeLine(c, o) { const v = (x, d) => typeof x === 'function' ? x(c) : x ?? d, over = v(o.over, c.L.size * .08);
    return [[c.x0 - v(o.overL, over), c.y - c.L.xh * v(o.left, .5)], [c.x0 + c.L.w + v(o.overR, over), c.y - c.L.xh * v(o.right, .5)]]; }
  // where the strike's moving end is at t (for the dot to ride it): KIN.strikeHead(t, WORD, act)
  function strikeHead(t, w, act) { const [t0, , o = {}] = act, c = place(w), [A, B] = strikeLine(c, o), [S0, S1] = o.from === 'right' ? [B, A] : [A, B], p = EASE.outExpo(seg(t, t0, t0 + (o.dur ?? .3)));
    return [lerp(S0[0], S1[0], p), lerp(S0[1], S1[1], p)]; }
  // a jagged crack from above the frame to below it, wilder where it crosses the word
  const _crk = new Map();
  function crack(c, o) {
    const x = o.x ?? c.cx, key = `${x}|${c.y}|${o.seed || 5}`; if (_crk.has(key)) return _crk.get(key);
    const r = rnd(o.seed || 5), pts = [[x, -20]], u = SC; let y = -20;
    while (y < H + 20) { const inWord = y > c.y - c.L.asc - 20 * u && y < c.y + c.L.desc + 20 * u; y += (inWord ? 26 + r() * 30 : 70 + r() * 90) * u; pts.push([x + (r() - .5) * (inWord ? 70 : 26) * u, Math.min(y, H + 20)]); }
    _crk.set(key, pts); return pts;
  }
  function drawHalves(hv, w, paint) {
    const { pts, gap, lp, color } = hv, field = w.field;
    if (gap < .5) { if (field) { CX.fillStyle = field; CX.fillRect(0, 0, W, H); } paint(); if (lp > 0) lineTo(pts, lp, color, 7 * SC, { cap: 'round' }); return; }
    for (const side of [-1, 1]) {
      CX.save(); CX.translate(side * gap, 0);   // move first: a path is fixed where it is built
      CX.beginPath(); CX.moveTo(side * 2 * W, -40); pts.forEach(([x, y]) => CX.lineTo(x, y)); CX.lineTo(side * 2 * W, H + 40); CX.closePath(); CX.clip();
      if (field) { CX.fillStyle = field; CX.fillRect(-2 * W, -40, 5 * W, H + 80); }
      paint(); CX.restore();
    }
  }
  // swap(t0, o): the two acts of a swap, { out, in }: put out on the old word and in on the new, same place and size.
  const swap = (t0, o = {}) => ({ out: [t0, 'roll', { ...o, mode: 'out' }], in: [t0 + (o.lag ?? .06), 'roll', { ...o, mode: 'in' }] });

  // anchors on a word, after its acts at t: the tittle over letter i ('i' drawn dotless), the top of letter i, and the
  // full stop after the word. Each returns [x, y] of the dot's centre for a dot of radius r.
  function tittle(t, w, i, r) { const p = pose(t, w), c = p.c, g = c.L.glyphs[i], lift = Math.max(c.L.stem * .35, c.L.iAsc - c.L.xh - c.L.stem);
    return at(c, p.tr[i], i, g.ink, -(c.L.xh + lift + r)); }
  function top(t, w, i, r) { const p = pose(t, w), c = p.c, g = c.L.glyphs[i]; return at(c, p.tr[i], i, g.ink, -(g.asc + r)); }
  function stop(t, w, r, gapK = .1) { const p = pose(t, w), c = p.c, i = c.n - 1, g = c.L.glyphs[i];
    return at(c, p.tr[i], i, g.adv / 2 + c.L.size * gapK + r, -r); }

  // ---------- the dot ----------
  // dot(t, KEYS) -> { x, y, r, sx, sy }. KEYS: [{ t, at: [x, y] or a function of t, r, how, dur, h, land, spin,
  // pulse, pop }]: be at `at` from time t (a function keeps it on a moving thing). The move toward a key starts dur
  // seconds before it: how 'hop' (an arc h px high), 'fall' (accelerating), 'toss' (thrown out of frame: sideways
  // speed first, rising and slowing), 'glide' (eased), 'ride' (follow `at` itself through the window: a strike's
  // moving end), or a cut.
  // On arrival: land (squash amount), pop (scale in from nothing), pulse (a swell, for swallowing something).
  const HOP = bezier(.3, .1, .55, 1);   // a hop's sideways travel: leaves briskly, arrives gently
  function dotState(t, keys) {
    const pos = (k, tt) => typeof k.at === 'function' ? k.at(tt) : k.at;
    let j = 0; for (let i = 0; i < keys.length; i++) if (t >= keys[i].t - (keys[i].dur || 0)) j = i;
    const rad = i => { for (; i >= 0; i--) if (keys[i].r != null) return keys[i].r; return 30; };   // a key without r keeps the last one set
    const k = keys[j], prev = keys[j - 1] || k, r1 = rad(j), r0 = rad(Math.max(0, j - 1));
    let x, y, r = r1, sx = 1, sy = 1;
    if (t < k.t && k.dur) {
      const s0 = k.t - k.dur, p = seg(t, s0, k.t), [fx, fy] = pos(prev, s0), [tx, ty] = pos(k, t);
      r = lerp(r0, r1, ease(p));
      if (k.how === 'ride') [x, y] = pos(k, t);
      else if (k.how === 'fall') { x = lerp(fx, tx, ease(p)); y = lerp(fy, ty, p * p); sy = 1 + .16 * p * p; sx = 1 - .08 * p * p; }
      else if (k.how === 'toss') { x = lerp(fx, tx, easeOut(p)); y = lerp(fy, ty, 1 - (1 - p) ** 2); }   // leaves at full speed both ways
      else if (k.how === 'glide') { const e = EASE.inOut(p); x = lerp(fx, tx, e); y = lerp(fy, ty, e); }
      else { const e = HOP(p); x = lerp(fx, tx, e); y = lerp(fy, ty, p) - (k.h ?? 120 * SC) * 4 * p * (1 - p); }   // hop
      if (k.spin) sy *= Math.max(.14, Math.abs(Math.cos(Math.PI * k.spin * p)));
    } else {
      [x, y] = pos(k, t);
      if (k.land) { const q = impulse(t - k.t) * k.land; sx = 1 + q * .6; sy = 1 - q * .5; }
      if (k.pop) r = r1 * springStep(t - k.t, 'bouncy');
    }
    for (const q of keys) if (q.pulse) r *= 1 + q.pulse * kick(t, q.t, { tau: .12 });
    return { x, y, r: Math.max(0, r), sx, sy };
  }
  // the dot is anchored at its bottom when it squashes, so it sits on whatever it landed on
  function drawDot(d, col = S.yolk) {
    if (d.r < .5) return; CX.save(); CX.translate(d.x, d.y + d.r * (1 - d.sy)); CX.scale(d.sx, d.sy);
    CX.beginPath(); CX.arc(0, 0, d.r, 0, TAU); CX.fillStyle = col; CX.fill(); CX.restore();
  }

  // ---------- the film ----------
  // film(t, CARDS, o): the field of the latest card to start, then every live card's words (a card is live from
  // card.from ?? card.t until card.until), cards with an active `top: [a, b]` window last, then the dot (o.dot keys).
  function film(t, cards, o = {}) {
    let base = cards[0]; for (const c of cards) if (c.t <= t) base = c;
    bg(base.field);
    const live = cards.filter(c => t >= (c.from ?? c.t) && t < (c.until ?? Infinity)).map(c => ({ c, z: c.top && t >= c.top[0] && t < c.top[1] ? 1 : 0 })).sort((a, b) => a.z - b.z);
    const poses = {};
    for (const { c } of live) for (const w of c.words) poses[w.id || w.text] = word(t, { color: c.ink, field: c.field, ...w });
    let dot = null; if (o.dot) { dot = dotState(t, o.dot); drawDot(dot, o.dotColor || S.yolk); }
    return { card: base, poses, dot };
  }
  // one shot per card, so --subframes motion blur never averages two fields across a flip
  function shotsFor(cards, o = {}) { shots(cards.map(c => [c.t, t => film(t, cards, o)])); }

  return { S, FACE, SPR, SC, ACTS, impulse, lay, place, pose, word, strikeHead, strikeLine, tittle, top, stop, swap, dotState, drawDot, film, shots: shotsFor };
})();
