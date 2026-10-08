// looks/terminal.js: a phosphor terminal. IBM Plex Mono on one fixed character grid, one phosphor colour on a dark
// tube, a believable session (commands typed with a human cadence, output landing line by line, in-place progress,
// a full-screen TUI on the alternate screen), ASCII art rasterised from shapes drawn with ordinary canvas calls, and
// a CRT post pass (barrel curvature, scanlines, phosphor bloom, flicker, a slow refresh band).
// Card: looks/terminal.md. Specimen: specimens/terminal.
//
// Everything sits on one grid G = TERM.grid(): cell (c, r) is G.cw x G.ch frame pixels. Lines are lists of segments
// [[text, style], ...] with styles 'hi' | 'fg' | 'dim' | 'faint' | 'inv' (inverse video) | 'invdim' | 'link' (bright,
// with the dotted underline terminals give OSC 8 hyperlinks). Block elements, box
// drawing and braille are drawn as shapes, not font glyphs, so they tile without seams (as kitty and alacritty do);
// any other character must exist in IBM Plex Mono Bold or the frame throws (a missing glyph would silently fall
// back to a system font).

const TERM = (() => {
  const PHOS = {   // phosphor presets: [glow colour, tube black]
    amber: ['#FFB23F', '#0D0905'], green: ['#4DFF88', '#050D08'], lime: ['#C6FF3D', '#080B04'], white: ['#E4ECFF', '#07080B'] };
  const cfg = Object.assign({ phosphor: 'amber', size: 38, lh: 1.3, margin: [140, 108], family: 'IBM Plex Mono', weight: 700 }, P.terminal || {});
  const [ph, tube] = PHOS[cfg.phosphor] || [cfg.phosphor, '#0A0A0A'];
  const S = Object.assign({ fg: ph, bg: cfg.bg || tube }, cfg);
  S.hi = mixCol(S.fg, '#FFFFFF', .3); S.dim = mixCol(S.fg, S.bg, .42); S.faint = mixCol(S.fg, S.bg, .72);
  const COL = st => st === 'hi' || st === 'link' ? S.hi : st === 'dim' ? S.dim : st === 'faint' ? S.faint : S.fg;

  // ---------- the grid ----------
  const _grids = new Map();
  // grid(o): { size, cw, ch, cols, rows, x0, y0, base }. o: size (px), lh (line height x size), margin [x, y],
  // cols/rows (to force a count; the grid stays centred)
  function grid(o = {}) {
    const size = o.size || S.size, lh = o.lh || S.lh, m = o.margin || S.margin, key = [size, lh, m, o.cols, o.rows].join('|');
    if (_grids.has(key)) return _grids.get(key);
    const cw = size * (o.advance || S.advance || .6);   // IBM Plex Mono's advance is 600/1000 em; grids are built at load, before fonts or a canvas exist
    const ch = Math.round(size * lh), cols = o.cols || Math.floor((W - 2 * m[0]) / cw), rows = o.rows || Math.floor((H - 2 * m[1]) / ch);
    const g = { size, cw, ch, cols, rows, x0: Math.round((W - cols * cw) / 2), y0: Math.round((H - rows * ch) / 2), base: Math.round(ch / 2 + size * .36) };
    g.at = (c, r) => [g.x0 + c * g.cw, g.y0 + r * g.ch];                          // top-left of a cell, frame px
    g.mid = (c, r) => [g.x0 + (c + .5) * g.cw, g.y0 + (r + .5) * g.ch];           // centre of a cell
    _grids.set(key, g); return g;
  }
  function screen(G, col = S.bg) { bg(col); }

  // ---------- glyph coverage: IBM Plex Mono Bold's cmap (checked from the font file) ----------
  const CMAP = '0,d,20-7e,a0-17f,18f,192,1a0-1a1,1af-1b0,1cd-1dc,1fa-1ff,218-21b,237,259,2bb-2bc,2c6-2c7,2d8-2dd,300-304,306-30c,312,315,31b,323,326-328,3c0,400-45f,472-473,490-49d,4a0-4a5,4aa-4ab,4ae-4b3,4b6-4bb,4c0-4c2,4cf-4d9,4dc-4df,4e2-4e9,4ee-4f5,4f8-4f9,e3f,1e80-1e85,1e9e,1ea0-1ef9,2013-2014,2018-201a,201c-201e,2020-2022,2026,2030,2032-2033,2039-203a,2044,2070,2074-2079,2080-2089,20a1,20a4,20a6,20a8-20ae,20b1-20b2,20b4-20b5,20b8-20ba,20bd,20bf,2113,2116,2122,2126,212e,2150-2151,2153-215e,2190-2199,21a9-21aa,21b0-21b3,21b6-21b7,21ba-21bb,21c4,21c6,2202,2206,220f,2211-2212,2215,221a,221e,222b,2248,2260,2264-2265,2500-259f,25ca,2713,274c,2b0e-2b11,f6d7-f6d8,fb01-fb02'
    .split(',').map(s => s.split('-').map(h => parseInt(h, 16))).map(([a, b]) => [a, b ?? a]);
  const inFont = cp => CMAP.some(([a, b]) => cp >= a && cp <= b);
  const procedural = cp => (cp >= 0x2500 && cp <= 0x259F) || (cp >= 0x2800 && cp <= 0x28FF);
  const _ok = new Set();
  function check(str) { for (const ch of str) { if (_ok.has(ch)) continue; const cp = ch.codePointAt(0);
    if (!inFont(cp) && !procedural(cp)) throw new Error(`TERM: "${ch}" (U+${cp.toString(16).toUpperCase()}) isn't in IBM Plex Mono Bold and has no drawn form: it would fall back to a system font`); _ok.add(ch); } }

  // ---------- drawn glyphs: blocks, box drawing, braille ----------
  // box drawing: [up, right, down, left] weights, 1 light, 2 heavy, 3 double; arcs for the rounded corners
  const BOX = { '─': [0, 1, 0, 1], '━': [0, 2, 0, 2], '│': [1, 0, 1, 0], '┃': [2, 0, 2, 0], '┌': [0, 1, 1, 0], '┐': [0, 0, 1, 1], '└': [1, 1, 0, 0], '┘': [1, 0, 0, 1],
    '├': [1, 1, 1, 0], '┤': [1, 0, 1, 1], '┬': [0, 1, 1, 1], '┴': [1, 1, 0, 1], '┼': [1, 1, 1, 1], '┏': [0, 2, 2, 0], '┓': [0, 0, 2, 2], '┗': [2, 2, 0, 0], '┛': [2, 0, 0, 2],
    '═': [0, 3, 0, 3], '║': [3, 0, 3, 0], '╔': [0, 3, 3, 0], '╗': [0, 0, 3, 3], '╚': [3, 3, 0, 0], '╝': [3, 0, 0, 3], '╴': [0, 0, 0, 1], '╶': [0, 1, 0, 0], '╵': [1, 0, 0, 0], '╷': [0, 0, 1, 0] };
  const ARC = { '╭': [1, 1], '╮': [-1, 1], '╯': [-1, -1], '╰': [1, -1] };
  function drawnGlyph(ch, x, y, G, col) {
    const cp = ch.codePointAt(0), w = G.cw, h = G.ch, lw = Math.max(2, Math.round(G.size * .085));
    CX.fillStyle = col;
    if (cp >= 0x2800) {   // braille: dots 1-3 + 7 down the left, 4-6 + 8 down the right
      const bits = cp - 0x2800, map = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]], d = Math.max(3, Math.min(w * .26, h * .13));
      for (let i = 0; i < 8; i++) if (bits & (1 << i)) { const [cx, cy] = map[i]; CX.fillRect(Math.round(x + w * (.3 + cx * .4) - d / 2), Math.round(y + h * (.17 + cy * .22) - d / 2), Math.round(d), Math.round(d)); }
      return;
    }
    if (cp >= 0x2580) {   // block elements
      const R = (a, b, c, d) => CX.fillRect(Math.round(x + a * w), Math.round(y + b * h), Math.round(x + c * w) - Math.round(x + a * w), Math.round(y + d * h) - Math.round(y + b * h));
      if (cp === 0x2580) return R(0, 0, 1, .5);
      if (cp >= 0x2581 && cp <= 0x2588) return R(0, 1 - (cp - 0x2580) / 8, 1, 1);
      if (cp >= 0x2589 && cp <= 0x258F) return R(0, 0, (0x2590 - cp) / 8, 1);
      if (cp === 0x2590) return R(.5, 0, 1, 1);
      if (cp >= 0x2591 && cp <= 0x2593) { CX.save(); CX.globalAlpha *= [.22, .45, .7][cp - 0x2591]; R(0, 0, 1, 1); CX.restore(); return; }
      if (cp === 0x2594) return R(0, 0, 1, 1 / 8);
      if (cp === 0x2595) return R(7 / 8, 0, 1, 1);
      const Q = { 0x2596: [0, 0, 1, 0], 0x2597: [0, 0, 0, 1], 0x2598: [1, 0, 0, 0], 0x2599: [1, 0, 1, 1], 0x259A: [1, 0, 0, 1], 0x259B: [1, 1, 1, 0], 0x259C: [1, 1, 0, 1], 0x259D: [0, 1, 0, 0], 0x259E: [0, 1, 1, 0], 0x259F: [0, 1, 1, 1] }[cp];
      if (Q) { if (Q[0]) R(0, 0, .5, .5); if (Q[1]) R(.5, 0, 1, .5); if (Q[2]) R(0, .5, .5, 1); if (Q[3]) R(.5, .5, 1, 1); }
      return;
    }
    const mx = Math.round(x + w / 2), my = Math.round(y + h / 2);
    if (ARC[ch]) { const [sx, sy] = ARC[ch], r = Math.min(w, h) / 2; CX.save(); CX.strokeStyle = col; CX.lineWidth = lw; CX.beginPath();
      CX.moveTo(mx, sy > 0 ? y + h : y); CX.lineTo(mx, my + sy * r); CX.quadraticCurveTo(mx, my, mx + sx * r, my); CX.lineTo(sx > 0 ? x + w : x, my); CX.stroke(); CX.restore(); return; }
    const b = BOX[ch];
    if (!b) { CX.save(); CX.font = `${S.weight} ${G.size}px "${S.family}"`; CX.fillText(ch, x, y + G.base); CX.restore(); return; }
    const arm = (k, x1, y1, x2, y2, vertical) => { if (!k) return; const t = k === 2 ? lw * 2 : lw;
      if (k === 3) { const o = lw * 1.2; for (const s of [-1, 1]) CX.fillRect(vertical ? mx + s * o - lw / 2 : x1, vertical ? y1 : my + s * o - lw / 2, vertical ? lw : x2 - x1, vertical ? y2 - y1 : lw); return; }
      CX.fillRect(vertical ? mx - t / 2 : x1, vertical ? y1 : my - t / 2, vertical ? t : x2 - x1, vertical ? y2 - y1 : t); };
    const ext = lw;   // arms overlap the centre so corners close
    arm(b[0], 0, y, 0, my + ext / 2, true); arm(b[2], 0, my - ext / 2, 0, y + h, true); arm(b[3], x, 0, mx + ext / 2, 0, false); arm(b[1], mx - ext / 2, 0, x + w, 0, false);
  }

  // ---------- lines ----------
  const segs = s => typeof s === 'string' ? [[s, 'fg']] : s;
  const plain = s => segs(s).map(x => x[0]).join('');
  // line(G, c, r, s, o): draws segments s from cell (c, r). o: id (registers the line for the checks), alpha, cols
  // (clip to this many cells), cursor: a cell index to draw the block cursor on, ghost (skip registering).
  // Segments that carry their own id ([text, style, id]) are registered one by one whatever o.id is, unless o.ghost
  // or o.id === null (the shell passes null for a line half scrolled away). o.inView: register only text that lies
  // wholly inside the safe area as drawn (after cam()); for a camera that crops the screen on purpose, so lines it has
  // framed out, or is framing out, are drawn but not checked. Check those crops on a sheet.
  function line(G, c, r, s, o = {}) {
    s = segs(s); const a = o.alpha ?? 1; if (a <= .005) return;
    const [x0, y0] = G.at(c, r); let col = 0; const lim = o.cols ?? G.cols - c;
    CX.save(); CX.globalAlpha *= a; CX.font = `${S.weight} ${G.size}px "${S.family}"`; CX.textBaseline = 'alphabetic'; if ('letterSpacing' in CX) CX.letterSpacing = '0px';
    for (const [str, st] of s) {
      check(str); const chars = [...str].slice(0, Math.max(0, lim - col)); if (!chars.length) continue;
      const inv = st === 'inv' || st === 'invdim', fg = inv ? S.bg : COL(st), x = x0 + col * G.cw;
      if (inv) { CX.fillStyle = st === 'invdim' ? S.dim : S.fg; CX.fillRect(Math.round(x), Math.round(y0), Math.round(chars.length * G.cw), G.ch); }
      // runs of font glyphs go out in one fillText (the font is monospaced); drawn glyphs go cell by cell
      let run = '', runAt = 0;
      const flush = () => { if (run.trim()) { CX.fillStyle = fg; CX.fillText(run, x0 + runAt * G.cw, y0 + G.base); } run = ''; };
      chars.forEach((ch, i) => { const k = col + i, cp = ch.codePointAt(0);
        if (procedural(cp)) { flush(); drawnGlyph(ch, x0 + k * G.cw, y0, G, fg); runAt = k + 1; }
        else { if (!run) runAt = k; run += ch; } });
      flush();
      if (st === 'link') { CX.fillStyle = S.dim; const uy = Math.round(y0 + G.base + G.size * .2), d = Math.max(2, Math.round(G.size * .07));   // a hyperlink (OSC 8): dotted underline
        for (let k = 0; k < chars.length * 3; k++) CX.fillRect(Math.round(x + (k + .25) * G.cw / 3), uy, Math.round(G.cw / 6), d); }
      col += chars.length;
    }
    if (o.cursor != null && o.cursor >= 0) cursorBlock(G, c + o.cursor, r, o.cursorAlpha ?? 1);
    CX.restore();
    // register for the checks: the whole line under o.id, or, when segments carry their own ids ([text, style, id]),
    // each such segment on its own (a stable label apart from a counter that changes every frame, which takes a '~' id)
    if (!o.ghost) {
      const M = CX.getTransform(), k = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)), by = y0 + (G.ch - G.size) / 2, sr = o.inView ? safeRect() : null;
      const reg = (id, txt, at) => { txt = txt.slice(0, Math.max(0, lim - at)); const lead = txt.length - txt.trimStart().length, n = [...txt.trim()].length; if (!n) return;
        const bx = x0 + (at + lead) * G.cw, X = M.a * bx + M.c * by + M.e, Y = M.b * bx + M.d * by + M.f, w = n * G.cw * k, h = G.size * k;
        if (sr && (X < sr[0] - 1 || Y < sr[1] - 1 || X + w > sr[0] + sr[2] + 1 || Y + h > sr[1] + sr[3] + 1)) return;
        readable(id, txt.trim(), X, Y, w, h, a * CX.globalAlpha, h); };
      if (s.some(x => x.length > 2)) { if (o.id !== null) { let at = 0; for (const x of s) { if (x[2] != null) reg(x[2], x[0], at); at += [...x[0]].length; } } }
      else if (o.id != null) reg(o.id, plain(s), 0);
    }
  }
  function cursorBlock(G, c, r, a = 1) { if (a <= 0) return; const [x, y] = G.at(c, r); CX.save(); CX.globalAlpha *= a; CX.fillStyle = S.fg;
    CX.fillRect(Math.round(x), Math.round(y + G.ch * .08), Math.round(G.cw), Math.round(G.ch * .84)); CX.restore(); }
  // blink(t, since): the cursor stays solid while keys are being pressed, then blinks 530 ms on, 530 ms off (xterm)
  const blink = (t, since = 0) => t < since + .5 ? 1 : (frac((t - since - .5) / 1.06) < .5 ? 0 : 1);

  // ---------- typing ----------
  // keys(text, t0, o): the time each key lands, from a seeded model of a fluent typist: ~o.cps keys a second, a
  // log-normal jitter, quicker common pairs, a pause at word gaps, a reach for '-', '/', '.', a breath before each
  // flag's value, and '\b' (backspace) after a realisation pause. Same text, same times, every frame.
  const FAST = new Set(['th', 'he', 'in', 'er', 'an', 're', 'on', 'it', 'te', 'ki', 'up', 'si', 'ub', 'li', 'ic', 'pu', 'bl', 'es', 'st', 'at', 'gi', 'lo']);
  const _keys = new Map();
  function keys(text, t0, o = {}) {
    const k = `${text}|${t0}|${o.cps}|${o.seed || ''}`; if (_keys.has(k)) return _keys.get(k);
    const r = rnd(text + (o.seed || '')), base = 1 / (o.cps || 13), out = []; let at = t0;
    const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) * 1.73; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], prev = text[i - 1] || '', pair = prev + ch;
      let d = base * Math.exp(.32 * gauss());
      if (FAST.has(pair.toLowerCase())) d *= .62; if (prev === ch) d *= .8;
      if (prev === ' ') d += base * (.6 + .8 * r());
      if (/[-/._~]/.test(ch)) d += base * .7;
      if (prev === ' ' && text[i - 2] && text.slice(0, i - 1).split(' ').pop().startsWith('-')) d += base * 2.2;   // a breath before a flag's value
      if (ch === '\b') d = text[i - 1] === '\b' ? base * .9 : base * 4.5;
      if (i === 0) d = 0;
      at += d; out.push(at);
    }
    _keys.set(k, out); return out;
  }
  // typed(text, t0, t, o) -> { str, done, end, last }: what is on the line at t (backspaces applied), when typing ends
  // and when the last key landed (for the cursor's blink)
  function typing(text, t0, t, o = {}) {
    const ks = keys(text, t0, o); let str = '', last = t0 - 1;
    for (let i = 0; i < text.length && ks[i] <= t; i++) { last = ks[i]; str = text[i] === '\b' ? str.slice(0, -1) : str + text[i]; }
    return { str, done: t >= ks[ks.length - 1], end: ks[ks.length - 1], last };
  }

  // ---------- the session ----------
  // A LOG is the shell's scrollback in order: { t, text | segs, id } prints a line at t; { t, prompt, cmd, type, enter,
  // id, cps, seed } is a prompt shown from t, its command typed from `type` (keys() cadence) and entered at `enter`
  // (the cursor sits at the end of the line until then and is hidden while the command runs); { t, live: tt => segs,
  // until, final, id } is a line rewritten in place every frame (a progress bar, a counter, a spinner): live(tt) is
  // called with tt = min(t, until), so the line freezes at `until`. It registers under '~' + id while it changes, and
  // under id from `until` on if final: true (so the reading-time check counts its settled text; leave final off for a
  // line that never settles). Entries with t <= 0 are history.
  // shell(t, G, LOG, o) draws the screen: the last G.rows lines, scrolled smoothly when new lines push the screen up.
  // o: { upto: time the log is frozen at (an alt screen covering it), rows, row0, cursor: false, inView (see line()) }
  function visible(t, LOG) { return LOG.filter(e => e.t <= t); }
  function scrollAt(t, LOG, rows) {
    const keys = [[-1e9, 0]]; let n = 0;
    for (const e of LOG) { n++; if (e.t > 0) keys.push([e.t, Math.max(0, n - rows)]); else keys[0][1] = Math.max(0, n - rows); }
    return follow(t, keys, { stiffness: 520, damping: 46, mass: 1 });
  }
  function shell(t, G, LOG, o = {}) {
    const rows = o.rows ?? G.rows, row0 = o.row0 ?? 0, tt = o.upto != null ? Math.min(t, o.upto) : t, vis = visible(tt, LOG);
    const sc = scrollAt(tt, LOG, rows), [, top] = G.at(0, row0);
    CX.save(); CX.beginPath(); CX.rect(0, top - G.ch * .02, W, rows * G.ch + G.ch * .04); CX.clip();
    let cur = null;
    vis.forEach((e, i) => {
      const y = i - sc; if (y < -1 || y > rows) return;
      // a line sliding out of the top fades as it goes, and isn't registered while partly gone
      const fade = clamp(1 + y), id = y > -.02 && y < rows - .98 ? e.id : null;
      CX.save(); CX.translate(0, (y - Math.round(y)) * G.ch); const r = row0 + Math.round(y);
      if (e.prompt != null) {
        const ty = e.cmd ? typing(e.cmd, e.type ?? e.t, t, e) : { str: '', done: true, end: e.t, last: e.t };
        const s = [[e.prompt, e.pstyle || 'dim'], [ty.str, e.style || 'hi']], entered = e.enter != null && t >= e.enter;
        line(G, 0, r, s, { id: id == null ? null : (ty.done ? id : '~' + id), alpha: fade, inView: o.inView });
        if (!entered && o.cursor !== false && i === vis.length - 1) cur = [e.prompt.length + [...ty.str].length, r, blink(t, Math.max(ty.last, e.t))];
      } else if (e.live) line(G, 0, r, e.live(Math.min(t, e.until ?? 1e9), e), { id: id == null ? null : (e.final && t >= e.until ? id : '~' + id), alpha: fade, inView: o.inView });
      else line(G, 0, r, e.segs || e.text, { id, alpha: fade, inView: o.inView });
      CX.restore();
    });
    if (cur) cursorBlock(G, cur[0], cur[1], cur[2]);
    CX.restore();
    return { lines: vis.length, scroll: sc };
  }
  // typedEnd(e): when a prompt entry's command finishes typing (put Enter after it, on a beat)
  const typedEnd = e => { const ks = keys(e.cmd, e.type ?? e.t, e); return ks[ks.length - 1]; };

  // ---------- small widgets (return segments) ----------
  // bar(p, w): a progress bar w cells wide in eighth blocks, so it fills smoothly rather than a cell at a time
  function bar(p, w) { const n = clamp(p) * w, full = Math.floor(n), part = Math.floor((n - full) * 8);
    return '█'.repeat(full) + (full < w ? (part ? '▏▎▍▌▋▊▉'[part - 1] : ' ') : '') + ' '.repeat(Math.max(0, w - full - 1)); }
  // barSegs(p, w, o): the same bar as segments, its empty part drawn as a track (o.track char, default '░', in
  // o.trackStyle, default 'dim'), the fill in o.style (default 'fg')
  function barSegs(p, w, o = {}) { const n = clamp(p) * w, full = Math.floor(n), part = Math.floor((n - full) * 8);
    const fill = '█'.repeat(full) + (full < w && part ? '▏▎▍▌▋▊▉'[part - 1] : '');
    return [[fill, o.style || 'fg'], [(o.track ?? '░').repeat(w - fill.length), o.trackStyle || 'dim']]; }
  // spin(t, rate): an ASCII spinner frame ('|/-\'); braille() gives the braille dot spinner real CLIs use
  const spin = (t, rate = 12) => '|/-\\'[Math.floor(t * rate) % 4];
  const BRAILLE_SPIN = [0x280B, 0x2819, 0x2839, 0x2838, 0x283C, 0x2834, 0x2826, 0x2827, 0x2807, 0x280F].map(c => String.fromCodePoint(c));
  const braille = (t, rate = 12) => BRAILLE_SPIN[Math.floor(t * rate) % BRAILLE_SPIN.length];
  const pad = (s, n, right = false) => { s = String(s); return s.length >= n ? s : right ? ' '.repeat(n - s.length) + s : s + ' '.repeat(n - s.length); };

  // ---------- ASCII from shapes ----------
  // asciiFrom(drawFn, G, [c0, r0, cols, rows], o) rasterises drawFn(ctx) (ordinary canvas calls in FRAME pixels,
  // white on nothing; alpha or grey = partial ink) onto the cells of that rectangle and returns
  // { c0, r0, cols, rows, chars: [row strings], ink: Float32Array(cols * rows) }. Modes (o.mode):
  //   'shape'   (default) an evenly inked cell (a fill) takes a character from the ramp by its ink; any other cell
  //             takes the character whose own ink best matches the shape's in twelve regions of the cell (3 across,
  //             4 down). o.edges: true instead gives edge cells a direction character (/ \ | - _) from the ink
  //             gradient: the way to draw a filled shape. o.even (.78) sets how even a cell must be to count as fill
  //   'ramp'    density only: o.ramp (default ' .:-=+*#%@') indexed by the cell's mean ink
  //   'blocks'  quadrant blocks (2 x 2 per cell): chunky pixel art, seamless
  //   'braille' braille dots (2 x 4 per cell): the finest, for plots, traces and thin lines
  // o.sharp (default 1.7) raises contrast inside a cell before matching (crisper edges); o.chars limits the set.
  // the default set leans on line-art characters; o.chars: CHARS.full adds letters and brackets for denser fills
  const CHARS = { line: ` .,:'\`"^~-_=+/\\|()<>#`, full: ` .,:;'\`"^~-_=+*!/\\|()<>[]{}ilvxzoc0O8&#%@WM` }, SHAPE_CHARS = CHARS.line;
  const RX = 3, RY = 4, NR = RX * RY;   // match on 3 x 4 regions per cell
  const _glyphs = new Map();
  function glyphTable(G, chars) {
    const key = G.size + '|' + G.ch + '|' + chars; if (_glyphs.has(key)) return _glyphs.get(key);
    const k = 3, cw = Math.ceil(G.cw * k), chh = G.ch * k, c = document.createElement('canvas'); c.width = cw; c.height = chh;
    const x = c.getContext('2d', { willReadFrequently: true }); x.font = `${S.weight} ${G.size * k}px "${S.family}"`; x.textBaseline = 'alphabetic';
    const list = [...chars], vecs = [];
    for (const ch of list) { x.clearRect(0, 0, cw, chh); x.fillStyle = '#fff'; x.fillText(ch, 0, G.base * k); const d = x.getImageData(0, 0, cw, chh).data, v = new Float32Array(NR);
      for (let py = 0; py < chh; py++) for (let px = 0; px < cw; px++) { const a = d[(py * cw + px) * 4 + 3]; if (a) v[Math.min(RY - 1, Math.floor(py / chh * RY)) * RX + Math.min(RX - 1, Math.floor(px / cw * RX))] += a / 255; }
      const area = (cw / RX) * (chh / RY); for (let i = 0; i < NR; i++) v[i] /= area; vecs.push(v); }
    let mx = 0; for (const v of vecs) for (const e of v) mx = Math.max(mx, e);
    for (const v of vecs) for (let i = 0; i < NR; i++) v[i] /= mx;
    // dense: the mean ink of the inkiest glyph, so a fully covered cell maps to it and half ink to a half-dense glyph
    const dense = Math.max(...vecs.map(v => v.reduce((a, b) => a + b, 0) / NR));
    const t = { list, vecs, dense }; _glyphs.set(key, t); return t;
  }
  let _rc = null, _rx = null;
  function asciiFrom(drawFn, G, rect, o = {}) {
    const [c0, r0, cols, rows] = rect, mode = o.mode || 'shape';
    const sx = mode === 'shape' ? RX * 2 : 4, sy = mode === 'shape' ? RY * 4 : 8, w = cols * sx, h = rows * sy;
    if (!_rc) { _rc = document.createElement('canvas'); _rx = _rc.getContext('2d', { willReadFrequently: true }); }
    if (_rc.width < w || _rc.height < h) { _rc.width = Math.max(_rc.width, w); _rc.height = Math.max(_rc.height, h); }
    _rx.setTransform(1, 0, 0, 1, 0, 0); _rx.clearRect(0, 0, _rc.width, _rc.height); _rx.globalAlpha = 1; _rx.globalCompositeOperation = 'source-over';
    const [fx, fy] = G.at(c0, r0); _rx.setTransform(sx / G.cw, 0, 0, sy / G.ch, -fx * sx / G.cw, -fy * sy / G.ch);
    _rx.fillStyle = '#fff'; _rx.strokeStyle = '#fff'; _rx.lineCap = 'round'; _rx.lineJoin = 'round';
    _rx.save(); drawFn(_rx); _rx.restore();
    const d = _rx.getImageData(0, 0, w, h).data, ink = new Float32Array(cols * rows), chars = [];
    const A = (px, py) => d[(py * w + px) * 4 + 3] / 255 * (d[(py * w + px) * 4] / 255);
    const tbl = mode === 'shape' ? glyphTable(G, o.chars || SHAPE_CHARS) : null, ramp = o.ramp || ' .:-=+*#%@', sharp = o.sharp ?? 1.7, cut = o.cut ?? .06;
    const v = new Float32Array(NR);
    for (let r = 0; r < rows; r++) {
      let row = '';
      for (let c = 0; c < cols; c++) {
        const bx = c * sx, by = r * sy;
        if (mode === 'shape') {
          v.fill(0); for (let py = 0; py < sy; py++) for (let px = 0; px < sx; px++) v[(py >> 2) * RX + (px >> 1)] += A(bx + px, by + py);
          let m = 0, sum = 0; for (let i = 0; i < NR; i++) { v[i] /= 8; m = Math.max(m, v[i]); sum += v[i]; }
          ink[r * cols + c] = sum / NR;
          if (m < cut) { row += ' '; continue; }
          // a cell inked evenly (a fill, not an edge) takes its tone from the ramp, so fills read as even texture
          if (sum / NR / m > (o.even ?? .78)) { row += ramp[Math.min(ramp.length - 1, Math.max(1, Math.round(sum / NR * (ramp.length - 1))))]; continue; }
          // o.edges: a cell on the edge of a fill takes a direction character from its ink gradient, measured in
          // pixels (cells are tall), so a fill's outline reads as | / \ - _ the way an ASCII artist draws it
          if (o.edges) { let gx = 0, gy = 0; for (let i = 0; i < NR; i++) { gx += v[i] * ((i % RX) - (RX - 1) / 2); gy += v[i] * (Math.floor(i / RX) - (RY - 1) / 2); }
            gx /= G.cw; gy /= G.ch; const mag = Math.hypot(gx, gy) / (m + 1e-6) * G.ch;
            if (mag > (o.edges === true ? .9 : o.edges)) { const a = Math.atan2(gy, gx) * 180 / Math.PI, e = ((a + 90) % 180 + 180) % 180;   // edge angle, 0 = horizontal
              row += e < 22 || e > 158 ? (gy > 0 && sum / NR < .38 ? '_' : '-') : e < 70 ? '\\' : e < 110 ? '|' : '/'; continue; } }
          // a uniformly inked cell (a fill) is scaled into the glyphs' density range, so tones stay apart; a cell
          // crossed by a line (mean well under max) keeps its full contrast, so the line finds / \ | _
          const k = o.tone === false ? 1 : lerp(1, tbl.dense, Math.pow(sum / NR / m, 2));
          for (let i = 0; i < NR; i++) v[i] = m * Math.pow(v[i] / m, sharp) * k;
          let best = 0, bd = 1e9; for (let g = 0; g < tbl.list.length; g++) { const gv = tbl.vecs[g]; let dd = 0; for (let i = 0; i < NR; i++) { const e = gv[i] - v[i]; dd += e * e; } if (dd < bd) { bd = dd; best = g; } }
          row += tbl.list[best];
        } else if (mode === 'ramp') {
          let s = 0; for (let py = 0; py < sy; py++) for (let px = 0; px < sx; px++) s += A(bx + px, by + py); s /= sx * sy; ink[r * cols + c] = s;
          row += s < cut ? ' ' : ramp[Math.min(ramp.length - 1, Math.max(1, Math.round(s * (ramp.length - 1))))];
        } else if (mode === 'blocks') {
          const q = [0, 0, 0, 0]; for (let py = 0; py < sy; py++) for (let px = 0; px < sx; px++) q[(py < sy / 2 ? 0 : 2) + (px < sx / 2 ? 0 : 1)] += A(bx + px, by + py);
          const n = sx * sy / 4, bits = q.map(e => e / n > .5 ? 1 : 0), key = bits.join(''); ink[r * cols + c] = q.reduce((a, b) => a + b, 0) / (sx * sy);
          row += { '0000': ' ', '1000': '▘', '0100': '▝', '0010': '▖', '0001': '▗', '1100': '▀', '0011': '▄', '1010': '▌', '0101': '▐', '1001': '▚', '0110': '▞', '1110': '▛', '1101': '▜', '1011': '▙', '0111': '▟', '1111': '█' }[key];
        } else {   // braille
          let bits = 0, s = 0; const map = [[0, 0, 0], [0, 1, 1], [0, 2, 2], [1, 0, 3], [1, 1, 4], [1, 2, 5], [0, 3, 6], [1, 3, 7]];
          for (const [dx, dy, bit] of map) { let e = 0; for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) e += A(bx + dx * 2 + px, by + dy * 2 + py); e /= 4; s += e; if (e > (o.dot ?? .45)) bits |= 1 << bit; }
          ink[r * cols + c] = s / 8; row += bits ? String.fromCodePoint(0x2800 + bits) : ' ';
        }
      }
      chars.push(row);
    }
    return { c0, r0, cols, rows, chars, ink };
  }
  // over(base, top): two asciiFrom() results of the same rectangle merged cell by cell, top's characters winning
  // wherever top has ink. The classic recipe: a fill rendered for tone, its outline rendered for edges (/ \ | _).
  function over(base, top) { const chars = base.chars.map((row, r) => { const a = [...row], b = [...top.chars[r]]; return a.map((ch, c) => b[c] && b[c] !== ' ' ? b[c] : ch).join(''); });
    const ink = base.ink.map((v, i) => top.chars[Math.floor(i / base.cols)][i % base.cols] !== ' ' ? Math.max(v, top.ink[i]) : v); return { ...base, chars, ink }; }
  // art(G, res, o): draws an asciiFrom() result. o: style ('hi' | 'fg' | 'dim' | 'faint'), alpha, shade (cell alpha
  // follows its ink, so soft edges glow less), colour (any CSS colour, overrides style)
  function art(G, res, o = {}) {
    const col = o.color || COL(o.style || 'fg'); if ((o.alpha ?? 1) <= .005) return;
    CX.save(); CX.font = `${S.weight} ${G.size}px "${S.family}"`; CX.textBaseline = 'alphabetic'; if ('letterSpacing' in CX) CX.letterSpacing = '0px';
    for (let r = 0; r < res.rows; r++) { const row = [...res.chars[r]];
      for (let c = 0; c < res.cols; c++) { const ch = row[c]; if (!ch || ch === ' ') continue;
        const [x, y] = G.at(res.c0 + c, res.r0 + r); if (x < -G.cw || x > W || y < -G.ch || y > H) continue;
        CX.globalAlpha = (o.alpha ?? 1) * (o.shade ? clamp(.45 + 1.4 * res.ink[r * res.cols + c]) : 1);
        if (procedural(ch.codePointAt(0))) drawnGlyph(ch, x, y, G, col); else { CX.fillStyle = col; CX.fillText(ch, x, y + G.base); } } }
    CX.restore();
  }
  // persist(t, fn, o): phosphor persistence for things that move. fn(tt, alpha) is drawn at t and at o.n earlier
  // instants (o.dt apart, default one frame), each fainter by o.decay: the afterglow a P3 amber tube leaves. Pure:
  // the earlier instants are recomputed, not remembered.
  function persist(t, fn, o = {}) { const n = o.n ?? 2, dt = o.dt ?? 1 / FPS, k = o.decay ?? .32;
    for (let i = n; i >= 1; i--) fn(t - i * dt, Math.pow(k, i)); fn(t, 1); }

  // ---------- repaint: a screen drawn top to bottom, the way a slow link paints it ----------
  // repaint(p, G, drawNew, o): p 0..1 through the paint. Rows above the write head show the new screen; the head
  // row shows the part already written; rows below are blank (the alternate screen was cleared). Text not yet painted
  // is taken back out of the checks' registry. o: rows (default G.rows), row0, cursor (true: the cursor rides the
  // head; off by default, as TUIs hide it while they draw).
  function repaint(p, G, drawNew, o = {}) {
    const rows = o.rows ?? G.rows, row0 = o.row0 ?? 0, pos = clamp(p) * rows, hr = Math.floor(pos), hc = Math.floor((pos - hr) * G.cols);
    if (p >= 1) return drawNew();
    const [, y0] = G.at(0, row0), [hx, hy] = G.at(hc, row0 + hr), n0 = TEXTS.length;
    CX.save(); CX.beginPath(); CX.rect(0, 0, W, y0 + hr * G.ch); if (hr < rows) CX.rect(0, hy, hx, G.ch); CX.clip(); drawNew(); CX.restore();
    const M = CX.getTransform(), cut = M.d * (y0 + hr * G.ch) + M.f;
    for (let i = TEXTS.length - 1; i >= n0; i--) if (TEXTS[i].box[1] + TEXTS[i].box[3] > cut + 1) TEXTS.splice(i, 1);
    if (o.cursor && hr < rows) cursorBlock(G, hc, row0 + hr, 1);
  }

  // ---------- the camera ----------
  // camera(t, keys, spec) -> [cx, cy, zoom]: a push-in on the tube. keys: [[t, [cx, cy, zoom]], ...] (frame pixels at
  // zoom 1), riding a spring (default 'smooth'); zoom moves in log space so a push and a pull feel the same. Draw the
  // content inside CX.save(); cam(...v); ...; CX.restore() and pass the same v to crt({ view: v }).
  function camera(t, keys, spec = 'smooth') { const v = follow(t, keys.map(k => [k[0], [k[1][0], k[1][1], Math.log(k[1][2])], k[2]]), spec); return [v[0], v[1], Math.exp(v[2])]; }
  // fit(G, c0, r0, c1, r1, pad) -> [cx, cy, zoom]: the view that frames cells c0..c1, r0..r1 with pad (fraction) to spare
  function fit(G, c0, r0, c1, r1, pad = .12) { const [x0, y0] = G.at(c0, r0), [x1, y1] = G.at(c1 + 1, r1 + 1);
    return [(x0 + x1) / 2, (y0 + y1) / 2, Math.min(W * (1 - 2 * pad) / (x1 - x0), H * (1 - 2 * pad) / (y1 - y0))]; }

  // ---------- the CRT post pass ----------
  // crt(ctx, t, o): call from post(). Barrel curvature, scanlines whose beam widens on bright phosphor, bloom from the
  // frame's own mip chain, a dark rounded tube edge, vignette, a faint glass sheen, flicker and a slow refresh band,
  // and fine grain re-seeded per frame. WebGL2; if Chrome gives no WebGL2 it falls back to scanlines, bloom and
  // vignette in 2D (no curvature). o: curve (.06), scan (.32), period (px per scanline, 4), bloom (.55), vig (.45),
  // flicker (.012), band (.035), grain (.025), glass (.02), corner (.045 of the short side), view: [cx, cy, zoom]
  // when the content was drawn through cam(cx, cy, zoom) (see TERM.camera): the tube is magnified with it.
  const CRT = { curve: .06, scan: .32, period: 4, bloom: .55, vig: .45, flicker: .012, band: .035, grain: .025, glass: .02, corner: .045 };
  let _gl = null;
  function glInit() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const gl = c.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) { _gl = false; return; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('TERM crt shader: ' + gl.getShaderInfoLog(s)); return s; };
    const vs = `#version 300 es
in vec2 p; out vec2 uv; void main() { uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
    // canvas coordinates throughout (y down). view = (cx, cy, zoom): the content was drawn through cam(cx, cy, zoom),
    // so the tube point under an output pixel is C + (p - res / 2) / zoom; curvature, scanlines, the tube's edge and
    // the glass live on the tube, so a push-in magnifies them as a real camera would, and the text stays sharp
    const fs = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 res; uniform vec3 view; uniform float frame, tt, curve, scan, period, bloom, vig, flick, band, grain, glass, corner;
in vec2 uv; out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 warp(vec2 q) { q = q * 2. - 1.; q *= vec2(1. + q.y * q.y * curve * .8, 1. + q.x * q.x * curve); return q * .5 + .5; }
vec3 at(vec2 tc, float lod) { return textureLod(src, tc, lod).rgb; }
vec3 glow(vec2 tc, float lod) { vec2 px = exp2(lod) / res; vec3 s = at(tc, lod) * .2;
  for (int i = 0; i < 8; i++) { float a = float(i) * .7853982 + .39; s += at(tc + vec2(cos(a), sin(a)) * px * 1.6, lod) * .1; } return s; }
void main() {
  vec2 p = vec2(uv.x, 1. - uv.y) * res;                       // output pixel, y down
  vec2 T = (view.xy + (p - res * .5) / view.z) / res;         // the tube point under it (0..1)
  vec2 Tw = warp(T);
  vec2 tc = ((Tw * res - view.xy) * view.z + res * .5) / res;  // where that point sits in the drawn frame
  vec2 hp = abs(Tw - .5) * res, hb = res * .5; float r = corner * min(res.x, res.y);
  vec2 dd = hp - (hb - r); float sd = length(max(dd, 0.)) + min(max(dd.x, dd.y), 0.) - r;
  float edge = 1. - smoothstep(-2. / view.z, 1. / view.z, sd);
  vec3 col = at(tc, 0.);
  float L = dot(col, vec3(.3, .59, .11));
  float s = .5 + .5 * cos(6.2831853 * Tw.y * res.y / period);
  col *= 1. - scan * (1. - s) * (1. - .65 * L);
  col *= 1. + scan * .42;
  col += (glow(tc, 3.) * .55 + glow(tc, 4.5) * .3 + glow(tc, 6.) * .15) * bloom;
  vec2 c = uv * 2. - 1.; col *= 1. - vig * clamp(dot(c * c, vec2(.32, .42)), 0., 1.);
  col += glass * smoothstep(.75, 0., length((Tw - vec2(.22, .18)) * vec2(1., 1.6)));
  float by = fract(tt * .11) * 1.4 - .2; col *= 1. + band * exp(-pow(Tw.y - by, 2.) / .006);
  col *= 1. + flick;
  col += (h21(uv * res + frame * 1.37) - .5) * grain;
  o = vec4(col * edge, 1.);
}`;
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('TERM crt link: ' + gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const U = {}; for (const n of ['src', 'res', 'view', 'frame', 'tt', 'curve', 'scan', 'period', 'bloom', 'vig', 'flick', 'band', 'grain', 'glass', 'corner']) U[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(U.src, 0); gl.uniform2f(U.res, W, H); gl.viewport(0, 0, W, H);
    _gl = { c, gl, U, tex };
  }
  let _b2 = null;
  function crt(ctx, t, o = {}) {
    o = { ...CRT, ...o };
    if (_gl === null) glInit();
    const f = Math.round(t * FPS), flick = o.flicker * (noise(t * 9, 41) + .5 * (hash(f) - .5));
    if (_gl) {
      const { gl, U, tex, c } = _gl;
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas); gl.generateMipmap(gl.TEXTURE_2D);
      gl.uniform1f(U.frame, f % 997); gl.uniform1f(U.tt, t); gl.uniform1f(U.curve, o.curve); gl.uniform1f(U.scan, o.scan); gl.uniform1f(U.period, o.period);
      gl.uniform1f(U.bloom, o.bloom); gl.uniform1f(U.vig, o.vig); gl.uniform1f(U.flick, flick); gl.uniform1f(U.band, o.band); gl.uniform1f(U.grain, o.grain);
      gl.uniform1f(U.glass, o.glass); gl.uniform1f(U.corner, o.corner); const v = o.view || [W / 2, H / 2, 1]; gl.uniform3f(U.view, v[0], v[1], v[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(c, 0, 0); ctx.globalCompositeOperation = 'source-over';
      return;
    }
    // 2D fallback: bloom from a small blurred copy, scanlines, vignette, rounded tube corners
    if (!_b2) { _b2 = document.createElement('canvas'); _b2.width = Math.round(W / 8); _b2.height = Math.round(H / 8); }
    const b = _b2.getContext('2d'); b.clearRect(0, 0, _b2.width, _b2.height); b.filter = 'blur(2px)'; b.drawImage(ctx.canvas, 0, 0, _b2.width, _b2.height); b.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.bloom * .6; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(_b2, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = o.scan * .5; ctx.fillStyle = '#000'; for (let y = 0; y < H; y += o.period) ctx.fillRect(0, y + o.period / 2, W, o.period / 2);
    ctx.globalAlpha = 1; ctx.restore(); vignette(o.vig * .7);
    ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); rr(0, 0, W, H, o.corner * Math.min(W, H)); ctx.fill('evenodd'); ctx.restore();
  }

  return { S, PHOS, CHARS, grid, screen, line, cursorBlock, blink, keys, typing, typedEnd, shell, bar, barSegs, spin, braille, pad, asciiFrom, over, art, persist, repaint, camera, fit, crt, check, plain };
})();
