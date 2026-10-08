// kit.js: the motion-film harness inside the page. Time, maths, easing, springs, beats, shots, sound cues, the text
// registry the checks read, cursors and drags, and the frame loop render.mjs drives.
//
// The one rule: every frame is a pure function of time. draw code may read t and constants, never Date.now(),
// Math.random(), timers, CSS transitions or state left by an earlier frame. render.mjs renders frames in parallel, out
// of order and after relaunches, and a frame that depends on history comes out different every time.
//
// Reserved names (global, shared by every script on the page; don't redeclare them in a look or scene): P, PROJECT,
// W, H, FPS, DUR, BPM, BEAT, OFF, METER, MODE, T (the current time), CX (the 2D context draw.js draws into), OUT,
// TEXTS, CUES, SHOTS, LOOPS, POST, READY, PAL, and every function below and in draw.js. Name a look's own things
// inside its namespace object (UIM, KIN, RISO...).

const P = PROJECT;
const W = P.width || 1920, H = P.height || 1080, FPS = P.fps || 30, DUR = P.duration;
const BPM = P.bpm || 120, BEAT = 60 / BPM, OFF = P.offset || 0, METER = P.meter || 4;
const MODE = P.mode === 'dom' ? 'dom' : 'canvas';
const RENDER = new URLSearchParams(location.search).has('render');
const TAU = Math.PI * 2;

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const invLerp = (a, b, x) => b === a ? 0 : (x - a) / (b - a);
const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
const frac = x => x - Math.floor(x);
const seg = (t, a, b) => clamp((t - a) / (b - a));                  // 0..1 progress of t through [a, b]
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// seeded generator (mulberry32): rnd(seed)() returns 0..1. Seed it from something stable (an index, a name), never time.
function rnd(seed) { let a = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0 : seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// smooth 1D value noise, -1..1, seeded: noise(t * 0.7, 3) drifts slowly. noise2(x, y, seed) for fields.
function noise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 101.3) * 2 - 1, hash(i + 1 + seed * 101.3) * 2 - 1, u); }
function noise2(x, y, seed = 0) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash(a * 57.31 + b * 113.7 + seed * 19.19) * 2 - 1;
  return lerp(lerp(h(i, j), h(i + 1, j), ux), lerp(h(i, j + 1), h(i + 1, j + 1), ux), uy); }

// ---------- easing ----------
const linear = x => clamp(x);
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeIn = x => Math.pow(clamp(x), 3);
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const backOut = (x, s = 1.4) => { x = clamp(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
// bezier(x1, y1, x2, y2) returns an easing function, like CSS cubic-bezier().
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return x => { x = clamp(x); let s = x;
    for (let i = 0; i < 8; i++) { const e = X(s) - x, d = dX(s); if (Math.abs(e) < 1e-6) return Y(s); if (Math.abs(d) < 1e-6) break; s -= e / d; }
    let lo = 0, hi = 1; s = x; for (let i = 0; i < 30; i++) { const v = X(s); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s); };
}
// Named curves that look good (fframes' and product-film's measured favourites):
const EASE = {
  outExpo: bezier(.16, 1, .3, 1),     // fast, then settles: slides, wipes, text in
  inOut: bezier(.65, 0, .35, 1),      // camera moves, morphs, anything that travels
  punch: bezier(.22, 1, .36, 1),      // words landing
  glide: bezier(.42, 0, .12, 1),      // a cursor arriving
  exit: bezier(.55, 0, 1, .45),       // leaving: faster than arriving
};
// kf(t, [[t0, v0], [t1, v1], ...], e): keyframes, eased between keys; values may be numbers or arrays.
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const [a, va] = keys[i - 1], [b, vb] = keys[i], k = (keys[i][2] || e)((t - a) / (b - a));
    return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
  }
  return keys[keys.length - 1][1];
}

// ---------- springs (closed form, so any t renders on its own) ----------
// A spring is { stiffness, damping, mass }: the physical parameters UI frameworks use. springStep(tau, spec) is its
// step response, 0 at tau <= 0 rising to 1, with zero starting velocity, so adding one never jerks.
const SPRING = {
  snappy: { stiffness: 300, damping: 26, mass: 1 },   // UI: quick, a hair of overshoot (~3%)
  soft: { stiffness: 150, damping: 18, mass: 1 },     // friendly, noticeable settle
  smooth: { stiffness: 120, damping: 22, mass: 1 },   // critically damped: no overshoot, camera and big moves
  heavy: { stiffness: 90, damping: 24, mass: 2 },     // large objects, slow and solid
  bouncy: { stiffness: 220, damping: 12, mass: 1 },   // playful; use rarely, never on UI chrome
};
const _SPR = new Map();
function _spring(spec) {
  const s = typeof spec === 'string' ? SPRING[spec] : spec || SPRING.snappy;
  if (!s) throw new Error(`unknown spring "${spec}"`);
  const key = `${s.stiffness}|${s.damping}|${s.mass || 1}`; if (_SPR.has(key)) return _SPR.get(key);
  const m = s.mass || 1, w0 = Math.sqrt(s.stiffness / m), z = s.damping / (2 * Math.sqrt(s.stiffness * m));
  let f;
  if (Math.abs(z - 1) < 1e-4) f = x => 1 - Math.exp(-w0 * x) * (1 + w0 * x);
  else if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); f = x => 1 - Math.exp(-z * w0 * x) * (Math.cos(wd * x) + z * w0 / wd * Math.sin(wd * x)); }
  else { const r = Math.sqrt(z * z - 1), r1 = w0 * (-z + r), r2 = w0 * (-z - r); f = x => 1 + (r2 * Math.exp(r1 * x) - r1 * Math.exp(r2 * x)) / (r1 - r2); }
  let settle = 0; for (let x = 10; x >= 0; x -= .002) if (Math.abs(1 - f(x)) > .02) { settle = x; break; }
  const o = { f, settle, zeta: z, w0 }; _SPR.set(key, o); return o;
}
const springStep = (tau, spec) => tau <= 0 ? 0 : _spring(spec).f(tau);
const springSettle = spec => _spring(spec).settle;   // seconds to stay within 2% of the target
// impulse(tau, spec): the spring's answer to a knock instead of a step: 0 at the knock, a first peak of exactly 1, then
// ringing down to 0. The squash of a landing, a wobble after a hit, a bounce: scaleY = 1 - .12 * impulse(t - tLand, 'bouncy').
const _IMP = new Map();
function impulse(tau, spec = 'snappy') {
  if (tau <= 0) return 0;
  const s = typeof spec === 'string' ? SPRING[spec] : spec, m = s.mass || 1, w0 = Math.sqrt(s.stiffness / m), z = s.damping / (2 * Math.sqrt(s.stiffness * m));
  const f = z < 1 ? (x => Math.exp(-z * w0 * x) * Math.sin(w0 * Math.sqrt(1 - z * z) * x)) : Math.abs(z - 1) < 1e-4 ? (x => x * Math.exp(-w0 * x))
    : (x => { const r = Math.sqrt(z * z - 1); return Math.exp(w0 * (-z + r) * x) - Math.exp(w0 * (-z - r) * x); });
  const key = `${s.stiffness}|${s.damping}|${m}`;
  if (!_IMP.has(key)) { let peak = 0; for (let x = 0; x < 6; x += .0005) peak = Math.max(peak, f(x)); _IMP.set(key, peak || 1); }
  return f(tau) / _IMP.get(key);
}
// twos(t, n): time held on n's: a character drawn on twos (n = 2) changes pose every second frame while the camera
// moves on ones. Use it for the character's own t: pose(twos(t)).
const twos = (t, n = 2) => Math.floor(t * FPS / n + 1e-6) * n / FPS;
// follow(t, [[t0, v0], [t1, v1, spec?], ...], spec): a value whose TARGET changes at each key time and which springs
// toward each new target from wherever it is. It is the sum of one spring per change, so it stays a pure function of t,
// stays continuous (value and velocity) even when a new target arrives mid-move, and a key time is when the move STARTS.
// Values may be numbers or arrays. A key may carry its own spring as a third item (a name or a spec).
function follow(t, keys, spec = 'snappy') {
  const v0 = keys[0][1], arr = Array.isArray(v0), out = arr ? v0.slice() : [v0];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], dt = t - k[0]; if (dt <= 0) continue;
    const s = springStep(dt, k[2] || spec), a = keys[i - 1][1], b = k[1];
    if (arr) for (let j = 0; j < out.length; j++) out[j] += (b[j] - a[j]) * s; else out[0] += (b - a) * s;
  }
  return arr ? out : out[0];
}
// loopKeys(keys, L): keys for follow()/edges() in a seamless loop of length L: the previous cycle's keys come first,
// so every spring is mid-flight at t = 0 exactly as it is at t = L. The last key must return to the first key's value.
const loopKeys = (keys, L) => [...keys.map(k => [k[0] - L, ...k.slice(1)]), ...keys.slice(1)];
// edges(t, [[t0, left0, right0], [t1, left1, right1], ...], { lead, trail }): a bar whose two edges ride different
// springs, so when it moves the leading edge stretches ahead and the trailing edge catches up (a liquid tab
// indicator, a toggle knob, a progress fill). Returns [left, right].
function edges(t, keys, o = {}) {
  const lead = o.lead || 'snappy', trail = o.trail || { stiffness: 140, damping: 20, mass: 1 };
  let a = keys[0][1], b = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], dt = t - k[0]; if (dt <= 0) continue;
    const da = k[1] - keys[i - 1][1], db = k[2] - keys[i - 1][2], dir = Math.sign(da + db);
    a += da * springStep(dt, dir < 0 ? lead : dir > 0 ? trail : lead);
    b += db * springStep(dt, dir > 0 ? lead : dir < 0 ? trail : lead);
  }
  return [a, b];
}
// drag(t, t0, t1, held, rest, spec): direct manipulation. While the pointer is held (t0..t1) the value is held(t),
// computed from the pointer; after release it springs back from wherever it was to rest(t). held and rest are
// functions of t (rest may itself be a follow()); values may be arrays.
function drag(t, t0, t1, held, rest, spec = 'snappy') {
  if (t < t0) return rest(t);
  if (t <= t1) return held(t);
  const r = rest(t), h = held(t1), r1 = rest(t1), k = 1 - springStep(t - t1, spec);
  return Array.isArray(r) ? r.map((v, j) => v + (h[j] - r1[j]) * k) : r + (h - r1) * k;
}
// rubber(x, max, give): past max, a value keeps moving but resists, like a slider stretched past its end.
const rubber = (x, max, give = 60) => x <= max ? x : max + give * (1 - Math.exp(-(x - max) / give));
const rubberLo = (x, min, give = 60) => x >= min ? x : min - give * (1 - Math.exp(-(min - x) / give));

// ---------- beats ----------
// Beat n starts at tb(n) (n may be fractional); bar(n) is the start of bar n (0-based). beatAt(t) is fractional.
const tb = n => OFF + n * BEAT;
const bar = n => tb(n * METER);
const beatAt = t => (t - OFF) / BEAT;
// kick(t, t0, o): a punch that peaks a hair after t0 and decays: quarter-sine attack, exponential release. Use it
// for a beat pulse (scale 1 + .015 * kick(t, tb(n))) or a camera punch on a hit.
function kick(t, t0, o = {}) { const a = o.attack ?? 2 / 60, tau = o.tau ?? .08, d = t - t0; if (d <= 0) return 0;
  return d < a ? Math.sin(d / a * Math.PI / 2) : Math.exp(-(d - a) / tau); }
// pulse(t, k): 1 exactly on every beat, decaying after it.
const pulse = (t, k = 6) => Math.exp(-frac(beatAt(t)) * k);

// ---------- shots ----------
// shots([[t0, fn], [t1, fn], ...]) registers shots in time order. fn(t, lt, dur) draws the WHOLE frame for video time
// t (lt = time since the shot started). A film that is one continuous take is a single shot.
const SHOTS = [];
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }
function shotIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++; return i; }
// The shot span holding t, [start, end). render.mjs keeps motion-blur sub-frames inside it, so cuts stay crisp.
function shotSpan(t) { if (!SHOTS.length) return [0, DUR]; const i = shotIndex(t); return [SHOTS[i][0], i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR]; }
// Standalone loops (specimens, model sheets, GIFs): LOOPS.name = t => {...}; LOOPS.name.len = 4. ?loop=name or
// render.mjs --loop=name renders it instead of the film.
const LOOPS = {};

// ---------- sound cues ----------
// cue(t, kind, o) declares a sound at a picture event, at load time (top level of a scene file, never inside a draw
// function). Compute t from the same numbers the animation uses (a key time, a spring's settle, a beat), never by
// hand. render.mjs --events writes them to out/cues.json for the video-sound skill. kind is one of video-sound's
// kinds; o: { weight 0-2, pan -1..1, pitch (semitones), dur, id, file }. Where t sits, by kind (video-sound places the
// sound so this holds): ONSET on t, the transient starts there: tick, tock, click, key, pop (t = the 50% frame of the
// appearance), snap, land, hit, thump (t = the contact frame), drop, bell, chime, glitch. APEX on t, loudest at the
// motion's velocity peak: whoosh (onset 100-450 ms earlier), swish. END on t, stops dead there: riser, swell, suck (a
// riser into a reveal ends on the reveal frame; its start is earlier, so keep it inside the film).
const CUES = [];
function cue(t, kind, o = {}) { CUES.push({ t: +t.toFixed(4), kind, weight: 1, pan: 0, ...o }); return t; }
function cues(list) { for (const [t, kind, o] of list) cue(t, kind, o); }
// the time a spring started at t0 reaches fraction p of its move: cue a pop at springAt(t0, .5), a land at .97
function springAt(t0, p = .5, spec = 'snappy') { for (let x = 0; x < 10; x += 1 / 960) if (springStep(x, spec) >= p) return t0 + x; return t0; }

// ---------- texts the checks can read ----------
// Every piece of text a viewer must read is registered with its box, so render.mjs --inspect can check it stays in
// frame, doesn't collide with other text and stays up long enough to read. draw.js's text() registers automatically;
// in DOM mode, give such elements a data-read="id" attribute.
let TEXTS = [];
// Sanctioned ways for a look to manage the registry instead of reaching into TEXTS: textsMark() before drawing
// something, then textsDrop(mark, keep) to withdraw what was registered since, unless keep(entry) says otherwise (text
// a later layer covers, text a wipe hasn't reached yet). quietly(fn) draws without registering anything.
const textsMark = () => TEXTS.length;
function textsDrop(mark, keep = () => false) { const added = TEXTS.splice(mark); TEXTS.push(...added.filter(keep)); }
function quietly(fn) { const m = TEXTS.length; try { return fn(); } finally { TEXTS.length = Math.min(TEXTS.length, m); } }
// withContext(ctx, fn): run fn with draw.js drawing into another 2D context (an ink plate, an offscreen layer), then
// restore. Text drawn there still registers, through that context's transform.
function withContext(ctx, fn) { const keep = CX; CX = ctx; try { return fn(); } finally { CX = keep; } }
// json(path): load a data file (word timings, a data set) at load time, from the page's folder. Synchronous, so call
// it at the top level of a scene, never in a draw function. Chrome needs file access (render.mjs allows it); for the
// dev scrubber, serve the folder over http.
function json(path) { const x = new XMLHttpRequest(); x.open('GET', path, false); x.overrideMimeType('application/json'); x.send(); if (x.status && x.status !== 200) throw new Error(`json(${path}): HTTP ${x.status}`); return JSON.parse(x.responseText); }
function readable(id, text, x, y, w, h, a = 1, px = null) { if (a > .02) TEXTS.push({ id: String(id), text: String(text), box: [x, y, w, h].map(v => Math.round(v)), a: +a.toFixed(3), ...(px ? { px: Math.round(px) } : {}) }); }
function domTexts() {
  const out = [];
  for (const el of document.querySelectorAll('[data-read]')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let a = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { a = 0; break; } a *= +cs.opacity; }
    if (a > .02) out.push({ id: el.dataset.read, text: el.textContent.trim(), box: [r.left, r.top, r.width, r.height].map(Math.round), a: +a.toFixed(3), px: Math.round(parseFloat(getComputedStyle(el).fontSize) * (r.height / (el.offsetHeight || r.height))) });
  }
  return out;
}
// the area text should stay inside: PROJECT.safe as a fraction of each side (default 5%), or a vertical feed's zone
function safeRect() {
  if (P.safeRect) return P.safeRect;
  const s = P.safe ?? .05; return [W * s, H * s, W * (1 - 2 * s), H * (1 - 2 * s)];
}

// ---------- cursor ----------
// cursor(t, path) -> { x, y, down, press, shown }: a pointer that drives a UI. path is a list of waypoints
// { t, x, y, click, hold, hide } meaning "be at (x, y) at time t". The glide toward each waypoint starts a little
// before it (at most .46 s, at most 82% of the gap) on a glide curve with a slight arc, so it arrives exactly on the
// cue; click: true squashes it for .16 s at t; hold: [a, b] keeps the button down from a to b (a drag: the
// waypoints inside it move while down). hide: true fades it out by t.
function cursor(t, path) {
  let i = 0; while (i + 1 < path.length && t >= path[i + 1].t) i++;
  const A = path[i], B = path[i + 1];
  let x = A.x, y = A.y;
  if (B) {
    const gap = B.t - A.t, lead = Math.min(.46, gap * .82), s = seg(t, B.t - lead, B.t);
    if (s > 0) {
      const u = EASE.glide(s), dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), bulge = Math.sin(Math.PI * u) * Math.min(70, d * .09);
      const inDrag = path.some(p => p.hold && p.hold[0] <= A.t && B.t <= p.hold[1] + 1e-6);
      const k = inDrag ? seg(t, A.t, B.t) : u;   // while dragging, the hand moves steadily, not in glides
      x = lerp(A.x, B.x, inDrag ? ease(k) : k) + (inDrag ? 0 : -dy / (d || 1) * bulge); y = lerp(A.y, B.y, inDrag ? ease(k) : k) + (inDrag ? 0 : dx / (d || 1) * bulge);
    }
  }
  let press = 0, down = false, shown = 1;
  for (const p of path) {
    if (p.click) press = Math.max(press, Math.sin(Math.PI * seg(t, p.t - .02, p.t + .14)));
    if (p.hold && t >= p.hold[0] && t <= p.hold[1]) { down = true; press = Math.max(press, .6); }
    if (p.hide) shown = Math.min(shown, 1 - seg(t, p.t - .25, p.t));
    if (p.show) shown = Math.min(shown, seg(t, p.t, p.t + .25));
  }
  return { x, y, down, press, shown };
}
// typed(t, t0, text, cps): the part of text typed by time t at cps characters a second (with a hair of human jitter,
// seeded by the text so it is the same every frame). Returns { str, done, caret } (caret blinks once typing stops).
function typed(t, t0, text, cps = 14) {
  const r = rnd(text); let at = t0, n = 0;
  for (; n < text.length; n++) { at += (1 / cps) * (.7 + .6 * r()); if (at > t) break; }
  const done = n >= text.length; return { str: text.slice(0, n), done, caret: !done || frac((t - at) * 1.6) < .5 };
}

// ---------- the frame ----------
let CX = null, OUT = null;            // the output canvas's 2D context (draw.js draws into it)
const POST = [];                      // post-passes looks register with post(fn): fn(ctx, t) after every frame
function post(fn) { POST.push(fn); }
const READY = [];                     // promises to await before the first frame (images, 3D warm-up, sim bakes)
function whenReady(p) { READY.push(p); return p; }
window.FRAME_ERRORS = [];
let T = 0;
async function drawAt(t) {
  T = t; TEXTS = [];
  CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalAlpha = 1; CX.globalCompositeOperation = 'source-over'; CX.filter = 'none';
  CX.shadowColor = 'transparent'; CX.shadowBlur = 0; CX.clearRect(0, 0, W, H);
  if (P.bg) { CX.fillStyle = P.bg; CX.fillRect(0, 0, W, H); }
  try {
    if (window.LOOP) await window.LOOP(t);
    else if (!SHOTS.length) placeholder(t);
    else { const i = shotIndex(t), [a, b] = shotSpan(t); await SHOTS[i][1](t, t - a, b - a); }
    CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalAlpha = 1; CX.filter = 'none';
    for (const f of POST) { CX.save(); await f(CX, t); CX.restore(); }
  } catch (e) {
    if (window.FRAME_ERRORS.length < 500) window.FRAME_ERRORS.push({ t, message: String(e && e.stack || e) });
    console.error(`frame error at t=${t.toFixed(3)}: ${e && e.stack || e}`);
  }
  if (MODE === 'dom') await new Promise(r => requestAnimationFrame(() => r()));
}
function placeholder(t) {
  CX.fillStyle = '#111'; CX.fillRect(0, 0, W, H); CX.fillStyle = '#eee'; CX.font = `600 ${Math.round(H / 14)}px "Space Grotesk"`;
  CX.textAlign = 'center'; CX.fillText(`motion-film  ${t.toFixed(2)} s`, W / 2, H / 2);
}
window.drawAt = drawAt;
window.shotSpan = shotSpan;
window.textsAt = async t => { await drawAt(t); return MODE === 'dom' ? [...domTexts(), ...TEXTS] : TEXTS.slice(); };
Object.defineProperty(window, 'CUES_OUT', { get: () => CUES.slice().sort((a, b) => a.t - b.t).map(c => ({ ...c, f: Math.round(c.t * FPS) })) });
window.CAPTURE = MODE;   // render.mjs screenshots the page in 'dom' mode and reads the canvas in 'canvas' mode
if (MODE === 'canvas') {
  let small = null;
  window.renderAt = async (t, type = 'image/png', q = .92, scale = 1) => {
    await drawAt(t); if (scale === 1) return OUT.toDataURL(type, q);
    const c = small || (small = document.createElement('canvas')); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(OUT, 0, 0, c.width, c.height); return c.toDataURL(type, q);
  };
  window.renderSheet = async (times, cols = 3, w = 640, crop = null) => {
    const [cx, cy, cw, ch] = crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
    sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
    for (let i = 0; i < times.length; i++) {
      const t0 = performance.now(); await drawAt(times[i]); ms.push(Math.round(performance.now() - t0));
      const x = (i % cols) * w, y = Math.floor(i / cols) * h; c.drawImage(OUT, cx, cy, cw, ch, x, y, w, h);
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
    }
    return { url: sc.toDataURL('image/jpeg', .9), ms };
  };
}
window.outCanvas = () => OUT;
window.gpuInfo = () => { try { const gl = document.createElement('canvas').getContext('webgl2'), e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return gl ? (e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'no WebGL'; } catch (e) { return 'no WebGL: ' + e; } };

async function boot() {
  OUT = document.getElementById('out'); OUT.width = W; OUT.height = H; CX = OUT.getContext('2d', { willReadFrequently: false });
  const stage = document.getElementById('stage'); stage.style.width = W + 'px'; stage.style.height = H + 'px';
  if (RENDER) document.body.classList.add('render');
  const fonts = ['600 40px "Space Grotesk"', '700 40px "IBM Plex Mono"', '900 40px "Barlow Condensed"', '400 40px "Fraunces"', ...(P.fonts || [])];
  await Promise.all(fonts.map(f => document.fonts.load(f, 'Aa0').catch(() => {})));
  // ES-module looks (.mjs in the manifest) run after parsing, before DOMContentLoaded: wait for them, so their
  // whenReady() promises (three.js scenes, shader warm-up) are in READY before it is awaited
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  await Promise.all(READY);
  const q = new URLSearchParams(location.search).get('loop'); if (q && LOOPS[q]) window.LOOP = LOOPS[q];
  window.ready = true;
  if (!RENDER) devUI();
}
function devUI() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'); s.max = window.LOOP ? window.LOOP.len : DUR; s.step = 1 / FPS;
  let busy = false, want = null;
  const go = async () => { if (busy) return; busy = true; while (want != null) { const t = want; want = null; const t0 = performance.now(); await drawAt(t); lab.textContent = `${t.toFixed(2)} s  ·  beat ${beatAt(t).toFixed(2)}  ·  ${Math.round(performance.now() - t0)} ms`; } busy = false; };
  s.addEventListener('input', () => { want = +s.value; go(); });
  want = +(new URLSearchParams(location.search).get('t') || 0); s.value = want; go();
}
