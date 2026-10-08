// looks/riso.js: print-process simulation (risograph). Two or three spot inks on cream stock, each printed from its own
// plate: grey on a plate is screened into halftone dots, every plate lands a few pixels off register and re-jitters on
// twos, inks multiply where they overlap (pink over blue makes purple), and the ink is speckled and uneven like a real
// drum print. Card: looks/riso.md. Specimen: specimens/riso.
//
// Two ways in:
//   1. Plates. RISO.print(t, draw) builds the frame. Inside draw, plain draw.js calls paint the PAPER (bg(), box()...),
//      and RISO.on('pink', () => {...}) paints onto the pink plate: every draw.js helper (text, rr, box, line, words)
//      works there, because CX is pointed at the plate. On a plate only darkness counts: black prints solid ink, grey
//      prints a halftone tint (RISO.tone(k) is the grey for tint k), white or transparent prints nothing.
//   2. Post pass. RISO.ify(canvas, t) separates any finished RGB frame into the inks and prints it the same way;
//      RISO.post() registers that as a post-pass (kit.js post()), so any look can be riso-ified. Not registered at load.
//
// The compositor is a WebGL2 shader (screens, grain, offsets, multiply); without WebGL (or with P.riso.flat) it falls
// back to flat multiply with offsets (no screens). Everything is a pure function of t: the jitter and grain seeds come
// from the print index (the frame number divided by S.on), never from history.

const RISO = (() => {
  const U = Math.min(W, H) / 1080;   // sizes below are at 1080p and scale with the frame
  // Riso ink colours (approximations of the published ink swatches)
  const INKS = { pink: '#FF48B0', blue: '#0078BF', yellow: '#FFE800', black: '#000000', federal: '#3D5588', teal: '#00838A',
    red: '#FF665E', orange: '#FF6C2F', green: '#00A95C', purple: '#765BA7', aqua: '#5EC8E5', sunflower: '#FFB511', mint: '#82D8D5' };
  const S = Object.assign({
    paper: '#F3EEE3',                  // the stock
    inks: ['yellow', 'pink', 'blue'],  // the plates, in print order (lightest first, as the drums run)
    key: 'blue',                       // the darkest ink: type, outlines, window borders
    colors: {},                        // { pink: '#...' } to override an ink's colour
    misreg: { yellow: [-3, 2.5], pink: [3.5, -2], blue: [0, 0], black: [0, 0] },   // standing offset per plate, px
    jitter: 1.6,                       // px each plate wanders, re-drawn every print
    rot: .03,                          // degrees each plate may twist about the frame centre, per print
    on: 2,                             // frames per print: 2 = on twos (jitter and grain step 15 times a second at 30 fps)
    pitch: 10,                         // halftone cell, px
    angles: { yellow: 5, pink: 75, blue: 15, black: 45 },   // screen angles in degrees (others get 30)
    grain: .45,                        // white specks where the drum starved
    fine: .14,                         // fine per-pixel density noise
    mottle: .2,                        // slow unevenness of the ink layer
    rough: .9,                         // px of edge wobble
    fibre: 1,                          // paper texture strength
    opacity: {},                       // { yellow: .9 } per-ink strength
    flat: false,                       // true forces the flat fallback (what a machine without WebGL2 gets)
  }, P.riso || {});
  const col = n => S.colors[n] || INKS[n] || n;
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const deg = d => d * Math.PI / 180;

  // ---------- tones ----------
  // tone(k): the grey that prints tint k (0..1) on a plate. Darker than about 93% prints solid; lighter than 3% prints nothing.
  const tone = k => { const g = Math.round(255 * clamp(.97 - .9 * clamp(k))); return `rgb(${g},${g},${g})`; };
  const SOLID = '#000';
  // print index: the print a frame belongs to. Jitter and grain are seeded from it, so they step on twos (or S.on). In a
  // loop (PROJECT.loop) it wraps at the film's length, so the frame at DUR prints exactly like frame 0.
  const printAt = t => { if (P.loop && DUR) t = ((t % DUR) + DUR) % DUR; return Math.floor(Math.round(t * FPS * 1000) / 1000 / S.on + 1e-6); };
  // a time held on the print grid: draw hand-animated things at held(t) so they move on twos too
  const held = t => printAt(t) * S.on / FPS;

  // ---------- plates ----------
  const L = new Map(); let base = null; const CLIPS = [];
  // registration gate: during a sweep(), text that is only partly printed must not count for the checks. GATE(ink, box)
  // says whether a box is wholly on the printed side of that plate's edge; gateTexts drops the entries kit's registry
  // (TEXTS) gained since n0 that fail it. on() gates by its own plate; text on the paper is gated by the first plate.
  let GATE = null; const SEEN = new WeakSet();
  function gateTexts(n0, name) { if (!GATE) return;
    for (let i = TEXTS.length - 1; i >= n0; i--) { const e = TEXTS[i]; if (SEEN.has(e)) continue; SEEN.add(e); if (!GATE(name, e.box)) TEXTS.splice(i, 1); } }
  function layer(name) {
    if (!L.has(name)) { const c = document.createElement('canvas'); c.width = W; c.height = H; L.set(name, { c, x: c.getContext('2d') }); }
    return L.get(name);
  }
  function baseLayer() { if (!base) { const c = document.createElement('canvas'); c.width = W; c.height = H; base = { c, x: c.getContext('2d') }; } return base; }
  // on(ink, fn): draw onto that ink's plate. CX points at the plate inside fn, with the caller's transform and alpha.
  function on(name, fn) {
    if (!S.inks.includes(name)) return;           // a film written for three inks still runs with two
    const pl = layer(name).x, prev = CX, M = prev.getTransform(), a = prev.globalAlpha, n0 = TEXTS.length;
    pl.save(); pl.setTransform(1, 0, 0, 1, 0, 0); for (const c of CLIPS) c(name, pl);
    pl.setTransform(M); pl.globalAlpha = a; pl.globalCompositeOperation = 'source-over';
    CX = pl; try { fn(name); } finally { CX = prev; pl.restore(); gateTexts(n0, name); }
  }
  const each = (fn, inks = S.inks) => inks.forEach((n, i) => on(n, () => fn(n, i)));
  // knock(fn): whatever fn draws is erased from the current plate (paper shows through)
  function knock(fn) { CX.save(); CX.globalCompositeOperation = 'destination-out'; CX.fillStyle = CX.strokeStyle = '#000'; fn(); CX.restore(); }
  // tint(k, fn): fill and stroke at tint k; tints combine by keeping the darker (a 40% over a solid stays solid)
  function tint(k, fn) { CX.save(); CX.globalCompositeOperation = 'darken'; CX.fillStyle = CX.strokeStyle = tone(k); fn(); CX.restore(); }

  // ---------- the frame ----------
  // print(t, draw, o): the whole frame. draw(t) paints the paper with plain draw.js calls and the plates through on().
  // o: { paper (stock colour), shake: [dx, dy] (moves the whole sheet, e.g. on a stamp), jitter, misreg (overrides) }
  function print(t, draw, o = {}) {
    const main = CX, B = baseLayer();
    B.x.setTransform(1, 0, 0, 1, 0, 0); B.x.globalAlpha = 1; B.x.globalCompositeOperation = 'source-over'; B.x.filter = 'none';
    B.x.fillStyle = o.paper || S.paper; B.x.fillRect(0, 0, W, H);
    for (const n of S.inks) { const p = layer(n).x; p.setTransform(1, 0, 0, 1, 0, 0); p.globalAlpha = 1; p.globalCompositeOperation = 'source-over'; p.filter = 'none'; p.clearRect(0, 0, W, H); }
    CX = B.x; B.x.save();
    try { draw(t); } finally { B.x.restore(); CX = main; }
    composite(t, S.inks.map(n => layer(n).c), B.c, o);
  }
  // per-plate offsets for print f: the standing misregistration plus a jitter drawn fresh for every print
  function offsets(t, inks, o = {}) {
    const f = printAt(t), j = o.jitter ?? S.jitter, mr = Object.assign({}, S.misreg, o.misreg || {}), sh = o.shake || [0, 0];
    return inks.map((n, i) => { const m = mr[n] || [0, 0];
      return { dx: (m[0] + (hash(f * 7.13 + i * 31.7) - .5) * 2 * j) * U + sh[0], dy: (m[1] + (hash(f * 3.71 + i * 17.3 + 5) - .5) * 2 * j) * U + sh[1],
        rot: deg((hash(f * 1.93 + i * 9.1 + 11) - .5) * 2 * (o.rot ?? S.rot)) }; });
  }

  // ---------- the GPU compositor ----------
  let gl = null, glc = null, glFail = false, PROG = {}, TEX = [], VAO = null;
  const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`;
  const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uU, uPitch, uSeed, uGrain, uFine, uMottle, uRough, uFibre; uniform int uN;
uniform vec3 uInk[4]; uniform vec2 uOff[4]; uniform float uRot[4], uAng[4], uOpa[4];
out vec4 outColor;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
// plate coordinates of frame pixel px for ink k: rotated about the centre, then shifted off register
vec2 plateXY(int k, vec2 px) { vec2 c = uRes * .5, d = px - c; float s = sin(uRot[k]), co = cos(uRot[k]);
  return c + vec2(co * d.x - s * d.y, s * d.x + co * d.y) - uOff[k]; }
// AM halftone: round dots on a grid at angle a, pitch uPitch; returns coverage for tone (0..1)
float screen(vec2 q, float a, float tone) {
  if (tone < .004) return 0.;
  float c = cos(a), s = sin(a); vec2 g = vec2(c * q.x + s * q.y, -s * q.x + c * q.y) / uPitch;
  float d = length(fract(g) - .5), t2 = tone * (1. - .36 * (1. - tone)), R = .7072 * sqrt(t2), aa = .8 / uPitch;
  return mix(1. - smoothstep(R - aa, R + aa, d), 1., smoothstep(.9, 1., tone));
}
// the ink film: specks where the drum starved, fine density noise, slow mottling; reseeded every print
float film(int k, vec2 q) {
  float fk = float(k) * 7.31, sp = vn(q * .55 / uU + vec2(uSeed * 13.17 + fk, fk * 3.1));
  float m = vn(q / (70. * uU) + vec2(fk * 3.7, uSeed * .37)) * .65 + vn(q / (19. * uU) + vec2(uSeed * 1.31, fk)) * .35;
  return (1. - uGrain * smoothstep(.72, .88, sp)) * (1. - uFine * h21(floor(q) + uSeed * 1.7 + fk)) * (1. - uMottle * m);
}
vec2 wobble(int k, vec2 q) { float fk = float(k) * 19.3;
  return vec2(vn(q * .3 / uU + vec2(fk, uSeed * 2.1)), vn(q * .3 / uU + vec2(uSeed * 1.3, fk + 5.))) - .5; }
vec3 paperTex(vec3 c, vec2 px) {
  float fib = vn(px * vec2(.6, .08) / uU) * .55 + vn(px * .025 / uU + 3.1) * .45;
  return c * (1. - uFibre * (.045 * fib + .025 * h21(floor(px))));
}
`;
  const FS_PLATES = COMMON + `
uniform sampler2D uBase, uT0, uT1, uT2, uT3;
vec4 tap(int k, vec2 q) { vec2 uv = q / uRes; if (k == 0) return texture(uT0, uv); if (k == 1) return texture(uT1, uv); if (k == 2) return texture(uT2, uv); return texture(uT3, uv); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c = paperTex(texture(uBase, px / uRes).rgb, px);
  for (int k = 0; k < 4; k++) { if (k >= uN) break;
    vec2 q = plateXY(k, px); vec4 s = tap(k, q + wobble(k, q) * uRough * 2.);
    if (s.a < .002) continue;
    float tn = clamp((1. - dot(s.rgb, vec3(.299, .587, .114)) / s.a - .03) / .9, 0., 1.);   // premultiplied: divide by alpha
    float ink = s.a * screen(q, uAng[k], tn) * film(k, q);
    c *= mix(vec3(1.), uInk[k], clamp(ink * uOpa[k], 0., 1.));
  }
  outColor = vec4(c, 1.);
}`;
  // separation: optical density of the source relative to its white, explained as a sum of the inks' densities, solved
  // per pixel by projected coordinate descent (so the answer stays inside 0..1 for every ink)
  const FS_SEP = COMMON + `
uniform sampler2D uSrc; uniform vec3 uWhite, uPaper; uniform vec3 uAbs[4]; uniform float uGain, uMinTone;
float sep(int k, vec2 q) {
  vec3 b = max(-log(max(texture(uSrc, q / uRes).rgb / uWhite, vec3(.02))), 0.) * uGain;
  float d[4] = float[4](0., 0., 0., 0.);
  for (int it = 0; it < 12; it++) for (int i = 0; i < 4; i++) { if (i >= uN) break;
    vec3 r = b; for (int j = 0; j < 4; j++) { if (j >= uN) break; r -= d[j] * uAbs[j]; }
    d[i] = clamp(d[i] + dot(uAbs[i], r) / max(dot(uAbs[i], uAbs[i]), 1e-4), 0., 1.); }
  return d[k];
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c = paperTex(uPaper, px);
  for (int k = 0; k < 4; k++) { if (k >= uN) break;
    vec2 q = plateXY(k, px); float tn = sep(k, q + wobble(k, q) * uRough * 2.);
    tn = tn < uMinTone ? 0. : tn;   // light greys (hairlines, faint borders) print nothing instead of scattering into sparse dots
    float ink = screen(q, uAng[k], tn) * film(k, q);
    c *= mix(vec3(1.), uInk[k], clamp(ink * uOpa[k], 0., 1.));
  }
  outColor = vec4(c, 1.);
}`;
  function glInit() {
    if (gl || glFail) return gl;
    if (S.flat) { glFail = true; console.warn('riso: P.riso.flat is set; printing flat (no halftone screens)'); return null; }
    glc = document.createElement('canvas'); glc.width = W; glc.height = H;
    gl = glc.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false });
    if (!gl) { glFail = true; console.warn('riso: no WebGL2; printing flat (no halftone screens)'); return null; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('riso shader: ' + gl.getShaderInfoLog(s)); return s; };
    const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('riso program: ' + gl.getProgramInfoLog(p)); const u = {}; p.u = n => u[n] ?? (u[n] = gl.getUniformLocation(p, n)); return p; };
    PROG.plates = prog(FS_PLATES); PROG.sep = prog(FS_SEP);
    VAO = gl.createVertexArray(); gl.bindVertexArray(VAO); const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < 5; i++) { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); TEX.push(tx); }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);   // premultiplied, so filtering at a shape's edge doesn't darken it
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);             // rows stay top-down; the shaders flip gl_FragCoord.y themselves
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    return gl;
  }
  const upload = (unit, src) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, TEX[unit]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };
  function common(p, t, inks, o) {
    const off = offsets(t, inks, o), n = Math.min(4, inks.length), f4 = (fn, w) => { const a = new Float32Array(4 * w); for (let i = 0; i < n; i++) a.set([].concat(fn(inks[i], i)), i * w); return a; };
    gl.uniform2f(p.u('uRes'), W, H); gl.uniform1f(p.u('uU'), U); gl.uniform1f(p.u('uPitch'), (o.pitch ?? S.pitch) * U); gl.uniform1f(p.u('uSeed'), printAt(t) % 997);
    gl.uniform1f(p.u('uGrain'), o.grain ?? S.grain); gl.uniform1f(p.u('uFine'), o.fine ?? S.fine); gl.uniform1f(p.u('uMottle'), o.mottle ?? S.mottle);
    gl.uniform1f(p.u('uRough'), (o.rough ?? S.rough) * U); gl.uniform1f(p.u('uFibre'), o.fibre ?? S.fibre); gl.uniform1i(p.u('uN'), n);
    gl.uniform3fv(p.u('uInk'), f4(m => rgb(col(m)), 3)); gl.uniform2fv(p.u('uOff'), f4((m, i) => [off[i].dx, off[i].dy], 2));
    gl.uniform1fv(p.u('uRot'), f4((m, i) => off[i].rot, 1)); gl.uniform1fv(p.u('uAng'), f4(m => deg(S.angles[m] ?? 30), 1)); gl.uniform1fv(p.u('uOpa'), f4(m => S.opacity[m] ?? 1, 1));
    return n;
  }
  function draw(dst) { gl.viewport(0, 0, W, H); gl.bindVertexArray(VAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0); dst.globalAlpha = 1; dst.globalCompositeOperation = 'source-over'; dst.filter = 'none'; dst.drawImage(glc, 0, 0); dst.restore(); }
  function composite(t, plates, paper, o) {
    if (glInit()) {
      const p = PROG.plates; gl.useProgram(p); upload(0, paper); gl.uniform1i(p.u('uBase'), 0);
      plates.slice(0, 4).forEach((c, i) => { upload(i + 1, c); gl.uniform1i(p.u('uT' + i), i + 1); });
      common(p, t, S.inks, o); draw(CX); return;
    }
    // fallback: each plate as grey (white = no ink), screened with its colour, multiplied on at its offset
    const off = offsets(t, S.inks, o), tmp = layer('__tmp').x;
    CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); CX.globalCompositeOperation = 'source-over'; CX.drawImage(paper, 0, 0);
    plates.forEach((c, i) => { tmp.setTransform(1, 0, 0, 1, 0, 0); tmp.globalCompositeOperation = 'source-over'; tmp.fillStyle = '#fff'; tmp.fillRect(0, 0, W, H); tmp.drawImage(c, 0, 0);
      tmp.globalCompositeOperation = 'screen'; tmp.fillStyle = col(S.inks[i]); tmp.fillRect(0, 0, W, H);
      CX.globalCompositeOperation = 'multiply'; CX.drawImage(tmp.canvas, off[i].dx, off[i].dy); });
    CX.restore();
  }

  // ---------- the post pass ----------
  // ify(src, t, o): separate an RGB frame (a canvas) into the inks and print it into CX. o: { inks (default S.inks),
  // white: the source's paper colour, mapped to no ink (default PROJECT.bg or white), paper: the stock, gain: ink
  // strength (1), minTone: tints below it print nothing (0; .15 keeps light-grey hairlines from scattering into
  // sparse dots), pitch, grain, jitter, misreg }. Without WebGL2 (or with P.riso.flat) it leaves the frame as it is,
  // with one console warning: the separation needs the shader.
  let ifyWarned = false;
  function ify(src, t, o = {}) {
    if (!glInit()) { if (!ifyWarned) { ifyWarned = true; console.warn('riso: no WebGL2; RISO.ify/post leave the frame unprinted'); } return; }
    const inks = o.inks || S.inks, p = PROG.sep; gl.useProgram(p); upload(0, src); gl.uniform1i(p.u('uSrc'), 0);
    const n = common(p, t, inks, o);
    gl.uniform3fv(p.u('uWhite'), rgb(o.white || P.bg || '#FFFFFF')); gl.uniform3fv(p.u('uPaper'), rgb(o.paper || S.paper)); gl.uniform1f(p.u('uGain'), o.gain ?? 1);
    gl.uniform1f(p.u('uMinTone'), o.minTone ?? 0);
    const ab = new Float32Array(12); for (let i = 0; i < n; i++) ab.set(rgb(col(inks[i])).map(v => -Math.log(Math.max(v, .02))), i * 3); gl.uniform3fv(p.u('uAbs'), ab);
    draw(CX);
  }
  // post(o): riso-ify every frame after it is drawn (call once, at load, from a scene: RISO.post({ inks: [...] }))
  function postPass(o = {}) { const f = (c, t) => ify(OUT, t, o); post(f); return f; }

  // ---------- drawing helpers (draw onto the current plate inside on(), in frame pixels) ----------
  const F = (o = {}) => ({ family: o.family || 'Barlow Condensed', weight: o.weight || 900, size: (o.size ?? 120) * U, tracking: o.tracking || 0, italic: o.italic });
  // type(id, str, x, y, o): one line of type. o: { ink (default S.key), inks: ['pink', 'yellow'] to overprint several
  // plates, tones: [1, .5] per ink, tone (all), shadow: { ink, dx, dy, tone, knock } (an offset copy on another plate;
  // knock: true erases the letters from it, so they keep their own ink), knock: true (erase it from the plate instead), outline: lw (an open outline lw px wide instead of a fill: a word waiting
  // for its ink), align, family, weight, size (at 1080p), tracking }. Registered for the checks once (on the first
  // ink), not per plate; during a sweep() only while it is wholly printed on that plate.
  function type(id, str, x, y, o = {}) {
    const f = F(o), inks = o.inks || [o.ink || S.key], tones = o.tones || inks.map(() => o.tone ?? 1);
    const opt = { ...f, align: o.align, base: o.base };
    if (o.shadow) on(o.shadow.ink || 'pink', () => {
      tint(o.shadow.tone ?? 1, () => text(null, str, x + (o.shadow.dx ?? 8) * U, y + (o.shadow.dy ?? 8) * U, { ...opt, color: tone(o.shadow.tone ?? 1) }));
      if (o.shadow.knock) knock(() => text(null, str, x, y, { ...opt, color: '#000' }));   // the letters keep their own ink
    });
    let m = null;
    const put = (reg, k) => {
      m = text(reg, str, x, y, { ...opt, color: o.outline ? 'rgba(0,0,0,0)' : tone(k) });   // an outline registers the box, then strokes
      if (!o.outline) return;
      CX.save(); CX.font = font(f.size, f); CX.textAlign = 'left'; CX.textBaseline = o.base || 'alphabetic';
      if ('letterSpacing' in CX) CX.letterSpacing = f.tracking + 'px';
      CX.lineJoin = 'round'; CX.lineWidth = o.outline * U; CX.strokeStyle = tone(k); CX.strokeText(str, m.x0, y); CX.restore();
    };
    inks.forEach((n, i) => on(n, () => {
      const reg = i === 0 ? id : null;
      if (o.knock) knock(() => { m = text(reg, str, x, y, { ...opt, color: '#000' }); });
      else tint(tones[i], () => put(reg, tones[i]));
    }));
    return m || { w: measure(str, f), h: f.size, x0: x, size: f.size };
  }
  // blob(x, y, r, k, o): a halftone blob, tint k at the centre fading to nothing at r (the dots shrink to points).
  // o.ry squashes it; o.power shapes the falloff (1 linear, 2 softer centre)
  function blob(x, y, r, k = .8, o = {}) {
    CX.save(); CX.globalCompositeOperation = 'darken'; CX.translate(x, y); CX.scale(1, (o.ry ?? r) / r);
    const g = CX.createRadialGradient(0, 0, 0, 0, 0, r), pw = o.power ?? 1.6;
    for (let i = 0; i <= 8; i++) { const s = i / 8; g.addColorStop(s, tone(k * Math.pow(1 - s, pw))); }
    CX.fillStyle = g; CX.beginPath(); CX.arc(0, 0, r, 0, TAU); CX.fill(); CX.restore();
  }
  // hatch(rect, gap, angle, lw, clip): engraving-style parallel lines over rect [x, y, w, h], clipped by clip() (a path)
  function hatch(rect, gap = 9, angle = 45, lw = 2.2, clip = null) {
    const [x, y, w, h] = rect, a = deg(angle), d = Math.hypot(w, h), cx = x + w / 2, cy = y + h / 2;
    CX.save(); if (clip) { CX.beginPath(); clip(); CX.clip(); } else { CX.beginPath(); CX.rect(x, y, w, h); CX.clip(); }
    CX.translate(cx, cy); CX.rotate(a); CX.beginPath(); for (let s = -d / 2; s <= d / 2; s += gap * U) { CX.moveTo(-d / 2, s); CX.lineTo(d / 2, s); }
    CX.lineWidth = lw * U; CX.stroke(); CX.restore();
  }
  // stipple(rect, n, r, seed, clip): n seeded dots of radius about r inside rect (coffee grounds, sand, texture)
  function stipple(rect, n, r = 3, seed = 1, clip = null) {
    const [x, y, w, h] = rect, R = rnd(seed); CX.save(); if (clip) { CX.beginPath(); clip(); CX.clip(); }
    CX.beginPath(); for (let i = 0; i < n; i++) { const px = x + R() * w, py = y + R() * h, rr_ = r * U * (.6 + .8 * R()); CX.moveTo(px + rr_, py); CX.arc(px, py, rr_, 0, TAU); }
    CX.fill(); CX.restore();
  }
  // distress(rect, amount, seed): rubber-stamp wear: specks and a lighter side erased from the current plate
  let _wear = null;
  function wearTile() { if (_wear) return _wear; const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), R = rnd(777); x.fillStyle = '#000';
    for (let i = 0; i < 2600; i++) { const r = Math.pow(R(), 3) * 7 + .6; x.beginPath(); x.ellipse(R() * 512, R() * 512, r, r * (.4 + R() * .8), R() * TAU, 0, TAU); x.fill(); }
    for (let i = 0; i < 70; i++) { x.globalAlpha = .35 + R() * .4; x.lineWidth = 1 + R() * 2; x.beginPath(); const px = R() * 512, py = R() * 512, a = R() * TAU, l = 10 + R() * 40; x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.strokeStyle = '#000'; x.stroke(); }
    return _wear = c; }
  function distress(rect, amount = .5, seed = 1) {
    const [x, y, w, h] = rect; CX.save(); CX.globalCompositeOperation = 'destination-out'; CX.beginPath(); CX.rect(x, y, w, h); CX.clip();
    const pat = CX.createPattern(wearTile(), 'repeat'); pat.setTransform(new DOMMatrix().translate(hash(seed) * 512, hash(seed + 3) * 512).scale(U));
    CX.globalAlpha = clamp(amount * 1.4); CX.fillStyle = pat; CX.fillRect(x, y, w, h);
    const g = CX.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, `rgba(0,0,0,${.45 * amount})`); g.addColorStop(.55, 'rgba(0,0,0,0)'); CX.globalAlpha = 1; CX.fillStyle = g; CX.fillRect(x, y, w, h);
    CX.restore();
  }
  // arrow(pts, p, o): a polyline drawn on up to fraction p with an arrowhead at its tip (o: lw, head, dash)
  function arrow(pts, p = 1, o = {}) {
    const lw = (o.lw ?? 5) * U, tip = lineTo(pts, p, CX.strokeStyle || '#000', lw, { dash: o.dash, cap: 'round' }); if (!tip || p <= .02) return;
    let i = 1; const want = clamp(p); const Ls = [0]; for (let k = 1; k < pts.length; k++) Ls.push(Ls[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    while (i < pts.length - 1 && Ls[i] < Ls[Ls.length - 1] * want) i++;
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), hd = (o.head ?? 22) * U;
    CX.save(); CX.translate(tip[0], tip[1]); CX.rotate(a); CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(-hd, -hd * .55); CX.lineTo(-hd * .8, 0); CX.lineTo(-hd, hd * .55); CX.closePath(); CX.fill(); CX.restore();
  }

  // ---------- composed pieces (they place themselves on the right plates) ----------
  // win(x, y, w, h, o): a printed panel: key-ink border and a caption bar, a hard offset shadow block in another ink,
  // and an opaque paper interior (everything beneath is knocked out of every plate). Returns the inner rect.
  // o: { title, id, ink, shadow (ink name, or false), lw, bar, offset, titleSize, buttons (0: n squares knocked out
  // of the bar's right end, only for a film about software, where a window means something) }
  function win(x, y, w, h, o = {}) {
    const key = o.ink || S.key, lw = (o.lw ?? 6) * U, bar = (o.bar ?? 60) * U, off = (o.offset ?? 16) * U;
    const sh = o.shadow === false ? null : o.shadow || S.inks.find(n => n !== key && n !== 'yellow') || null;
    each(n => { if (n === sh && off) { CX.fillStyle = SOLID; CX.fillRect(x + off, y + off, w, h); } knock(() => CX.fillRect(x, y, w, h)); });
    on(key, () => {
      CX.fillStyle = SOLID; CX.fillRect(x, y, w, lw); CX.fillRect(x, y + h - lw, w, lw); CX.fillRect(x, y, lw, h); CX.fillRect(x + w - lw, y, lw, h); CX.fillRect(x, y, w, bar);
      if (o.title) knock(() => text(o.id ?? 'window', o.title, x + 22 * U, y + bar / 2 + (o.titleSize ?? 30) * U * .36, { family: 'IBM Plex Mono', weight: 700, size: (o.titleSize ?? 30) * U, color: '#000' }));
      const s = bar * .34; for (let i = 0; i < (o.buttons || 0); i++) knock(() => CX.fillRect(x + w - 22 * U - s - i * (s + 12 * U), y + (bar - s) / 2, s, s));
    });
    return { x: x + lw, y: y + bar, w: w - 2 * lw, h: h - bar - lw };
  }
  // slam(t, t0, o): a stamp's motion. It falls (big and faint) for o.pre s, lands in full ink at t0 with a small squash.
  // Returns null before it starts, else { scale, tone, landed }.
  function slam(t, t0, o = {}) {
    const pre = o.pre ?? .14; if (t < t0 - pre) return null;
    if (t < t0) { const k = easeIn(seg(t, t0 - pre, t0)); return { scale: lerp(o.from ?? 1.5, 1, k), tone: lerp(.12, .45, k), landed: false }; }
    const d = t - t0; return { scale: 1 - .03 * Math.exp(-d * 16) * Math.cos(d * 38), tone: 1, landed: true };
  }
  // stamp(id, str, x, y, t, t0, o): a rubber stamp centred at (x, y) that slams down at t0: a rounded border and the
  // word, rotated, worn. o: { ink (default pink), size, rot (deg), wear, seed, pad, lw, family }
  function stamp(id, str, x, y, t, t0, o = {}) {
    const s = slam(t, t0, o); if (!s) return null;
    const f = F({ size: o.size ?? 110, family: o.family, weight: o.weight, tracking: o.tracking ?? 4 }), tw = measure(str, f), pad = (o.pad ?? 26) * U, lw = (o.lw ?? 9) * U;
    const w = tw + pad * 2 + lw * 2, h = f.size * .86 + pad * 1.4 + lw * 2;
    on(o.ink || 'pink', () => {
      CX.translate(x, y); CX.rotate(deg(o.rot ?? -7)); CX.scale(s.scale, s.scale);
      tint(s.tone, () => { rr(-w / 2 + lw / 2, -h / 2 + lw / 2, w - lw, h - lw, 16 * U); CX.lineWidth = lw; CX.stroke();
        text(s.landed ? id : null, str, 0, f.size * .3, { ...f, align: 'center', color: tone(s.tone) }); });
      distress([-w / 2 - 4, -h / 2 - 4, w + 8, h + 8], o.wear ?? .45, o.seed ?? 3);
    });
    return { w, h, landed: s.landed };
  }
  // reg(x, y, r): a registration mark printed on every plate, so its colour fringes show the misregistration
  function reg(x, y, r = 26, o = {}) {
    each(() => { CX.save(); CX.strokeStyle = SOLID; CX.lineWidth = (o.lw ?? 2.5) * U; const R = r * U;
      CX.beginPath(); CX.arc(x, y, R * .62, 0, TAU); CX.moveTo(x - R, y); CX.lineTo(x + R, y); CX.moveTo(x, y - R); CX.lineTo(x, y + R); CX.stroke(); CX.restore(); }, o.inks);
  }
  // printIn(t, t0, dur): tint 0 -> 1, the way a shape prints in here (its dots grow until they merge into solid ink)
  const printIn = (t, t0, dur = .45) => easeOut(seg(t, t0, t0 + dur));

  // ---------- transitions ----------
  // sweep(t, t0, dur, drawA, drawB, o): a print pass. A slanted edge travels across the sheet; behind it page B has
  // been printed, ahead of it page A is still there, and each plate's edge trails the one before by o.stagger px, so
  // the inks land one after another (lightest first). drawA and drawB draw whole pages (paper and plates).
  // o: { stagger (px, 90), slant (deg, 10), ease (PASS: near-linear, so the bands keep their spacing), dir (1
  // left-to-right, -1 right-to-left), from / to (where the leading edge starts and ends, in px from the side it starts
  // on: trim them to the content, so the first band reaches ink at t0 and no time is spent crossing bare paper; the
  // defaults cross the whole sheet) }.
  // Text is registered while it is wholly printed: page A's until its plate's edge reaches it, page B's once its
  // plate's edge has passed it. This covers draw.js text() calls on the plates and on the paper too.
  const PASS = bezier(.15, 0, .85, 1);
  function sweep(t, t0, dur, drawA, drawB, o = {}) {
    const p = (o.ease || PASS)(seg(t, t0, t0 + dur)); if (p <= 0) return drawA(t); if (p >= 1) return drawB(t);
    const n = S.inks.length, st = (o.stagger ?? 90) * U, sl = Math.tan(deg(o.slant ?? 10)) * H / 2, dir = o.dir ?? 1;
    const lead = lerp(o.from ?? -sl - 10, o.to ?? W + sl + 10 + st * (n - 1), p), xe = name => lead - Math.max(0, S.inks.indexOf(name)) * st;
    const side = (ctx, x, behind) => { const X = dir > 0 ? x : W - x, e = behind === (dir > 0) ? -10 : W + 10;
      ctx.beginPath(); ctx.moveTo(e, -10); ctx.lineTo(X + sl * dir, -10); ctx.lineTo(X - sl * dir, H + 10); ctx.lineTo(e, H + 10); ctx.closePath(); ctx.clip(); };
    // the edge at x as a frame x at height y; page B lies left of it for dir 1, right of it for dir -1
    const edgeAt = (x, y) => (dir > 0 ? x : W - x) + sl * dir * (1 - 2 * (y + 10) / (H + 20));
    const wholly = (box, x, behind) => { const [bx, by, bw, bh] = box, a = edgeAt(x, by), b = edgeAt(x, by + bh);
      return behind === (dir > 0) ? bx + bw < Math.min(a, b) : bx > Math.max(a, b); };
    const gate0 = GATE;
    try {
      for (const [fn, behind] of [[drawB, true], [drawA, false]]) {
        GATE = (name, box) => wholly(box, xe(name), behind); const n0 = TEXTS.length;
        CLIPS.push((name, ctx) => side(ctx, xe(name), behind));
        const M = CX.getTransform(); CX.save(); CX.setTransform(1, 0, 0, 1, 0, 0); side(CX, xe(S.inks[0]), behind); CX.setTransform(M);
        try { fn(t); } finally { CX.restore(); CLIPS.pop(); gateTexts(n0, S.inks[0]); }
      }
    } finally { GATE = gate0; }
  }

  return { S, INKS, U, col, tone, SOLID, printAt, held, on, each, knock, tint, print, offsets, ify, post: postPass,
    type, blob, hatch, stipple, distress, arrow, win, slam, stamp, reg, printIn, sweep, PASS, gl: () => glInit() };
})();
