// looks/toon3d.js: "a toy world at the end of the day". The classic-script half of the toon3d look: the namespace, the
// palette, the ready gate, the timing helpers (poses on twos, hops, the camera rig) and the 2D overlays drawn over the
// 3D (speech bubbles, captions). The three.js half (renderer, toon materials, ink outlines, light, sky, clouds, the
// mascot, props and the camera stack) is looks/toon3d.mjs, which loads after every classic script.
// Card: looks/toon3d.md. Specimen: specimens/toon3d.
//
// Load order matters. film.html runs classic scripts first and ES modules after parsing, so a classic scene file
// cannot touch three.js at its top level. It registers a builder instead:
//   TOON.build(K => { ...make the set with K's factories...; return t => { ...set every object from t... }; });
// toon3d.mjs runs the builders once three.js has loaded, renders one warm-up frame and only then opens the gate that
// kit.js waits on (whenReady), so frame 0 never renders an empty scene. A shot then calls TOON.frame(t), which runs
// every update(t), renders the composer with a fixed delta of 0 and draws the WebGL canvas into CX; 2D overlays
// (TOON.bubble, TOON.caption, draw.js text) go on top and are registered for the checks like any other text.

const TOON = (() => {
  const S = Object.assign({
    // ink and type
    ink: '#2B1D33',            // outlines, eyes, bubble ink: a warm plum, never pure black
    paper: '#FFF7EA',          // bubble and caption cream
    font: 'Fraunces',          // one book serif for captions and dialogue
    line: 2.6,                 // ink outline width in px at 1080p (screen-constant: inverted hulls pushed in view space)
    // toon shading: the 3 bands of the gradient map (shadow side, turning, lit), NearestFilter
    bands: [.34, .7, 1],
    // the camera stack
    bloom: { threshold: .92, smoothing: .12, intensity: .55, radius: .7 },
    dof: { range: 2.6, blur: 12, sky: 1.5 },   // world units held sharp around the focus; the largest blur disc in px
                                     // at 1080p; the most blur the painted sky gets (px), so its bands and stars read
    vignette: { offset: .32, darkness: .42 },
    grain: .085,               // film grain opacity (overlay), re-seeded from the frame index
    shadowMap: 2048, shadowRadius: 3.2,
    camSpring: { stiffness: 16, damping: 8, mass: 1 },   // critically damped, settles in about 1.5 s
    msaa: 4,
    rim: .45,                  // key-side rim light on props (the mascot takes 1.1)
    moonRim: .3,               // how much of the moon's strength goes into the rim at dusk
    moonShadowMap: 1024,       // the dusk key's shadow map (the sun's is shadowMap)
    starSize: .9,              // star radius in milliradians (about 2 px at fov 28, 1080p)
  }, P.toon3d || {});

  // ---------- the ready gate (kit.js awaits it before frame 0) ----------
  let ok, fail;
  const ready = new Promise((a, b) => { ok = a; fail = b; });
  whenReady(ready);
  const builders = [];
  const build = fn => { builders.push(fn); return fn; };

  // ---------- timing ----------
  // two(t): time stepped onto twos (a new drawing every 2 frames), for characters. Camera, light and clouds use raw t,
  // so the world moves on ones while the acting holds each pose for two frames. n = 1 is ones, 3 is threes.
  const two = (t, n = 2) => Math.floor(t * FPS / n + 1e-6) * n / FPS;

  // hop(t, h): one hop h = { t, dur, from: [x, y, z], to: [x, y, z], up } as a pose: travel k (0..1), position, and a
  // squash-stretch scale sy (volume kept: sx = sz = 1 / sqrt(sy)). A crouch of h.anticip s (default .16 s or less)
  // anticipates it, it stretches at take-off and before landing, and it squashes on landing and settles in about .3 s.
  function hop(t, h) {
    const a = h.anticip ?? Math.min(.16, h.dur * .45), d = h.dur, up = h.up ?? .35;
    const at = (k, y) => ({ k, pos: [lerp(h.from[0], h.to[0], k), lerp(h.from[1], h.to[1], k) + y, lerp(h.from[2], h.to[2], k)], sy: 1 });
    if (t < h.t - a) return at(0, 0);
    if (t < h.t) { const p = at(0, 0); p.sy = 1 - .17 * Math.sin(seg(t, h.t - a, h.t) * Math.PI / 2); return p; }
    if (t < h.t + d) { const u = (t - h.t) / d, k = lerp(u, ease(u), .35), p = at(k, 4 * up * u * (1 - u)); p.sy = 1 + .13 * Math.abs(Math.cos(Math.PI * u)); return p; }
    const p = at(1, 0), dt = t - h.t - d; p.sy = 1 - .2 * Math.exp(-dt / .09) * Math.cos(dt * 18); return p;
  }
  // hops(t, list): a chain of hops; the pose of whichever hop is current (or the last one landed)
  function hops(t, list) { let i = 0; while (i + 1 < list.length && t >= list[i + 1].t - (list[i + 1].anticip ?? Math.min(.16, list[i + 1].dur * .45))) i++; return { ...hop(t, list[i]), i }; }
  // land times of a hop chain, for cue(): a 'land' on each
  const landsOf = list => list.map(h => h.t + h.dur);

  // ---------- the camera rig ----------
  // rig(t, keys): a camera that springs toward each key from its time. A key is { t, az, el, dist, at: [x, y, z], fov,
  // focus: [x, y, z] } (degrees; az 0 looks from +z, 90 from +x). Fields left out repeat the previous key, so a key can
  // change only the focus (a rack) or only the distance (a push). Orbit angles are interpolated, not positions, so moves
  // arc around the set instead of cutting through it. o.drift adds a slow seeded float (degrees) so a held frame
  // breathes. Returns { pos, at, fov, focus } for K.camera().
  const _rigs = new WeakMap();
  function fill(keys) {
    if (_rigs.has(keys)) return _rigs.get(keys);
    let prev = null; const out = keys.map(k => { const f = { ...(prev || {}), ...k }; if (!k.focus && prev) f.focus = k.at ? k.at : prev.focus; if (!f.focus) f.focus = f.at; prev = f; return f; });
    const fk = out.map(k => [k.t, [k.az, k.el, k.dist, ...k.at, k.fov, ...k.focus], k.spring]); _rigs.set(keys, fk); return fk;
  }
  function rig(t, keys, o = {}) {
    const [az0, el0, dist, ax, ay, azz, fov, fx, fy, fz] = follow(t, fill(keys), o.spring || S.camSpring);
    const dr = o.drift ?? .5, az = (az0 + dr * noise(t * .35, 11)) * Math.PI / 180, el = (el0 + dr * .6 * noise(t * .3, 12)) * Math.PI / 180;
    return { pos: [ax + Math.sin(az) * Math.cos(el) * dist, ay + Math.sin(el) * dist, azz + Math.cos(az) * Math.cos(el) * dist], at: [ax, ay, azz], fov, focus: [fx, fy, fz] };
  }

  // ---------- 2D over the 3D ----------
  // bubble(id, str, x, y, t, t0, t1, o): a speech bubble whose tail points at screen point (x, y) (the speaker's head,
  // from K.project), popping in on a soft spring at t0 and shrinking away from t1. o: side (1 right, -1 left of the
  // anchor), size (px at 1080p), lift (px above the anchor). The bubble keeps 6% clear of every frame edge.
  function bubble(id, str, x, y, t, t0, t1, o = {}) {
    if (t < t0 || t > t1 + .3) return;
    const s = H / 1080, size = (o.size || 46) * s, side = o.side ?? 1;
    const kin = springStep(t - t0, 'soft'), kout = 1 - easeIn(seg(t, t1, t1 + .22)), k = kin * kout;
    if (k <= .01) return;
    const f = { family: S.font, weight: 700, size }, tw = measure(str, f), pw = tw + size * 1.25, ph = size * 1.85, r = ph / 2;
    let bx = x + side * (o.offset ?? 40) * s - (side < 0 ? pw : 0), by = y - (o.lift ?? 150) * s - ph;
    bx = clamp(bx, W * .06, W * .94 - pw); by = clamp(by, H * .06, H * .94 - ph);
    const ox = side > 0 ? bx + Math.min(pw * .22, 40 * s) : bx + pw - Math.min(pw * .22, 40 * s), oy = by + ph;   // where the scale grows from
    CX.save(); CX.translate(ox, oy); CX.scale(k, k); CX.translate(-ox, -oy); CX.globalAlpha *= clamp(kout * 1.4);
    // tail: a soft wedge from the bubble's lower edge toward the anchor, stopping short of it
    const tx = ox, ty = oy - 2 * s, ex = lerp(tx, x, .72), ey = lerp(ty, y, .72), wv = 16 * s;
    CX.lineJoin = 'round'; CX.lineWidth = 3.2 * s; CX.strokeStyle = S.ink; CX.fillStyle = S.paper;
    CX.beginPath(); CX.moveTo(tx - wv, ty); CX.quadraticCurveTo(lerp(tx, ex, .55) - wv * .2, lerp(ty, ey, .5), ex, ey); CX.quadraticCurveTo(lerp(tx, ex, .55) + wv * .6, lerp(ty, ey, .45), tx + wv, ty); CX.closePath(); CX.fill(); CX.stroke();
    rr(bx, by, pw, ph, r); CX.fill(); CX.stroke();
    CX.beginPath(); CX.moveTo(tx - wv + 2 * s, ty - 1); CX.lineTo(tx + wv - 2 * s, ty - 1); CX.lineWidth = 5 * s; CX.strokeStyle = S.paper; CX.stroke();   // hide the seam
    text(k > .9 && kout > .99 ? id : null, str, bx + pw / 2, by + ph / 2 + size * .34, { ...f, align: 'center', color: S.ink });
    CX.restore();
  }
  // caption(id, str, x, y, t, t0, t1, o): a line of type over the sky, its words landing one by one at t0 and the line
  // easing out from t1 (Infinity to hold to the end). Cream on a soft plum shadow so it reads on gold and on dusk.
  function caption(id, str, x, y, t, t0, t1 = Infinity, o = {}) {
    if (t < t0) return;
    const a = t1 === Infinity ? 1 : 1 - EASE.exit(seg(t, t1, t1 + .4)); if (a <= .01) return;
    CX.save(); CX.shadowColor = o.shadow || 'rgba(43,29,51,.42)'; CX.shadowBlur = 22 * H / 1080; CX.shadowOffsetY = 3 * H / 1080;
    words(id, str, x, y - 10 * (1 - a) * H / 1080, t0, t, { family: S.font, weight: o.weight || 600, size: (o.size || 66) * H / 1080, color: o.color || S.paper, align: o.align || 'left', alpha: a, stagger: o.stagger ?? .07, dur: o.dur ?? .42, rise: 26 * H / 1080, blur: 10 });
    CX.restore();
  }

  // frame(t): the 3D frame for time t, drawn into CX (set by toon3d.mjs)
  const frame = t => { if (!TOON._render) throw new Error('toon3d.mjs has not loaded: is it in the manifest after looks/toon3d.js?'); return TOON._render(t); };

  return { S, ready, _ok: ok, _fail: fail, builders, build, two, hop, hops, landsOf, rig, bubble, caption, frame, K: null, _render: null };
})();
