// looks/pixel.js: "16-bit pixel diorama". The frame is a low-resolution buffer (320 x 180 by default) of PALETTE
// INDICES, drawn with integer coordinates from a fixed palette of 32 colours and scaled up by a whole number with
// nearest-neighbour (6x at 1920 x 1080). Because the buffer holds indices, not colours, the hardware tricks come free:
// a palette change recolours the whole frame at once (night to dawn, a flash, a fade), light is an index remap (each
// colour to the next step of its ramp) dithered at the edge, and water mirrors the rows above it through a darker map.
// Sprites and tiles are string maps (one character per pixel, one character per palette entry, '.' transparent), text
// is a bitmap font drawn from the glyph data below (never a smoothed TTF), gradients are ordered Bayer dithers.
// Card: looks/pixel.md. Specimen: specimens/pixel.
//
// A frame: PIX.begin('0'); ...draw layers back to front...; PIX.present(PIX.mix(PIX.NIGHT, PIX.DAWN, k)). Everything
// is a pure function of t: positions are computed in floats from t and floored only when a pixel is written.

const PIX = (() => {
  const S = Object.assign({ w: 320, h: 180 }, P.pixel || {});
  const LW = S.w, LH = S.h, SC = Math.floor(Math.min(W / LW, H / LH));
  if (SC < 1) throw new Error(`pixel: the frame (${W} x ${H}) is smaller than the low-res buffer (${LW} x ${LH})`);
  if (W % LW || H % LH || W / LW !== H / LH) console.warn(`pixel: ${W} x ${H} is not a whole multiple of ${LW} x ${LH}; the picture is letterboxed at ${SC}x`);
  const OX = Math.floor((W - LW * SC) / 2), OY = Math.floor((H - LH * SC) / 2);

  // ---------- palette: 32 entries, one character each ----------
  // Fixed entries (characters, UI, fire) keep their colour all day; the environment entries (digits, grass, water,
  // stars) have a NIGHT and a DAWN colour, and PIX.mix() steps between them.
  const CHARS = S.chars || 'kwsShcCbyYrfFomM0123456789aAdeEn';
  const IDX = {}; [...CHARS].forEach((c, i) => { IDX[c] = i; });
  const ci = c => typeof c === 'number' ? c : (IDX[c] ?? (() => { throw new Error(`pixel: "${c}" is not a palette character (${CHARS})`); })());
  const FIXED = {
    k: '#140c1c', w: '#fff4dc', s: '#f2b48c', S: '#c47a5a', h: '#4a2a2a', c: '#3aa38f', C: '#23606a', b: '#8c5a3a',
    y: '#ffcf4a', Y: '#e8842e', r: '#e04a5a', f: '#fff3a0', F: '#ffb03a', o: '#e8502e', m: '#8a8aa8', M: '#44445e' };
  const NIGHT = Object.assign({}, FIXED, {
    0: '#0b0920', 1: '#15123a', 2: '#221c56', 3: '#34287a', 4: '#1c1844', 5: '#2e2866', 6: '#110f30', 7: '#201c4c',
    8: '#110e28', 9: '#231c44', a: '#143040', A: '#22545a', d: '#0a0c2a', e: '#18285a', E: '#3c5aa0', n: '#e6e2ff' }, S.night || {});
  const DAWN = Object.assign({}, FIXED, {
    0: '#2a1d5a', 1: '#5a2c78', 2: '#a8467a', 3: '#f08a6a', 4: '#4a2f6a', 5: '#8a4a7a', 6: '#2e2050', 7: '#5a3a6a',
    8: '#24183a', 9: '#44294e', a: '#2e6a52', A: '#7ab060', d: '#3a2460', e: '#a04a74', E: '#ffc070', n: '#5a2c78' }, S.dawn || {});
  // mix(A, B, k, steps): palette A moved toward B by k, quantised to `steps` steps (a hardware fade moves in steps)
  function mix(A, B, k, steps = 4) { const q = steps ? Math.round(clamp(k) * steps) / steps : clamp(k), o = {};
    for (const c of CHARS) o[c] = q <= 0 ? A[c] : q >= 1 ? B[c] : mixCol(A[c], B[c], q); return o; }
  // toward(A, hex, k): every entry toward one colour: a flash (toward white) or a fade (toward black)
  function toward(A, hex, k) { const o = {}; for (const c of CHARS) o[c] = k <= 0 ? A[c] : mixCol(A[c], hex, clamp(k)); return o; }
  function lut(pal) { const L = new Uint32Array(32);
    for (const c of CHARS) { const n = parseInt((pal[c] || '#ff00ff').slice(1), 16); L[IDX[c]] = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16 & 255)) >>> 0; }
    return L; }

  // remap tables: LIT moves each colour one step up its ramp (light), DIM one step down, REFL turns what water mirrors
  // into the three water colours (sky and land to deep and mid water, anything bright to the highlight)
  const RAMPS = S.ramps || ['0123', '45', '67', '89', 'aA', 'deE', 'Cc', 'Ss', 'hb', 'Mm', 'Yy'];   // fire and hair are never relit
  const table = f => { const T = new Uint8Array(32); for (let i = 0; i < 32; i++) T[i] = i; f(T); return T; };
  const LIT = table(T => { for (const r of RAMPS) for (let i = 0; i < r.length - 1; i++) T[ci(r[i])] = ci(r[i + 1]); });
  const DIM = table(T => { for (const r of RAMPS) for (let i = 1; i < r.length; i++) T[ci(r[i])] = ci(r[i - 1]); });
  const REFL = table(T => { for (let i = 0; i < 32; i++) T[i] = ci('d');
    for (const [from, to] of Object.entries({ 2: 'e', 3: 'e', 5: 'e', 7: 'd', A: 'e', e: 'e', E: 'E', n: 'E', f: 'E', F: 'E', y: 'E', Y: 'e', w: 'E', o: 'e', r: 'e', c: 'e' })) T[ci(from)] = ci(to); });
  const remap = obj => table(T => { for (const [a, b] of Object.entries(obj)) T[ci(a)] = ci(b); });

  // ---------- the buffer ----------
  const V = new Uint8Array(LW * LH);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;   // ordered-dither threshold, 0..1, pure in (x, y)
  function begin(c = 'k') { V.fill(ci(c)); }
  function pset(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < LW && y < LH) V[y * LW + x] = ci(c); }
  function pget(x, y) { x = Math.floor(x); y = Math.floor(y); return V[clampI(y, 0, LH - 1) * LW + clampI(x, 0, LW - 1)]; }
  const clampI = (v, a, b) => v < a ? a : v > b ? b : v;
  function rect(x, y, w, h, c) { const i = ci(c), x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(LW, Math.floor(x) + Math.floor(w)), y1 = Math.min(LH, Math.floor(y) + Math.floor(h));
    for (let yy = y0; yy < y1; yy++) V.fill(i, yy * LW + x0, yy * LW + Math.max(x0, x1)); }
  // dither(x, y, w, h, c, level): c on the pixels whose Bayer threshold is under level (0 none, .5 a checker, 1 all)
  function dither(x, y, w, h, c, level) { const i = ci(c); x = Math.floor(x); y = Math.floor(y);
    for (let yy = Math.max(0, y); yy < Math.min(LH, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(LW, x + w); xx++) if (bayer(xx, yy) < level) V[yy * LW + xx] = i; }
  // Bresenham line, one pixel wide
  function line(x0, y0, x1, y1, c) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (let n = 0; n < 2000; n++) { pset(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  // a filled pixel circle (the +r*.8 rounds its silhouette the way pixel artists draw circles)
  function disc(cx, cy, r, c) { cx = Math.round(cx); cy = Math.round(cy); const R = r * r + r * .8;
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) if (x * x + y * y <= R) pset(cx + x, cy + y, c); }
  // gradient(y0, y1, 'chars', o): a vertical ramp through the colours, flat bands with dithered seams. o.band (0..1) is
  // how much of each step is dithered (1 = a fully dithered ramp); o.x0, o.x1 limit it to columns.
  function gradient(y0, y1, cols, o = {}) {
    const idx = [...cols].map(ci), n = idx.length, band = o.band ?? .5, x0 = Math.max(0, o.x0 ?? 0), x1 = Math.min(LW, o.x1 ?? LW);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(LH, Math.ceil(y1)); y++) {
      const p = clamp((y - y0 + .5) / (y1 - y0)) * (n - 1), i = Math.min(n - 2, Math.floor(p)), f = p - i, lv = clamp((f - (1 - band) / 2) / band);
      for (let x = x0; x < x1; x++) V[y * LW + x] = bayer(x, y) < lv ? idx[i + 1] : idx[i];
    }
  }

  // ---------- sprites and tiles: string maps ----------
  // A map is an array of equal-length strings (or one string with '/' between rows); each character is a palette
  // character, '.' or ' ' is transparent. Parsed once and cached.
  // A character that isn't in the palette is a SLOT: it must be given a colour when drawn (o.remap { L: 'f' }), so
  // one map serves a lamp lit and unlit, a door open and shut.
  const _maps = new Map(), SLOTS = {}, SLOTNAME = [];
  const si = ch => IDX[ch] ?? SLOTS[ch] ?? (SLOTS[ch] = 32 + SLOTNAME.push(ch) - 1);
  function parse(map) {
    if (_maps.has(map)) return _maps.get(map);
    const rows = Array.isArray(map) ? map : String(map).split('/'), w = Math.max(...rows.map(r => r.length)), h = rows.length, d = new Int16Array(w * h).fill(-1);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && ch !== ' ') d[y * w + x] = si(ch); }));
    const s = { w, h, d }; _maps.set(map, s); return s;
  }
  // sprite(map, x, y, o): top-left at (x, y). o.flip mirrors it; o.remap {from: to} swaps colours (a lit lamp, a
  // palette-swapped enemy); o.solid draws every pixel in one colour (a silhouette, a shadow); o.table remaps through a
  // table (PIX.LIT, PIX.DIM).
  function sprite(map, x, y, o = {}) {
    const s = parse(map), X = Math.floor(x), Y = Math.floor(y), rm = o.remap ? remapIdx(o.remap) : null, solid = o.solid != null ? ci(o.solid) : -1;
    for (let j = 0; j < s.h; j++) { const yy = Y + j; if (yy < 0 || yy >= LH) continue;
      for (let i = 0; i < s.w; i++) { const v = s.d[j * s.w + (o.flip ? s.w - 1 - i : i)]; if (v < 0) continue; const xx = X + i; if (xx < 0 || xx >= LW) continue;
        let c = rm ? rm[v] : v; if (c >= 32) throw new Error(`pixel: slot "${SLOTNAME[c - 32]}" needs a colour (o.remap)`);
        V[yy * LW + xx] = solid >= 0 ? solid : o.table ? o.table[c] : c; } }
    return s;
  }
  const _rms = new Map();
  function remapIdx(obj) { const k = JSON.stringify(obj); if (_rms.has(k)) return _rms.get(k);
    const T = new Uint8Array(64); for (let i = 0; i < 64; i++) T[i] = i; for (const [a, b] of Object.entries(obj)) T[si(a)] = ci(b); _rms.set(k, T); return T; }
  const size = map => { const s = parse(map); return [s.w, s.h]; };
  // tiles(rows, set, ox, oy, o): a tile map. rows are strings, one character per tile; set maps a character to a tile
  // (a string map) or to an array of variants (picked by a hash of the cell, so a field of grass isn't a wallpaper).
  // ox, oy: where tile (0, 0) lands on screen (pass -scroll for a scrolling layer). '.' is an empty cell.
  function tiles(rows, set, ox, oy, o = {}) {
    const tw = o.tw || 8, th = o.th || 8, c0 = Math.max(0, Math.floor(-ox / tw)), c1 = Math.ceil((LW - ox) / tw);
    rows.forEach((row, r) => { for (let c = c0; c < Math.min(row.length, c1); c++) {
      const ch = row[c]; if (ch === '.' || ch === ' ') continue; let t = set[ch]; if (!t) throw new Error(`pixel: no tile "${ch}"`);
      if (Array.isArray(t[0]) || (Array.isArray(t) && typeof t[0] === 'string' && t[0].includes('/'))) t = t[Math.floor(hash(c * 7.31 + r * 13.7 + (o.seed || 0)) * t.length)];
      sprite(t, ox + c * tw, oy + r * th, o); } });
  }

  // ---------- parallax and scenery ----------
  // a layer at depth f moves f pixels for each pixel the camera moves, in whole pixels (so slow layers step)
  const scroll = (cam, f) => Math.floor(cam * f);
  // heightFn(o): the top edge of a range of hills or mountains as a function of world x: value noise in two octaves,
  // with an optional valley { x, w, depth } (a dip for a sun to rise through). o: base, amp, freq, seed.
  function heightFn(o) {
    return wx => { let v = .65 * (noise(wx * o.freq, o.seed) * .5 + .5) + .35 * (noise(wx * o.freq * 2.7, o.seed + 7) * .5 + .5);
      if (o.valley) { const k = Math.max(0, 1 - Math.abs(wx - o.valley.x) / o.valley.w); v -= o.valley.depth / o.amp * k * k * (3 - 2 * k); }
      return Math.round(o.base - o.amp * Math.max(0, v)); };
  }
  // ridge(o): a silhouette filled from its top edge down to o.bottom, with a 1 px rim on the slopes that face the light
  // (o.light -1 from the left, 1 from the right). o: cam, f, fill, rim, bottom, plus heightFn's fields (or o.h).
  function ridge(o) {
    const hf = o.h || heightFn(o), sx = scroll(o.cam || 0, o.f ?? 1), fill = ci(o.fill), rim = o.rim != null ? ci(o.rim) : -1, bot = Math.min(LH, o.bottom ?? LH), L = o.light ?? -1;
    for (let x = 0; x < LW; x++) {
      const top = Math.max(0, hf(x + sx)), side = hf(x + sx + L);
      for (let y = top; y < bot; y++) V[y * LW + x] = fill;
      if (rim >= 0 && top < bot) { V[top * LW + x] = rim; for (let y = top + 1; y < Math.min(bot, side); y++) V[y * LW + x] = rim; }
    }
    return hf;
  }
  // stamps(map, o): one sprite repeated along a layer every o.gap world px with jitter (trees on a hill, posts, reeds).
  // o: cam, f, gap, y (bottom edge; a number or a function of world x, e.g. a ridge's heightFn), seed, skip (0..1).
  function stamps(map, o) {
    const s = parse(map), sx = scroll(o.cam || 0, o.f ?? 1), gap = o.gap, seed = o.seed || 0;
    for (let i = Math.floor((sx - s.w - gap) / gap); i <= Math.floor((sx + LW) / gap) + 1; i++) {
      if (o.skip && hash(i * 7.13 + seed) < o.skip) continue;
      const wx = i * gap + Math.floor(hash(i * 3.71 + seed) * (o.jitter ?? gap * .6)), yb = typeof o.y === 'function' ? o.y(wx) : o.y;
      sprite(map, wx - sx - (s.w >> 1), yb - s.h + (o.sink || 0), { flip: o.flip ?? hash(i * 1.9 + seed) < .5, remap: o.remap });
    }
  }
  // stars(o): a seeded field that twinkles in steps. o: n, seed, y0, y1, cam, f, t, fps (twinkle rate), c (bright),
  // dim (the colour a star dips to), big (fraction drawn as small crosses)
  function stars(o) {
    const r = rnd(o.seed || 5), sx = scroll(o.cam || 0, o.f ?? .03), fps = o.fps ?? 3, c = ci(o.c || 'n'), dim = o.dim != null ? ci(o.dim) : -1;
    for (let i = 0; i < o.n; i++) {
      const x = ((Math.floor(r() * 4096) - sx) % LW + LW) % LW, y = Math.floor(lerp(o.y0, o.y1, r())), ph = r() * 8, big = r() < (o.big ?? .1);
      const step = Math.floor((o.t || 0) * fps + ph), lit = hash(i * 13.1 + step * 7.7) > .25;
      const col = lit ? c : dim; if (col < 0) continue;
      pset(x, y, col); if (big && lit) { pset(x - 1, y, dim >= 0 ? dim : col); pset(x + 1, y, dim >= 0 ? dim : col); pset(x, y - 1, dim >= 0 ? dim : col); pset(x, y + 1, dim >= 0 ? dim : col); }
    }
  }
  // cloud(x, y, len, c): a long thin cloud, four rows, its ends dithered
  function cloud(x, y, len, c, o = {}) {
    const rows = o.rows || [.45, .8, 1, .6];
    rows.forEach((k, j) => { const w = Math.round(len * k), x0 = Math.round(x + (len - w) / 2 + (o.lean || 0) * j), e = Math.min(6, Math.floor(w / 4));
      rect(x0 + e, y + j, w - 2 * e, 1, c); dither(x0, y + j, e, 1, c, .5); dither(x0 + w - e, y + j, e, 1, c, .5); });
  }

  // ---------- light, water, transitions (operate on the indices already drawn) ----------
  // light(x, y, r, o): everything within r of (x, y) moves one step up its ramp (o.table, default LIT); the outer
  // o.soft px are Bayer-dithered so the edge of the pool reads as a 16-bit gradient. o.core (px) applies the table a
  // second time near the centre; o.clip [x0, y0, x1, y1] keeps it inside a rectangle (a sky glow that mustn't spill
  // onto water). Overlapping lights add up.
  function light(x, y, r, o = {}) {
    if (r <= 0) return; const T = o.table || LIT, soft = o.soft ?? Math.max(2, r * .4), core = o.core || 0, [cx0, cy0, cx1, cy1] = o.clip || [0, 0, LW, LH];
    const x0 = Math.max(0, cx0, Math.floor(x - r)), x1 = Math.min(LW - 1, cx1 - 1, Math.ceil(x + r)), y0 = Math.max(0, cy0, Math.floor(y - r)), y1 = Math.min(LH - 1, cy1 - 1, Math.ceil(y + r));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx + .5 - x, yy + .5 - y); if (d >= r) continue;
      const k = yy * LW + xx; if (d < r - soft || bayer(xx, yy) < (r - d) / soft) V[k] = T[V[k]];
      if (core && d < core) V[k] = T[V[k]];
    }
  }
  // reflect(x0, y0, x1, y1, t, o): the rows above y0 mirrored into [y0, y1) through o.table (default REFL), each row
  // shifted sideways by a wave that grows with depth and steps at o.fps (default 8). Draw it after everything above
  // the water and before anything that stands in front of it.
  function reflect(x0, y0, x1, y1, t, o = {}) {
    const T = o.table || REFL, amp = o.wave ?? 1.2, ph = Math.floor(t * (o.fps ?? 8)), X0 = Math.max(0, Math.floor(x0)), X1 = Math.min(LW, Math.ceil(x1));
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(LH, Math.ceil(y1)); y++) {
      const depth = y - y0, sy = clampI(Math.floor(y0) - 1 - Math.floor(depth * (o.stretch ?? 1)), 0, LH - 1);
      const dx = Math.round(Math.sin(y * 1.9 + ph * 1.7) * amp * Math.min(1, (depth + 2) / 10));
      for (let x = X0; x < X1; x++) V[y * LW + x] = T[V[sy * LW + clampI(x + dx, 0, LW - 1)]];
    }
  }
  // sparkle(x0, y0, x1, y1, t, o): short highlight dashes on water that blink and move in steps. o: c ('E'), fps (5),
  // density (dashes per px of row, .03), every (rows between dash rows, 2), seed, len ([2, 5])
  function sparkle(x0, y0, x1, y1, t, o = {}) {
    const c = ci(o.c || 'E'), ph = Math.floor(t * (o.fps ?? 5)), dens = o.density ?? .03, every = o.every ?? 2, seed = o.seed || 0, [l0, l1] = o.len || [2, 5];
    for (let y = Math.floor(y0); y < y1; y += every) {
      const n = Math.max(1, Math.round((x1 - x0) * dens));
      for (let k = 0; k < n; k++) { const life = Math.floor((ph + k * 3) / 4), h1 = hash(y * 17.3 + k * 91.7 + life * 3.1 + seed);
        if (hash(h1 * 77 + k) < .35) continue;
        const len = Math.round(lerp(l0, l1, hash(h1 * 31))), xs = Math.floor(lerp(x0, x1 - len, h1)) + ((ph + k) % 4 < 2 ? 0 : 1);
        rect(xs, y, len, 1, c); }
    }
  }
  // burst(x, y, k, o): eight short rays thrown out from (x, y) as k goes 0..1 (a lamp catching, a hit, a coin):
  // they travel o.r px (default 9), shrink as they go and are gone at k = 1. Step k in frames for the pixel feel.
  function burst(x, y, k, o = {}) { if (k <= 0 || k >= 1) return; const R = o.r ?? 9, c = o.c || 'f', c2 = o.c2 || 'F', d = 2 + (R - 2) * k, len = Math.max(1, Math.round(3 * (1 - k)));
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, ux = Math.round(Math.cos(a) * 10) / 10, uy = Math.round(Math.sin(a) * 10) / 10;
      for (let j = 0; j < len; j++) pset(x + ux * (d + j), y + uy * (d + j), j ? c2 : c); } }
  // iris(cx, cy, r, c): everything outside the circle becomes c: the classic iris in or out (step r in whole px)
  function iris(cx, cy, r, c = 'k') { const i = ci(c), R = r * r;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const dx = x + .5 - cx, dy = y + .5 - cy; if (dx * dx + dy * dy > R) V[y * LW + x] = i; } }
  // mosaic(n): the SNES mosaic: each n x n block takes its top-left pixel
  function mosaic(n) { n = Math.max(1, Math.floor(n)); if (n < 2) return;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) V[y * LW + x] = V[(y - y % n) * LW + (x - x % n)]; }

  // ---------- bitmap font: 5 x 7, proportional, uppercase (lowercase is drawn as uppercase) ----------
  const FONT = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.', C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.', E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#', I: '###/.#./.#./.#./.#./.#./###',
    J: '..###/...#./...#./...#./#..#./#..#./.##..', K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/##..#/#.#.#/#..##/#..##/#...#', O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....', Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..', U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/.#.#./.#.#./..#..', W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '.#./##./.#./.#./.#./.#./###', 2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '####./....#/....#/.###./....#/....#/####.', 4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...', 8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/....#/.###.',
    '.': '././././././#', ',': '../../../../../.#/#.', '!': '#/#/#/#/#/./#', '?': '.###./#...#/....#/...#./..#../...../..#..',
    ':': '././#/././#/.', "'": '#/#/./././././.', '-': '..../..../..../####/..../..../....', '/': '...#/...#/..#./..#./.#../.#../#...',
    '"': '#.#/#.#/.../.../.../.../...', '+': '...../..#../..#../#####/..#../..#../.....', '(': '.#/#./#./#./#./#./.#', ')': '#./.#/.#/.#/.#/.#/#.',
  };
  const GH = 7, _gl = {};
  function glyph(ch) { if (_gl[ch]) return _gl[ch]; const src = FONT[ch]; if (!src) return null; const rows = src.split('/'); return (_gl[ch] = { w: rows[0].length, rows }); }
  // textW(str, o): width in low-res px. o.big draws every font pixel as a 2 x 2 block (headlines, game titles)
  function textW(str, o = {}) { const z = o.big ? 2 : 1, sp = (o.spacing ?? 1) * z; let w = 0, n = 0;
    for (const ch of String(str).toUpperCase()) { const g = ch === ' ' ? null : glyph(ch); w += (g ? g.w : 3) * z; n++; } return Math.max(0, w + sp * (n - 1)); }
  // text(id, str, x, y, o): one line of bitmap text, top-left at (x, y) (o.align 'center' or 'right' moves the anchor).
  // o.color (palette char), o.shadow (a char: a 1 px drop shadow), o.big (2 x 2 blocks with an o.outline and a
  // vertical gradient o.grad, one char per font row, e.g. 'ffyyyYY'). Registers the line for the checks under id
  // (null for decoration, '~id' for deliberately fast text) with its box in frame pixels. Returns { w, h, x }.
  function text(id, str, x, y, o = {}) {
    str = String(str); const up = str.toUpperCase(), z = o.big ? 2 : 1, sp = (o.spacing ?? 1) * z, w = textW(str, o);
    let X = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x); const Y = Math.round(y), x0 = X;
    const col = ci(o.color || 'w'), grad = o.grad ? [...o.grad].map(ci) : null, out = o.outline != null ? ci(o.outline) : (o.big ? ci('k') : -1), sh = o.shadow != null ? ci(o.shadow) : -1;
    const cells = [];
    for (const ch of up) { if (ch === ' ') { X += 3 * z + sp; continue; } const g = glyph(ch); if (!g) { X += 3 * z + sp; continue; }
      g.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') cells.push([X + i * z, Y + j * z, j]); }); X += g.w * z + sp; }
    if (sh >= 0) for (const [cx, cy] of cells) rect(cx + (o.big ? 0 : 1), cy + (o.big ? 2 : 1), z + (o.big ? 1 : 0), z, sh);
    if (out >= 0) for (const [cx, cy] of cells) rect(cx - 1, cy - 1, z + 2, z + 2, out);
    for (const [cx, cy, j] of cells) rect(cx, cy, z, z, grad ? grad[Math.min(grad.length - 1, j)] : col);
    const h = GH * z + (o.big ? 2 : 0);
    if (id != null) readable(id, str, OX + (x0 - (o.big ? 1 : 0)) * SC, OY + (Y - (o.big ? 1 : 0)) * SC, (w + (o.big ? 2 : 0)) * SC, h * SC, 1, GH * z * SC);
    return { w, h, x: x0 };
  }
  // wrap(str, maxW, o) -> lines that fit maxW low-res px
  function wrapText(str, maxW, o = {}) { const out = []; let cur = '';
    for (const wd of String(str).split(/\s+/)) { const nx = cur ? cur + ' ' + wd : wd; if (cur && textW(nx, o) > maxW) { out.push(cur); cur = wd; } else cur = nx; }
    if (cur) out.push(cur); return out; }

  // ---------- game UI ----------
  const SPR = {
    heart: ['.kk.kk.', 'kwrkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'],
    heartEmpty: ['.kk.kk.', 'kMMkMMk', 'kMMMMMk', 'kMMMMMk', '.kMMMk.', '..kMk..', '...k...'],
    arrow: ['yyyyy', '.yyy.', '..y..'],                                 // the "more" arrow under dialogue text
    bubble: ['.kkkkkkkkk.', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', '.kkkwkkkkk.', '...kwk.....', '...kk......'],
    bubbleSmall: ['.kkk.', 'kwwwk', 'kwwwk', '.kwk.', '..k..'],
    // a flame in three frames, 5 x 7, bottom centre on what burns
    flame: [['..f..', '.fff.', '.fFf.', 'fFFFf', 'FFoFF', '.FoF.', '..o..'], ['.f...', '.ff..', '.fFf.', 'fFFff', 'FFoFF', '.FoF.', '..o..'], ['...f.', '..ff.', '.fFf.', 'ffFFf', 'FFoFF', '.FoF.', '..o..']],
    spark: [['..f..', '.fwf.', 'fwwwf', '.fwf.', '..f..'], ['f...f', '.fwf.', '.www.', '.fwf.', 'f...f']],   // two frames: it twinkles
    pine: ['...7...', '..767..', '..666..', '.76666.', '..666..', '.66666.', '766666.', '.666666', '6666666', '...6...'],
    pineTall: ['...7...', '..767..', '..666..', '.76666.', '..666..', '.76666.', '.66666.', '..666..', '.666666', '7666666', '.666666', '6666666', '...6...', '...6...'],
    cattail: ['..h..', '.khk.', '.khk.', '.khk.', '..k..', '..k.k', '..kk.', 'k.k..', '.kk..', '..k..', '..k..', '.k...', '.k...', '.k...', '.k...', '.k...'],
    tuft: ['....k....', '.k..k..k.', '.k.kk..k.', '..kk.k.k.', 'k.k..kk..', '.kk..k.k.', '..k.kk.k.', 'kkkkkkkkk'],
    bird: [['k...k', '.k.k.', '..k..'], ['.....', 'kkkkk', '..k..']],
  };
  // panel(x, y, w, h, st): a box with 1 px notched corners. st: { fill, edge, inner (a second border inside the edge),
  // shade (its bottom inner row) }. PIX.UI.caption and PIX.UI.dialog are the two house styles.
  const UI = { caption: { fill: 'y', edge: 'k', shade: 'Y', text: 'k' }, dialog: { fill: 'k', edge: 'y', inner: 'M', text: 'w' }, hud: { fill: 'k', edge: 'M', text: 'w' } };
  function panel(x, y, w, h, st = UI.dialog) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); if (w < 3 || h < 3) { rect(x, y, w, h, st.edge); return; }
    rect(x + 1, y + 1, w - 2, h - 2, st.fill);
    rect(x + 1, y, w - 2, 1, st.edge); rect(x + 1, y + h - 1, w - 2, 1, st.edge); rect(x, y + 1, 1, h - 2, st.edge); rect(x + w - 1, y + 1, 1, h - 2, st.edge);
    if (st.inner && w > 6 && h > 6) { rect(x + 2, y + 1, w - 4, 1, st.inner); rect(x + 2, y + h - 2, w - 4, 1, st.inner); rect(x + 1, y + 2, 1, h - 4, st.inner); rect(x + w - 2, y + 2, 1, h - 4, st.inner); }
    if (st.shade && h > 4) rect(x + 1, y + h - 2, w - 2, 1, st.shade);
  }
  // unfold(open, h, steps): the height of a box that opens in steps (open 0..1), never under 2 px while open
  const unfold = (open, h, steps = 4) => open <= 0 ? 0 : Math.max(2, Math.round(h * Math.ceil(clamp(open) * steps) / steps));
  // caption(id, str, x, y, open, st): a game caption box sized to its text; it unfolds from its middle row in steps and
  // its text appears (and registers) only once it is fully open
  function caption(id, str, x, y, open, st = UI.caption) {
    const w = textW(str) + 10, h = GH + 8, hh = unfold(open, h); if (!hh) return { w, h };
    panel(x, y + Math.floor((h - hh) / 2), w, hh, st); if (hh >= h) text(id, str, x + 5, y + 4, { color: st.text });
    return { w, h };
  }
  // dialog(id, o): a dialogue box with a portrait and typed text. o: { x, y, w, h, open, portrait (a string map, or a
  // function (x, y) that draws one), str (what is typed so far), full (the whole line), t, st }. While typing, the
  // text registers as '~id'; once complete, as id, with a blinking arrow.
  function dialog(id, o) {
    const st = o.st || UI.dialog, hh = unfold(o.open, o.h); if (!hh) return;
    panel(o.x, o.y + Math.floor((o.h - hh) / 2), o.w, hh, st); if (hh < o.h) return;
    let tx = o.x + 6;
    if (o.portrait) { const [pw, ph] = typeof o.portrait === 'function' ? (o.portraitSize || [32, 32]) : size(o.portrait), py = o.y + Math.floor((o.h - ph) / 2);
      rect(o.x + 4, py - 1, pw + 2, ph + 2, st.inner || st.edge); rect(o.x + 5, py, pw, ph, o.portraitBg || 'M');
      if (typeof o.portrait === 'function') o.portrait(o.x + 5, py); else sprite(o.portrait, o.x + 5, py); tx = o.x + pw + 13; }
    const done = o.str === o.full, lines = wrapText(o.full, o.x + o.w - 8 - tx), shown = String(o.str), ty = o.y + Math.floor((o.h - lines.length * (GH + 4) + 4) / 2);
    let used = 0;
    lines.forEach((ln, j) => { const part = shown.slice(used, used + ln.length); used += ln.length + 1; if (!part) return;
      text(done ? `${id}:${j}` : `~${id}:${j}`, part, tx, ty + j * (GH + 4), { color: st.text }); });
    if (done && Math.floor((o.t || 0) * 3) % 2 === 0) sprite(SPR.arrow, o.x + o.w - 11, o.y + o.h - 8);
  }
  // hearts(x, y, n, max): a row of hearts, the first n full
  function hearts(x, y, n, max) { for (let i = 0; i < max; i++) sprite(i < n ? SPR.heart : SPR.heartEmpty, x + i * 8, y); }
  // emote(x, y, k, inner): a speech bubble that pops (k 0..1: small, then full) with a sprite in it (a heart by default);
  // (x, y) is the tip of its tail
  function emote(x, y, k, inner = SPR.heart) { if (k <= 0) return; if (k < .5) { sprite(SPR.bubbleSmall, x - 3, y - 5); return; }
    sprite(SPR.bubble, x - 4, y - 11); sprite(inner, x - 2, y - 10); }

  // ---------- animation in steps ----------
  // fr(t, fps, n, t0): the frame of an n-frame cycle at fps (8-12 for sprites), from t0
  const fr = (t, fps, n, t0 = 0) => ((Math.floor((t - t0) * fps) % n) + n) % n;
  // stepT(t, fps): time held in steps, for motion that should move on twos or threes
  const stepT = (t, fps) => Math.floor(t * fps) / fps;
  // walk(u, a): a trapezoid velocity profile: speed up over the first a of a move, constant, slow down over the last a
  function walk(u, a = .2) { u = clamp(u); const v = 1 / (1 - a); if (u < a) return .5 * v * u * u / a; if (u > 1 - a) return 1 - .5 * v * (1 - u) * (1 - u) / a; return .5 * v * a + v * (u - a); }

  // ---------- present ----------
  let _cv = null, _cx = null, _img = null, _u32 = null;
  // present(pal, o): turn the indices into colours through the palette and scale the buffer up with nearest-neighbour.
  // o.shake [dx, dy] in low-res px (a landing, an explosion). Call once, at the end of the frame.
  function present(pal = NIGHT, o = {}) {
    if (!_cv) { _cv = document.createElement('canvas'); _cv.width = LW; _cv.height = LH; _cx = _cv.getContext('2d'); _img = _cx.createImageData(LW, LH); _u32 = new Uint32Array(_img.data.buffer); }
    const L = pal instanceof Uint32Array ? pal : lut(pal);
    for (let i = 0; i < V.length; i++) _u32[i] = L[V[i]];
    _cx.putImageData(_img, 0, 0);
    const [sx, sy] = (o.shake || [0, 0]).map(v => Math.round(v));
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.imageSmoothingEnabled = false; CX.globalAlpha = 1; CX.filter = 'none';
    CX.fillStyle = pal[CHARS[0]] || '#000'; CX.fillRect(0, 0, W, H);
    CX.drawImage(_cv, OX + sx * SC, OY + sy * SC, LW * SC, LH * SC);
    CX.restore();
  }

  return { S, W: LW, H: LH, SC, OX, OY, CHARS, IDX, ci, FIXED, NIGHT, DAWN, mix, toward, lut, LIT, DIM, REFL, remap, RAMPS, bayer, V,
    begin, pset, pget, rect, dither, line, disc, gradient, parse, size, sprite, tiles, scroll, heightFn, ridge, stamps, stars, cloud,
    light, reflect, sparkle, burst, iris, mosaic, FONT, textW, text, wrapText, SPR, UI, panel, unfold, caption, dialog, hearts, emote,
    fr, stepT, walk, present,
    // a starter tile set: g grass on dirt, d dirt, t dirt into deep dirt, D deep dirt, and bank edges (G, l, L: the ground
    // ends on the tile's right; H, r, R: on its left)
    TILES: {
      meadow: {
        g: [['.A...A..', 'AaAAaAAa', 'aaaaaaaa', 'a9aa9aa9', '99999999', '98999899', '99999999', '99989999'],
            ['...A..A.', 'aAAaAAaA', 'aaaaaaaa', '9aa9aa9a', '99999999', '99989999', '89999999', '99999989']],
        G: ['.A...A..', 'AaAAaAk.', 'aaaaaak.', 'a9aa9ak.', '999998k.', '999899k.', '99999k..', '999998k.'],
        H: ['..A...A.', '.kAAaAAa', '.kaaaaaa', '.k9aa9aa', '.k899999', '.k999899', '..k99999', '.k899999'],
        d: [['99999999', '99899999', '99999989', '99999999', '89999999', '99999899', '99999999', '99989999'],
            ['99999999', '99999899', '98999999', '99999999', '99989999', '99999999', '89999989', '99999999']],
        t: [['98989898', '89898989', '88988898', '89888888', '88888888', '88898888', '88888888', '88888988']],
        D: [['88888888', '88898888', '88888888', '98888898', '88888888', '88988888', '88888888', '88888988']],
        l: ['999998k.', '999989k.', '99999k..', '998998k.', '999999k.', '99989k..', '999998k.', '989999k.'],
        r: ['.k899999', '.k989999', '..k99999', '.k899899', '.k999999', '..k98999', '.k899999', '.k999989'],
        L: ['898988k.', '888898k.', '88888k..', '889888k.', '888888k.', '88898k..', '888888k.', '898888k.'],
        R: ['.k898988', '.k988888', '..k88888', '.k888988', '.k888888', '..k88988', '.k888888', '.k889888'],
      },
    },
  };
})();
