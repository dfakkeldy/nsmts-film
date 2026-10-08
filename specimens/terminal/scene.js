// terminal specimen: a deploy that flies a kite. Mid-session in ~/field-notes, `kite check` is still printing; the
// user types `kite up --site public`; the made-up tool takes the alternate screen and its upload lifts an ASCII kite
// whose string is tied to the cursor block; the upload lands, the bell rings, the status bar becomes a slab; the tool
// exits and the shell prints the receipt. 10 s at 30 fps, 5 bars at 120 BPM.
const b = tb, G = TERM.grid(), PR = '~/field-notes $ ';

// ---------- the timeline (the picture and the sound both read these) ----------
const T_PROMPT = .80, T_TYPE = 1.25;
const CMD = { t: T_PROMPT, prompt: PR, cmd: 'kite up --site public', type: T_TYPE, cps: 15, id: 'cmd:up' };
const T_TYPED = TERM.typedEnd(CMD), T_ENTER = Math.max(b(6), Math.ceil((T_TYPED + .2) / (BEAT / 2)) * BEAT / 2);   // Enter on the next half beat
CMD.enter = T_ENTER;
const T_ALT = T_ENTER + .12, T_PAINT = .36;                   // the tool takes the alternate screen and paints it
const T_UP = T_ALT + T_PAINT + .12;                           // upload starts
const T_LIVE = b(12), T_GUST = b(13.5), T_EXIT = b(16);       // live on bar 3; a gust; the tool exits on bar 4
// upload progress: a quick start, a stall on the one big photo, a run home
const PROG = [[T_UP, 0], [T_UP + .3, .07, easeIn], [T_UP + 1.0, .5, EASE.outExpo], [T_UP + 1.4, .54, ease], [T_LIVE - .1, 1, EASE.inOut]];
const progress = t => kf(t, PROG);
const MB = 2.1, FILES = 41;

// ---------- the shell's scrollback ----------
// rows: 0-4 earlier commands, 5-10 `kite check` (the links line still counting at frame 0), 11 the command, 12-14 the
// receipt. 15 lines on a 17-row screen, so nothing scrolls.
const check = (name, n, extra = '') => [['  ' + TERM.pad(name, 9), 'fg'], [TERM.pad(n, 4, true), 'hi'], ['   ok', 'dim'], [extra, 'dim']];
// a check still running: its count climbs, a braille spinner turns, and at t1 it settles into the finished line
const counting = (name, n, t0, t1) => tt => tt >= t1 ? check(name, n)
  : [['  ' + TERM.pad(name, 9), 'fg'], [TERM.pad(Math.floor(n * (1 - Math.pow(1 - seg(tt, t0, t1), 1.4))), 4, true), 'hi'], ['   ' + TERM.braille(tt, 10), 'dim']];
const T_LINKS = .30;
const LOG = [
  { t: -6, prompt: PR, cmd: 'git pull --quiet', enter: -5.8, id: '~hist:pull' },
  { t: -5.5, prompt: PR, cmd: 'ls', enter: -5.4, id: '~hist:ls' },
  { t: -5.3, segs: [['drafts  photos  public  kite.toml', 'fg']], id: '~hist:files' },
  { t: -5, prompt: PR, cmd: 'kite build', enter: -4.6, id: '~hist:build' },
  { t: -3.8, segs: [['  built ', 'fg'], ['14', 'hi'], [' pages → public/', 'fg'], ['   0.8 s', 'dim']], id: '~hist:built' },
  { t: -3, prompt: PR, cmd: 'kite check', enter: -2.6, id: '~hist:check' },
  { t: -1.6, segs: check('pages', 14), id: '~hist:pages' },
  { t: -1.2, live: counting('links', 96, -1.2, T_LINKS), until: T_LINKS, final: true, id: 'check:links' },
  { t: .42, segs: check('images', 22, '   3 resized'), id: 'check:images' },
  { t: .54, segs: check('feeds', 1), id: 'check:feeds' },
  { t: .66, segs: [['✓ ', 'hi'], ['ready to fly', 'fg']], id: 'check:ready' },
  CMD,
  // printed after the tool leaves the alternate screen
  { t: T_EXIT + .08, segs: [['↑ ', 'hi'], [`${FILES} files  ${MB} MB`, 'fg'], ['   in 2.3 s', 'dim']], id: 'sum:sent' },
  { t: T_EXIT + .22, segs: [['◊ ', 'hi'], ['live  ', 'fg'], ['https://field-notes.kite.page', 'link']], id: 'sum:live' },
  { t: T_EXIT + .5, prompt: PR, id: 'cmd:end' },             // its cursor is on (blink phase) for the last .4 s
];
const ROW_CMD = LOG.indexOf(CMD), ROW_END = LOG.length - 1;   // the command's row and the last prompt's row
// after the tool exits, the lines above the command come back as scrollback the viewer has already read (shot 1), and
// the closing push-in crops them on purpose, so that shot registers them under '~' ids
const LOG_AFTER = LOG.map((e, i) => i < ROW_CMD && e.id && !e.id.startsWith('~') ? { ...e, id: '~' + e.id } : e);

// ---------- the tool's screen: header, sky rows 1..14, ground, status ----------
const GROUND = G.rows - 2, STATUS = G.rows - 1, SKY = [0, 1, G.cols, GROUND - 1], HAND = [5, GROUND];
const [handX, handY] = G.mid(...HAND);
const CP = (c, r) => [G.x0 + c * G.cw, G.y0 + r * G.ch];      // a point in cell units (fractions allowed)
// half-width, top and bottom of the diamond, crossbar height. The upper edges are steep (44 degrees): the edges pass
// turns an edge much shallower than about 35 degrees into '_', so a kite tilted 10 degrees keeps its / \ shoulders
const K = { w: 140, top: 190, bot: 260, bar: .28 };
// the kite climbs with the upload, lagging it on a heavy spring. It starts propped up near the hand, tilted back into
// the wind and whole (its tip in row 14), and rights itself by a third of the way up. Wind is seeded noise; one gust
// after it lands, pushing it sideways and turning it rather than lifting it, so the top point never meets the header.
const ALT = [[-1, 0], [T_UP, .06], [T_UP + .3, .32], [T_UP + 1.0, .62], [T_UP + 1.4, .66], [T_LIVE - .1, 1]];
// REST_ROT: a lean of 11 degrees; at 23 the downwind edge turns into a column of | and the kite reads as a pennant.
// TOP_MIN: the highest the kite's centre may go (soft clamp), so its tip stays in row 2, a clear row under the header
const REST_ROT = -.2, TOP_MIN = CP(0, 2.3)[1] + K.top;
function kiteAt(t) {
  const alt = clamp(follow(t, ALT, 'heavy'), 0, 1.04), up = clamp(alt), g = kick(t, T_GUST, { attack: .14, tau: .55 });
  const [rx, ry] = CP(18.5, 9.3), [px, py] = CP(50.5, 6.4);
  const x = lerp(rx, px, ease(up)) + up * 52 * noise(t * .5, 2) + 180 * g;
  const y = rubberLo(lerp(ry, py, Math.pow(up, .6)) + up * 16 * noise(t * .66, 5) - 18 * g, TOP_MIN, 14);   // it rises first, then runs downwind
  const rot = lerp(REST_ROT, 0, ease(alt / .3)) + .035 * noise(t * 2.4, 11) + up * .08 * noise(t * .8, 7) + .12 * g;
  return { x, y, rot, alt: up, g };
}
const kPt = (k, lx, ly) => [k.x + lx * Math.cos(k.rot) - ly * Math.sin(k.rot), k.y + lx * Math.sin(k.rot) + ly * Math.cos(k.rot)];
// the body: two panels, one bright and one at 40% ink, so the characters split into @@@@ and ==== halves; with
// edges on, the outline comes out as / \\ and the step between the panels as a | spar
function kiteBody(c, k) {
  c.save(); c.translate(k.x, k.y); c.rotate(k.rot);
  c.beginPath(); c.moveTo(0, -K.top); c.lineTo(K.w, -K.top * K.bar); c.lineTo(0, K.bot); c.lineTo(-K.w, -K.top * K.bar); c.closePath();
  c.fillStyle = 'rgba(255,255,255,.4)'; c.fill(); c.save(); c.clip(); c.fillStyle = '#fff'; c.fillRect(0, -K.top, K.w, K.top + K.bot); c.restore();
  c.restore();
}
// the tail and the string are thin lines: braille, the finest mode. The tail lies in the grass until the kite lifts
// it: it is clipped just above the kite's resting tip, so it comes into view as the kite climbs; aloft, it hangs
// less and streams downwind, so it stays clear of the ground
const tailClip = k => CP(0, lerp(14.2, 15, clamp(k.alt / .4)))[1];
function tailPts(t, k) {
  const pts = [kPt(k, 0, K.bot)];
  for (let i = 1; i <= 8; i++) { const s = i / 8, ang = k.rot + Math.PI / 2 - lerp(.7, 1.35, s) * (.3 + .9 * k.alt) - .3 * k.g, w = (10 + 22 * s) * Math.sin(i * .95 - t * 7.2) * (.25 + k.alt);
    const [px, py] = pts[i - 1]; pts.push([px + Math.cos(ang) * 40 - Math.sin(ang) * w * .3, py + Math.sin(ang) * 40 + Math.cos(ang) * w * .3]); }
  return pts;
}
function kiteTail(c, t, k) {
  c.save(); c.beginPath(); c.rect(-W, -H, 3 * W, H + tailClip(k)); c.clip();
  const pts = tailPts(t, k); c.lineWidth = 6; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
  for (const i of [3, 5, 7]) { const [x, y] = pts[i], a = Math.atan2(y - pts[i - 1][1], x - pts[i - 1][0]) + Math.PI / 2, s = 20;
    c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(-s, -s * .7); c.lineTo(-s, s * .7); c.closePath(); c.moveTo(0, 0); c.lineTo(s, -s * .7); c.lineTo(s, s * .7); c.closePath(); c.fill(); c.restore(); }
  c.restore();
}
// the string runs from the hand (the cursor block) to the bridle, taut at launch and sagging a little as it pays out
function kiteString(c, k) {
  const [ax, ay] = [handX, handY - G.ch * .45], [bx, by] = kPt(k, 0, K.bot * .18);
  const sag = lerp(14, 34, k.alt) + 60 * k.g, mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
  c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
}
function statusBar(t) {
  const p = progress(t);
  if (t >= T_LIVE) return [[TERM.pad(' ◊ live   https://field-notes.kite.page', G.cols), 'inv']];
  return [[' ↑ uploading ', 'inv', 'tui:uploading'], ['  ', 'fg'], ...TERM.barSegs(p, 28), [' ' + TERM.pad(Math.floor(p * 100) + '%', 4, true), 'hi', '~tui:pct'], [`   ${(p * MB).toFixed(1)} of ${MB} MB`, 'dim', '~tui:mb']];
}
function tool(t) {
  TERM.line(G, 0, 0, [['kite 2.4.0', 'fg'], ['   public/ → field-notes.kite.page', 'dim']], { id: 'tui:head' });
  TERM.persist(t, (tt, a) => { const k = kiteAt(tt);
    TERM.art(G, TERM.asciiFrom(c => { kiteString(c, k); kiteTail(c, tt, k); }, G, SKY, { mode: 'braille', dot: .3 }), { style: 'dim', alpha: a });
    TERM.art(G, TERM.asciiFrom(c => kiteBody(c, k), G, SKY, { edges: true }), { style: 'hi', alpha: a }); }, { n: 2, decay: .22 });
  TERM.line(G, 0, GROUND, [['─'.repeat(G.cols), 'faint']]);
  TERM.cursorBlock(G, ...HAND);                                // the hand that holds the string
  TERM.line(G, 0, STATUS, statusBar(t), { id: t >= T_LIVE ? 'tui:live' : 'tui:status' });
  // the slab lands with a flare: the slab itself flashes hot and the CRT bloom carries the glow past its edges
  const flash = t >= T_LIVE ? 1 - EASE.outExpo(seg(t, T_LIVE, T_LIVE + .6)) : 0;
  if (flash > 0) { const [sx, sy] = G.at(0, STATUS); CX.save(); CX.globalCompositeOperation = 'lighter'; CX.globalAlpha = .4 * flash; CX.fillStyle = TERM.S.hi;
    CX.fillRect(Math.round(sx), sy, Math.round(G.cols * G.cw), G.ch); CX.restore(); }
}

// ---------- the camera: close on the shell, wide for the flight, close on the receipt ----------
// a push-in on the tube: the CRT pass magnifies scanlines, curvature and the tube's edge with it. V(c, r, zoom) puts
// cell point (c, r) at the centre of the frame.
const V = (c, r, z) => [...CP(c, r), z];
const crit = k => ({ stiffness: k, damping: 2 * Math.sqrt(k), mass: 1 });   // critically damped: no overshoot
const VIEW = [
  [-1, V(19.5, 5.4, 1.66)],                                   // frame 0: the check landing in the lower third
  [.3, V(19.5, 6.05, 1.6), crit(9)],                          // follow the output down as the check finishes
  [T_TYPE, V(19.2, 6.15, 1.645), crit(6)],                     // a slow push while the command is typed; every row stays whole
  [T_ENTER - .02, [W / 2, H / 2, 1], crit(220)],              // Enter: pull back (settled in .4 s) to reveal the tube as the tool opens
  [T_LIVE, [W / 2, H / 2 + 26, 1.05], { stiffness: 30, damping: 11, mass: 1 }],   // lean in on the landing
  [T_EXIT - .06, V(19, ROW_CMD - 2.4, 1.45), 'smooth'],        // back to the shell: the command and its receipt
  [T_EXIT + .4, V(18.6, ROW_END - .42, 1.69), crit(20)],       // push in on the receipt: the URL centred, the prompt under it,
                                                               // settled by 9.7 s with the frame's top edge between two rows
];
const viewAt = t => TERM.camera(t, VIEW);
const framed = draw => (t, lt) => { TERM.screen(G); CX.save(); cam(...viewAt(t)); draw(t, lt); CX.restore(); };

// ---------- shots ----------
// the shell shots crop the screen on purpose, so they register only what the camera holds in the safe area (inView)
shots([
  [0, framed(t => TERM.shell(t, G, LOG, { cursor: t < T_ENTER, inView: true }))],
  [T_ALT, framed((t, lt) => TERM.repaint(lt / T_PAINT, G, () => tool(t), { cursor: true }))],
  [T_EXIT, framed(t => TERM.shell(t, G, LOG_AFTER, { inView: true }))],
]);
post((c, t) => TERM.crt(c, t, { view: viewAt(t) }));

// ---------- sound cues, from the same times ----------
cue(T_LINKS, 'tick', { weight: .3, id: 'links-done' });
cue(.66, 'tick', { weight: .45, id: 'ready' });
cue(T_TYPE, 'key', { weight: .5, dur: +(T_TYPED - T_TYPE).toFixed(3), id: 'typing' });
cue(T_ENTER, 'click', { weight: .8, id: 'enter' });
cue(T_ALT, 'swish', { weight: .35, dur: T_PAINT, id: 'alt-screen' });
cue(T_UP, 'riser', { weight: .45, dur: +(T_LIVE - T_UP).toFixed(3), id: 'upload' });
cue(T_LIVE, 'bell', { weight: .9, id: 'live' });
cue(T_GUST, 'whoosh', { weight: .5, id: 'gust' });
cue(T_EXIT, 'snap', { weight: .4, id: 'exit' });
cue(T_EXIT + .22, 'tick', { weight: .4, id: 'receipt' });

// ---------- lab: the kite in the raster modes (render.mjs --loop=modes) ----------
LOOPS.modes = t => {
  TERM.screen(G);
  const pw = Math.floor(G.cols / 3), rows = G.rows - 2;
  const kite = (c, x, y, mode) => { c.save(); c.translate(x, y); c.rotate(.1 * Math.sin(t * Math.PI));   // one sway per 2 s loop
    c.beginPath(); c.moveTo(0, -K.top); c.lineTo(K.w, -K.top * K.bar); c.lineTo(0, K.bot); c.lineTo(-K.w, -K.top * K.bar); c.closePath();
    if (mode === 'fill') { c.fillStyle = 'rgba(255,255,255,.4)'; c.fill(); c.save(); c.clip(); c.fillStyle = '#fff'; c.fillRect(0, -K.top, K.w, K.top + K.bot); c.restore(); }
    else { c.lineWidth = 12; c.stroke(); }
    c.restore(); };
  [['fill', ['fill']], ['fill + edges', ['fill', 'edges']], ['braille', ['line']]].forEach(([name, passes], i) => {
    const c0 = i * pw, [x0, y0] = G.at(c0, 1), w = pw * G.cw, h = rows * G.ch, rect = [c0, 1, pw, rows];
    TERM.line(G, c0 + 1, 0, [[name, 'dim']]);
    const at = [x0 + w / 2, y0 + h * .42];
    if (name === 'braille') return TERM.art(G, TERM.asciiFrom(c => kite(c, ...at, 'line'), G, rect, { mode: 'braille' }), { style: 'hi' });
    const res = TERM.asciiFrom(c => kite(c, ...at, 'fill'), G, rect, { edges: passes.includes('edges') });
    TERM.art(G, res, { style: 'hi' });
  });
};
LOOPS.modes.len = 2;
