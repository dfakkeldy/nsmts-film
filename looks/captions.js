// looks/captions.js: a caption SYSTEM for narrated films and lyric-style text, not a visual look: any look can call it.
// Give it word timings { words: [{ w, start, end }] } (ElevenLabs Scribe, whisper-cli DTW or a TTS's own alignment,
// all converted by video-sound's `sound.py words`) and it draws them in three modes:
//   'subtitle'  broadcast subtitles (Netflix rules): cards of at most 2 lines of 42 characters, broken at punctuation
//               and before conjunctions, never after an article or preposition, on screen at least 0.83 s, at least
//               2 frames apart, lingering up to 0.5 s after the voice;
//   'kinetic'   word-by-word pages of up to 5 words: each word pops (or blurs) in at its start, a highlight rides to
//               the word being spoken, pages break on pauses of 150 ms or more and at sentence ends;
//   'keyword'   marked words land big in condensed caps; the rest of the page stays small.
// Card: looks/captions.md. Specimen: specimens/captions.
//
//   const VOICE = captions.load('specimens/x/words.json', { offset: .5, keys: ['free'] });     // at load time
//   shots([[0, t => { scene(t); captions.draw(t, 'kinetic', { position: 'lower' }); }]]);
//   captions.draw(t, [[0, 'subtitle'], [4.2, 'kinetic', { size: 90 }], [8, null]])               // a plan: modes by time
//   captions.check('kinetic')   // pages faster than 20 characters a second (and, for subtitles, short, crowded, long)
//
// Pure functions of t: segmentation is worked out from the words alone (at load time, so cues can use it), pixel
// layout at the first draw (it needs the canvas and the fonts), and both are cached by their inputs.

const captions = (() => {
  const SC = Math.min(W, H) / 1080;   // every length in a style is at 1080p and scales with the frame's short side

  // ---------- styles ----------
  // BASE, then the mode's preset, then yours. Positions: 'bottom' | 'lower' | 'centre' | 'top' | [fx, fy] (fractions
  // of the frame, or pixels when over 1.5) | { x, y, v } (v: which part of the block sits on y: 'top'|'middle'|'bottom').
  // safe: 'frame' (5% margins, kit.js's default), 'title' (10%), 'feed' (a 9:16 feed's clear zone, see feedRect), or
  // [left, top, right, bottom] as fractions of the frame.
  const BASE = {
    font: 'Space Grotesk', weight: 600, size: 52, color: '#FFFFFF', case: 'none', align: 'center',
    position: 'bottom', safe: 'frame', maxW: null, lineGap: 1.28,
    plate: false, plateColor: '#000000', plateAlpha: .62, plateRadius: .16, platePad: [.34, .14],
    edge: 'shadow', edgeColor: 'rgba(0,0,0,.5)',   // 'shadow' | 'outline' | 'none': legibility without a plate
    ids: '@cap',                                   // registered ids: '@cap:k1.2'; '@' = voiced (judged at 20 chars/s); '~cap' skips reading time
    cps: 20, minDur: 5 / 6, gapFrames: 2, linger: .5, chain: .5, maxDur: 7, lead: 0,
  };
  const PRESET = {
    subtitle: { size: 52, weight: 600, lineChars: 42, lines: 2, plate: 'line', edge: 'none', fade: 2 / 30, position: 'bottom' },
    kinetic: { size: 84, weight: 700, lineChars: 20, lines: 2, maxWords: 5, pause: .15, hold: 1.2, pre: .03, exit: .16, wordGap: .32,
      enter: 'pop', ghost: 0, highlight: 'pill', accent: '#FFD447', accentInk: '#111111', position: 'lower' },
    keyword: { size: 48, weight: 600, keyFont: 'Barlow Condensed', keyWeight: 900, keySize: 210, keyCase: 'upper', keyColor: null,
      lineChars: 26, lines: 2, maxWords: 5, pause: .15, hold: 1.2, pre: .03, exit: .16, wordGap: .3, enter: 'rise', position: 'centre' },
  };
  const style = (mode, o = {}) => Object.assign({}, BASE, PRESET[mode] || {}, o || {}, { mode });
  const SAFE = { frame: [.05, .05, .05, .05], title: [.1, .1, .1, .1], feed: [.06, .12, .14, .28] };
  const safeOf = st => { const s = Array.isArray(st.safe) ? st.safe : SAFE[st.safe] || SAFE.frame; return { x: W * s[0], y: H * s[1], w: W * (1 - s[0] - s[2]), h: H * (1 - s[1] - s[3]) }; };
  // the clear zone of a vertical feed (TikTok, Reels, Shorts): clear of the top tabs, the right-hand buttons and the
  // caption and username block at the bottom. Use it as PROJECT.safeRect so --inspect checks the same zone.
  const feedRect = () => { const s = SAFE.feed; return [W * s[0], H * s[1], W * (1 - s[0] - s[2]), H * (1 - s[1] - s[3])]; };
  function anchor(st) {
    const S = safeOf(st), p = st.position; let x = S.x + S.w / 2, y = S.y + S.h / 2, v = 'middle';
    if (Array.isArray(p)) { x = p[0] <= 1.5 ? p[0] * W : p[0]; y = p[1] <= 1.5 ? p[1] * H : p[1]; }
    else if (p && typeof p === 'object') { x = p.x; y = p.y; v = p.v || 'middle'; }
    else if (p === 'bottom') { y = S.y + S.h - H * .02; v = 'bottom'; }
    else if (p === 'lower') y = S.y + S.h * .74;
    else if (p === 'top') { y = S.y + H * .02; v = 'top'; }
    const room = st.align === 'left' ? S.x + S.w - x : st.align === 'right' ? x - S.x : 2 * Math.min(x - S.x, S.x + S.w - x);
    return { x, y, v, maxW: Math.max(40, Math.min(st.maxW ? st.maxW * SC : Infinity, S.w * .94, room)) };
  }

  // ---------- words ----------
  const CONJ = new Set('and but or nor so yet because before after when whenever while if unless until although though that which who whom whose where as than since once whereas'.split(' '));
  const PREP = new Set('of to in on at by for with from into onto over under about across through between without within like near past per via around'.split(' '));
  const STICK = new Set('a an the my your our their his her its this these those some any every each very not no'.split(' '));
  const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'vs', 'etc', 'eg', 'ie', 'jr', 'sr']);
  const bare = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
  function norm(list, o) {
    const keyWords = new Set((o.keys || []).filter(k => typeof k === 'string').map(bare)), keyIdx = new Set((o.keys || []).filter(k => typeof k === 'number'));
    const off = o.offset || 0;
    const ws = list.map((x, i) => {
      let w = String(x.w ?? x.word ?? x.text ?? '').trim(), key = !!x.key || keyIdx.has(i);
      if (w.includes('*')) { key = true; w = w.replace(/\*/g, ''); }   // *word* marks a key word in the text itself
      const b = bare(w); if (keyWords.has(b)) key = true;
      return { w, bare: b, key, sent: /[.!?…]["'”’)\]]*$/.test(w) && !ABBR.has(b), clause: /[,;:—–]["'”’)\]]*$/.test(w),
        start: +x.start + off, end: +(x.end ?? x.start) + off };
    }).filter(x => x.w && isFinite(x.start)).sort((a, b) => a.start - b.start);
    ws.forEach((x, i) => { const nx = ws[i + 1]; x.i = i;
      if (!(x.end > x.start)) x.end = x.start + .2; if (nx && x.end > nx.start) x.end = Math.max(x.start + .04, nx.start); });
    return ws;
  }
  // load(src, o): src is { words: [...] }, a bare array, or a path to a JSON file (read synchronously at load time:
  // render.mjs's Chrome may read local files; in a browser, serve the engine folder over http). o: { offset (s added
  // to every time), keys: ['word', 3, ...] (key words for 'keyword' mode, by text or index; or mark them *word* in
  // the JSON, or key: true) }. The last track loaded is the default for draw() and check().
  let CUR = null;
  function readJSON(path) {
    const x = new XMLHttpRequest(); x.open('GET', path, false); x.overrideMimeType('application/json');
    try { x.send(); } catch (e) { throw new Error(`captions.load: could not read ${path}: ${e}. Serve the engine folder over http, or pass the JSON itself`); }
    if (!x.responseText) throw new Error(`captions.load: ${path} is empty or missing (status ${x.status})`);
    return JSON.parse(x.responseText);
  }
  function load(src, o = {}) {
    const data = typeof src === 'string' ? readJSON(src) : src, list = Array.isArray(data) ? data : data && data.words;
    if (!Array.isArray(list)) throw new Error('captions.load: expected { words: [{ w, start, end }] }');
    CUR = { words: norm(list, o), source: (data && data.source) || '', _seg: new Map(), _lay: new Map() };
    return CUR;
  }

  // ---------- segmentation: cards and pages, from characters and times only ----------
  // A dynamic programme over every way to cut the words into cards (subtitle) or pages (kinetic, keyword), scoring
  // each cut: a sentence end costs nothing, a clause end little, a cut before a conjunction or a preposition a little
  // more, a cut after an article or preposition a lot; a pause is a free cut (a must, for pages). Then each card's
  // own lines are cut the same way, bottom-heavy when it can.
  function brk(ws, i, st) {
    const a = ws[i], b = ws[i + 1]; if (!b) return 0;
    if (a.sent) return 0;
    let c = a.clause ? 3 : CONJ.has(b.bare) ? 6 : PREP.has(b.bare) ? 9 : 14;
    if (STICK.has(a.bare) || PREP.has(a.bare)) c += 25;
    if (b.start - a.end >= (st.mode === 'subtitle' ? .8 : st.pause)) c = Math.min(c, 1);
    if (st.mode === 'keyword' && a.key) c = Math.max(0, c - 6);
    return c;
  }
  const forced = (ws, i, st) => st.mode === 'subtitle' ? ws[i + 1].start - ws[i].end >= 1.5 : ws[i].sent || ws[i + 1].start - ws[i].end >= st.pause;
  function cutLines(ws, a, b, st, len) {   // -> [[a, j], [j + 1, b]] or [[a, b]], with a cost; null if it can't fit
    if (len(a, b) <= st.lineChars) return { rows: [[a, b]], cost: 0 };
    if ((st.lines ?? 2) < 2) return null;
    let best = null;
    for (let j = a; j < b; j++) {
      const l1 = len(a, j), l2 = len(j + 1, b); if (l1 > st.lineChars || l2 > st.lineChars) continue;
      const c = 3 + brk(ws, j, st) + Math.abs(l1 - l2) / 8 + (l1 > l2 + 4 ? 1.5 : 0);
      if (!best || c < best.cost) best = { rows: [[a, j], [j + 1, b]], cost: c };
    }
    return best;
  }
  function segCost(ws, a, b, st, len) {   // -1: infeasible, and so is every longer run ending at b
    const n = b - a + 1;
    if (st.maxWords && n > st.maxWords) return -1;
    if (a < b && forced(ws, a, st)) return -1;   // a grows leftwards: once a must-cut is inside, stop
    if (st.mode === 'subtitle' && ws[b].end - ws[a].start > st.maxDur && n > 1) return -1;
    let c = 10 + brk(ws, b, st), rows;
    if (st.mode === 'keyword') {
      let keys = 0, small = 0; for (let i = a; i <= b; i++) if (ws[i].key) keys++; else small += ws[i].w.length + 1;
      if (small - 1 > st.lineChars * (st.lines ?? 2) && n > 1) return -1;
      c += 40 * Math.max(0, keys - 1); rows = null;
    } else {
      const L = cutLines(ws, a, b, st, len);
      if (!L) { if (n > 1) return -1; c += 60; rows = [[a, b]]; } else { c += L.cost; rows = L.rows; }
    }
    if (st.mode === 'subtitle') {
      for (let i = a; i < b; i++) if (ws[i].sent) c += 6;   // one sentence a card where it can be
      const dur = Math.max(st.minDur, ws[b].end - ws[a].start + st.linger), cps = len(a, b) / dur;
      if (cps > st.cps) c += (cps - st.cps) * 4;
    } else {
      if (n === 1 && !ws[a].key && !ws[a].sent) c += 8;   // a lone word reads as a stutter
      const dur = Math.min((ws[b + 1] ? ws[b + 1].start : Infinity) - ws[a].start, ws[b].end - ws[a].start + st.hold), cps = len(a, b) / Math.max(.05, dur);
      if (cps > st.cps) c += (cps - st.cps) * 2;   // a page lasts until the next one starts: too fast, take more words
    }
    return { c, rows };
  }
  const SEGKEYS = ['lineChars', 'lines', 'maxWords', 'pause', 'linger', 'minDur', 'chain', 'maxDur', 'lead', 'pre', 'hold', 'gapFrames', 'cps'];
  // segments(track, mode, style, win) -> [{ a, b, rows, text, in, out, words }] for the words starting inside win
  function segments(track, mode, st, win = [-Infinity, Infinity], wi = 0) {
    const key = `${mode}|${wi}|${win[0]}|${win[1]}|${SEGKEYS.map(k => st[k]).join(',')}`; if (track._seg.has(key)) return track._seg.get(key);
    const ws = track.words.filter(w => w.start >= win[0] - 1e-6 && w.start < win[1] - 1e-6), n = ws.length, P = [0];
    for (const x of ws) P.push(P[P.length - 1] + x.w.length);
    const len = (a, b) => P[b + 1] - P[a] + (b - a);
    const best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1), how = new Array(n + 1); best[0] = 0;
    for (let b = 0; b < n; b++) for (let a = b; a >= 0; a--) {
      const r = segCost(ws, a, b, st, len); if (r === -1) break;
      if (best[a] + r.c < best[b + 1]) { best[b + 1] = best[a] + r.c; from[b + 1] = a; how[b + 1] = r.rows; }
    }
    const raw = []; for (let e = n; e > 0; e = from[e]) raw.unshift({ a: from[e], b: e - 1, rows: how[e] });
    const gap = (st.gapFrames ?? 2) / FPS, sub = mode === 'subtitle';
    const out = raw.map(s => ({ ...s, words: ws.slice(s.a, s.b + 1), text: ws.slice(s.a, s.b + 1).map(w => w.w).join(' '),
      in: ws[s.a].start - (sub ? st.lead : st.pre), mode, win: wi }));
    out.forEach((s, k) => {
      const next = out[k + 1], nextIn = next ? next.in : win[1] - (sub ? 0 : st.pre), last = ws[s.b].end;
      if (sub) {
        let o = Math.max(last + st.linger, s.in + st.minDur);
        if (nextIn - o < st.chain) o = nextIn - gap;             // a short gap closes up to 2 frames
        s.out = Math.min(o, nextIn - gap, s.in + Math.max(st.maxDur, last - s.in));
      } else s.out = Math.min(nextIn, last + st.hold);
      s.cps = s.text.length / Math.max(1e-3, s.out - s.in);
    });
    track._seg.set(key, out); return out;
  }
  // a plan: [[t0, mode, style?], ...] -> windows; a string mode is one window over the whole track
  function windows(modeOrPlan, base) {
    if (!Array.isArray(modeOrPlan)) return [{ mode: modeOrPlan, st: style(modeOrPlan, base), win: [-Infinity, Infinity], wi: 0 }];
    return modeOrPlan.map(([t0, mode, o], i) => ({ mode, st: mode ? style(mode, { ...(base || {}), ...(o || {}) }) : null,
      win: [t0, i + 1 < modeOrPlan.length ? modeOrPlan[i + 1][0] : Infinity], wi: i })).filter(w => w.mode);
  }
  // segmentsOf(modeOrPlan, style, track): the cards or pages with their in and out times, at load time, for cues
  const segmentsOf = (modeOrPlan, base, track = CUR) => windows(modeOrPlan, base).flatMap(w => segments(track, w.mode, w.st, w.win, w.wi));

  // ---------- layout (pixels; needs the canvas, so it runs at the first draw and is cached by its inputs) ----------
  const ASC = .76, DSC = .24;
  const cased = (s, c) => c === 'upper' ? s.toUpperCase() : c === 'lower' ? s.toLowerCase() : s;
  const LAYKEYS = ['font', 'weight', 'size', 'case', 'keyFont', 'keyWeight', 'keySize', 'keyCase', 'safe', 'maxW', 'lineGap', 'align', 'platePad', 'lineChars', 'wordGap'];
  function layout(track, sg, st) {
    const key = `${sg.mode}|${sg.win}|${sg.a}|${sg.text}|${JSON.stringify(st.position)}|${LAYKEYS.map(k => JSON.stringify(st[k])).join(',')}`;
    if (track._lay.has(key)) return track._lay.get(key);
    const A = anchor(st), ws = sg.words, small = { family: st.font, weight: st.weight }, big = { family: st.keyFont, weight: st.keyWeight };
    let rows;
    if (sg.mode === 'keyword') {   // a key word on a row of its own; the small words between keys wrap by width
      rows = []; let run = [];
      const flush = () => { if (!run.length) return; let cur = [];
        for (const i of run) { const s = cur.concat(i).map(j => ws[j].w).join(' ');
          if (cur.length && measure(cased(s, st.case), { ...small, size: st.size * SC }) > A.maxW) { rows.push({ idx: cur }); cur = [i]; } else cur.push(i); }
        rows.push({ idx: cur }); run = []; };
      ws.forEach((w, i) => { if (w.key) { flush(); rows.push({ idx: [i], key: true }); } else run.push(i); }); flush();
    } else rows = sg.rows.map(([a, b]) => ({ idx: Array.from({ length: b - a + 1 }, (_, k) => a - sg.a + k) }));
    // sizes: small rows share one size, shrunk if any row is too wide; a key row fits its own width
    const pad = sg.mode === 'subtitle' ? st.platePad : [0, 0];
    const space = f => Math.max(measure(' ', f), (st.wordGap || 0) * f.size);   // pages space words a little wider than type
    const rowW = (r, size) => { const f = { ...(r.key ? big : small), size }, c = r.key ? st.keyCase : st.case;
      return r.idx.reduce((s, i) => s + measure(cased(ws[i].w, c), f), 0) + space(f) * (r.idx.length - 1); };
    let size = st.size * SC; const widest = Math.max(0, ...rows.filter(r => !r.key).map(r => rowW(r, size) + 2 * pad[0] * size));
    if (widest > A.maxW) size *= A.maxW / widest;
    for (const r of rows) {
      r.size = r.key ? Math.min(st.keySize * SC, st.keySize * SC * A.maxW / Math.max(1, rowW(r, st.keySize * SC))) : size;
      r.face = r.key ? big : small; r.case = r.key ? st.keyCase : st.case;
      r.asc = r.key ? r.size * .74 : r.size * (ASC + pad[1]); r.desc = r.key ? r.size * .06 : r.size * (DSC + pad[1]);
    }
    let total = 0; rows.forEach((r, k) => { total += r.asc + r.desc; if (k) total += gapBetween(rows[k - 1], r, st, size); });
    let y = A.v === 'bottom' ? A.y - total : A.v === 'top' ? A.y : A.y - total / 2;
    const words = [];
    rows.forEach((r, k) => {
      if (k) y += gapBetween(rows[k - 1], r, st, size);
      const base = y + r.asc, f = { ...r.face, size: r.size }, sp = space(f), w = rowW(r, r.size);
      let x = st.align === 'left' ? A.x : st.align === 'right' ? A.x - w : A.x - w / 2;
      r.x0 = x; r.w = w; r.base = base; r.s = r.idx.map(i => cased(ws[i].w, r.case)).join(' ');
      for (const i of r.idx) { const s = cased(ws[i].w, r.case), ww = measure(s, f);
        words.push({ i, s, x, y: base, w: ww, size: r.size, face: r.face, key: !!r.key, asc: r.key ? r.size * .74 : r.size * ASC, desc: r.key ? 0 : r.size * DSC, row: k });
        x += ww + sp; }
      y = base + r.desc;
    });
    const box = [Math.min(...rows.map(r => r.x0)), rows[0].base - rows[0].asc, 0, 0];
    box[2] = Math.max(...rows.map(r => r.x0 + r.w)) - box[0]; box[3] = rows[rows.length - 1].base + rows[rows.length - 1].desc - box[1];
    const L = { rows, words, box, size }; track._lay.set(key, L); return L;
  }
  // baseline to baseline is size * lineGap between small rows (subtitle plates then just touch); a key row gets air
  function gapBetween(a, b, st, size) { return a.key || b.key ? size * .3 : Math.max(0, size * st.lineGap - a.desc - b.asc); }

  // ---------- drawing ----------
  const POP = { stiffness: 380, damping: 20, mass: 1 }, SLAM = { stiffness: 520, damping: 30, mass: 1 };
  const PILL = { lead: { stiffness: 420, damping: 32, mass: 1 }, trail: { stiffness: 220, damping: 26, mass: 1 } };
  // a box through the current transform (captions are meant for screen space, but a camera is honoured)
  function reg(id, str, x, y, w, h, a, px) {
    const M = CX.getTransform(), pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([u, v]) => [M.a * u + M.c * v + M.e, M.b * u + M.d * v + M.f]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    readable(id, str, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), a * CX.globalAlpha, px * Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)));
  }
  // one line of caption text, with the style's edge treatment under it
  function ink(id, s, x, y, f, col, st, o = {}) {
    if (st.edge === 'outline') { CX.save(); CX.font = font(f.size, f); if ('letterSpacing' in CX) CX.letterSpacing = '0px'; CX.textAlign = 'left'; CX.textBaseline = 'alphabetic';
      CX.globalAlpha *= o.alpha ?? 1; CX.lineJoin = 'round'; CX.lineWidth = f.size * .14; CX.strokeStyle = st.edgeColor; CX.strokeText(s, x, y); CX.restore(); }
    CX.save();
    if (st.edge === 'shadow' && !o.flat) { CX.shadowColor = st.edgeColor; CX.shadowBlur = f.size * .22; CX.shadowOffsetY = f.size * .05; }
    const r = text(id, s, x, y, { ...f, color: col, alpha: o.alpha ?? 1, blur: o.blur || 0 }); CX.restore(); return r;
  }
  const idOf = (st, sg, k) => `${st.ids}:${sg.mode[0]}${sg.win}.${k}`;

  function drawSubtitle(t, sg, k, st, track) {
    const L = layout(track, sg, st), f = st.fade || 0;
    const a = f > 0 ? Math.min(easeOut(seg(t, sg.in, sg.in + f)), 1 - seg(t, sg.out - f, sg.out)) : 1; if (a <= .001) return;
    const id = idOf(st, sg, k), pad = st.platePad;
    CX.save(); CX.globalAlpha *= a;
    if (st.plate) {
      CX.save(); CX.globalAlpha *= st.plateAlpha; CX.fillStyle = st.plateColor;
      if (st.plate === 'block') { const b = L.box, px = pad[0] * L.size; rr(b[0] - px, b[1], b[2] + 2 * px, b[3], st.plateRadius * L.size); CX.fill(); }
      else for (const r of L.rows) { rr(r.x0 - pad[0] * r.size, r.base - r.asc, r.w + 2 * pad[0] * r.size, r.asc + r.desc, st.plateRadius * r.size); CX.fill(); }
      CX.restore();
    }
    L.rows.forEach((r, j) => ink(`${id}#${j}`, r.s, r.x0, r.base, { ...r.face, size: r.size }, st.color, st, { flat: !!st.plate }));
    reg(id, sg.text, L.box[0], L.box[1], L.box[2], L.box[3], 1, L.size);
    CX.restore();
  }

  // a word's entrance: { a: alpha, s: scale, dy: rise in px, blur } at time t for a word that starts at t0
  function enter(t, t0, how, size, key) {
    const dt = t - t0; if (dt < 0) return null;
    if (key) { const s = springStep(dt, SLAM); return { a: easeOut(seg(t, t0, t0 + .06)), s: lerp(1.35, 1, s), dy: 0, blur: 0 }; }
    if (how === 'pop') { const s = springStep(dt, POP); return { a: easeOut(seg(t, t0, t0 + .07)), s: lerp(.55, 1, s), dy: (1 - s) * size * .16, blur: 0 }; }
    if (how === 'blur') { const k = EASE.punch(seg(t, t0, t0 + .26)); return { a: k, s: 1, dy: (1 - k) * size * .3, blur: 12 * SC * (1 - k) }; }
    if (how === 'rise') { const k = EASE.outExpo(seg(t, t0, t0 + .3)); return { a: k, s: 1, dy: (1 - k) * size * .4, blur: 0 }; }
    return { a: 1, s: 1, dy: 0, blur: 0 };
  }

  function drawPage(t, sg, k, st, track) {
    const L = layout(track, sg, st), ex = st.exit || 0, e = ex > 0 ? EASE.exit(seg(t, sg.out - ex, sg.out)) : 0, pa = 1 - e;
    if (pa <= .001) return;
    const id = idOf(st, sg, k), pre = st.pre || 0;
    CX.save(); CX.globalAlpha *= pa; CX.translate(0, -14 * SC * e); if (e > .02) CX.filter = `blur(${(5 * SC * e).toFixed(2)}px)`;
    // the word being spoken: the last one whose start has passed
    let act = -1; L.words.forEach((w, j) => { if (t >= sg.words[w.i].start - pre) act = j; });
    // the highlight pill rides to the active word: two edges on different springs, so it stretches as it travels
    let pill = null;
    if (sg.mode === 'kinetic' && st.highlight === 'pill' && act >= 0) {
      const px = L.size * .15, py = L.size * .1, keys = L.words.map(w => [sg.words[w.i].start - pre, w.x - px, w.x + w.w + px]);
      const [l, r] = edges(t, keys, { lead: PILL.lead, trail: PILL.trail });
      const top = follow(t, L.words.map(w => [sg.words[w.i].start - pre, w.y - w.size * ASC - py]), PILL.lead), h = L.size * (ASC + DSC) + 2 * py;
      const first = sg.words[L.words[0].i].start - pre, grow = lerp(.55, 1, springStep(t - first, POP));
      const lastW = sg.words[L.words[L.words.length - 1].i], fade = act === L.words.length - 1 ? 1 - ease(seg(t, lastW.end + .3, lastW.end + .55)) : 1;
      const cx = (l + r) / 2, cy = top + h / 2, w = (r - l) * grow, hh = h * grow;
      pill = { x: cx - w / 2, y: cy - hh / 2, w, h: hh, rad: Math.min(hh / 2, L.size * .24), a: fade * easeOut(seg(t, first, first + .07)) };
      if (pill.a > .01) { CX.save(); CX.globalAlpha *= pill.a; rr(pill.x, pill.y, pill.w, pill.h, pill.rad); CX.fillStyle = st.accent; CX.fill(); CX.restore(); }
    }
    const drawWords = (pass) => L.words.forEach((w, j) => {
      const word = sg.words[w.i], t0 = word.start - pre, en = enter(t, t0, w.key ? 'slam' : st.enter, w.size, w.key);
      if (!en && !(st.ghost > 0)) return;
      const E = en || { a: st.ghost, s: 1, dy: 0, blur: 0 };   // ghost: the page shows dim words not yet spoken
      let col = w.key ? (st.keyColor || st.color) : st.color;
      if (sg.mode === 'kinetic' && st.highlight === 'colour' && j === act) col = mixCol(st.color, st.accent, ease(seg(t, t0, t0 + .08)));
      if (pass === 2) col = st.accentInk;
      const cx = w.x + w.w / 2, cy = w.y - (w.asc - w.desc) / 2;
      CX.save(); CX.translate(cx, cy + E.dy); CX.scale(E.s, E.s); CX.translate(-cx, -cy);
      const settled = en && E.a > .9 && Math.abs(E.s - 1) < .08 && pass === 1;
      // a key word registers its own caps box: draw.js text() reads a caps word's zero descent as missing (`||`) and
      // claims .2 em below the baseline, which --inspect calls a collision with the row under it. Drop this once
      // draw.js uses `??` (requested), and let ink() register key words like the rest.
      ink(settled && !w.key ? `${id}#${j}` : null, w.s, w.x, w.y, { ...w.face, size: w.size }, col, st, { alpha: E.a, blur: E.blur, flat: pass === 2 });
      if (settled && w.key) reg(`${id}#${j}`, w.s, w.x, w.y - w.asc, w.w, w.asc + w.size * .02, E.a, w.size);
      CX.restore();
    });
    drawWords(1);
    if (pill && pill.a > .01) { CX.save(); rr(pill.x, pill.y, pill.w, pill.h, pill.rad); CX.clip(); CX.globalAlpha *= pill.a; drawWords(2); CX.restore(); }
    reg(id, sg.text, L.box[0], L.box[1], L.box[2], L.box[3], 1, Math.min(...L.rows.map(r => r.size)));
    CX.restore();
  }

  // draw(t, modeOrPlan, style, track): the caption(s) on screen at t. A plan [[t0, mode, style?], ...] switches modes
  // by time (each window holds the words that START inside it, and its last card or page leaves by the next t0; put
  // t0 a hair before the window's first word). mode null in a plan: no captions from t0.
  function draw(t, modeOrPlan = 'subtitle', base = {}, track = CUR) {
    if (!track) throw new Error('captions.draw: load() a track first');
    for (const w of windows(modeOrPlan, base)) {
      const segs = segments(track, w.mode, w.st, w.win, w.wi);
      for (let k = 0; k < segs.length; k++) { const sg = segs[k]; if (t < sg.in || t >= sg.out) continue;
        if (w.mode === 'subtitle') drawSubtitle(t, sg, k, w.st, track); else drawPage(t, sg, k, w.st, track); }
    }
  }

  // ---------- checks ----------
  // check(modeOrPlan, style, track, quiet): flags every page or card faster than style.cps (20 characters a second,
  // Netflix's adult limit), and for subtitles: cards under 0.83 s, closer than 2 frames, lines over 42 characters,
  // longer than 7 s. Prints each with console.warn (render.mjs shows them) unless quiet; returns the list.
  function check(modeOrPlan = ['subtitle', 'kinetic', 'keyword'], base = {}, track = CUR, quiet = false) {
    const list = Array.isArray(modeOrPlan) && typeof modeOrPlan[0] === 'string' ? modeOrPlan.map(m => [m]) : [[modeOrPlan]];
    const out = [];
    for (const [m] of list) for (const w of windows(m, base)) {
      const segs = segments(track, w.mode, w.st, w.win, w.wi), st = w.st;
      segs.forEach((s, k) => {
        const add = (kind, value, msg) => out.push({ mode: w.mode, kind, t: +s.in.toFixed(3), text: s.text, value: +value.toFixed(2), msg: `${w.mode} "${s.text}" at ${s.in.toFixed(2)} s: ${msg}` });
        if (s.cps > st.cps + 1e-6) add('fast', s.cps, `${s.cps.toFixed(1)} characters a second, over ${st.cps}`);
        if (w.mode !== 'subtitle') return;
        if (s.out - s.in < st.minDur - 1e-3) add('short', s.out - s.in, `on screen ${(s.out - s.in).toFixed(2)} s, under ${st.minDur.toFixed(2)} s`);
        if (segs[k + 1] && segs[k + 1].in - s.out < (st.gapFrames ?? 2) / FPS - 1e-3) add('gap', segs[k + 1].in - s.out, `under ${st.gapFrames ?? 2} frames before the next card`);
        for (const [a, b] of s.rows) { const l = s.words.slice(a - s.a, b - s.a + 1).map(x => x.w).join(' ').length; if (l > st.lineChars) add('line', l, `a line of ${l} characters, over ${st.lineChars}`); }
        if (s.out - s.in > st.maxDur + 1e-3) add('long', s.out - s.in, `on screen ${(s.out - s.in).toFixed(1)} s, over ${st.maxDur} s`);
      });
    }
    if (!quiet) for (const i of out) console.warn('captions.check: ' + i.msg);
    return out;
  }

  // ---------- the voice, for pictures that react to it ----------
  // active(t): the word being spoken at t, or null. level(t, o): a 0..1 envelope of the voice from the word times (a
  // rise at each word, a slower fall after it), for a lamp that listens, a mouth, a meter, ducking. o: { attack
  // (default .08 s: it flickers up at each sentence), release (default .35 s), track }. Within a sentence it stays
  // near 1 and it falls in the pauses; for a body that leans in while someone talks, slow it: { attack: .3, release: .7 }.
  function active(t, track = CUR) { for (const w of track.words) if (t >= w.start && t < w.end) return w; return null; }
  function level(t, o = {}) {
    const track = o.words ? o : o.track || CUR, at = o.attack ?? .08, rl = o.release ?? .35; let v = 0;
    for (const w of track.words) { if (w.start - at * .4 > t || w.end + rl < t) continue;
      v = Math.max(v, Math.min(easeOut(seg(t, w.start - at * .4, w.start + at * .6)), 1 - easeIn(seg(t, w.end, w.end + rl)))); }
    return v;
  }

  return { S: BASE, PRESET, SAFE, style, load, draw, check, segments: segmentsOf, feedRect, anchor, active, level,
    get track() { return CUR; } };
})();
