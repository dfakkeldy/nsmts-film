// toon3d specimen: "Night shift". A floating island at golden hour, one small sprout creature on a bench. It waves the
// sun off as it sets into the cloud sea, then hop-steps across the set to the lamp, jumps for the pull-cord and lights
// the lamp: the light hands over from the sun to the lamp, and the lamp is the creature's job. 10 s, 24 fps, 4 bars at
// 96 BPM, one take. Acting on twos (TOON.two), camera, light and clouds on ones.
const b = tb, BAR = bar;
const deg = Math.PI / 180;

// ---------- the set (world units; the island top is y = 0) ----------
const SUN_AZ = -138;                                   // the sun sets beyond the island, left of the opening frame
const BENCH = { at: [-1.1, 0, -.6], ry: (SUN_AZ + 30) * deg };   // turned 30 degrees off the sun toward us: a 3/4 back view
const LAMP = { at: [2.0, 0, -1.1], h: 2.1, reach: 1.12, cordX: -.2 };   // the cord hangs from the lantern's left corner
// a local point of the bench, in world space
const onBench = (x, y, z) => { const c = Math.cos(BENCH.ry), s = Math.sin(BENCH.ry); return [BENCH.at[0] + x * c + z * s, BENCH.at[1] + y, BENCH.at[2] - x * s + z * c]; };
const SEAT = onBench(0, .44, .12), OVER = onBench(-.45, 0, -.85);   // OVER: behind the backrest, on our side
const RY_CAM = 30 * deg;
// at the lamp it faces the camera, its left hand (local +x, .4 out) right under the cord's bead
const AT_LAMP = [LAMP.at[0] + LAMP.cordX - .4 * Math.cos(RY_CAM), 0, LAMP.at[2] + .4 * Math.sin(RY_CAM)];
const via = k => [lerp(OVER[0], AT_LAMP[0], k), 0, lerp(OVER[2], AT_LAMP[2], k)];

// ---------- the acting (times on the beat grid; poses are read at TOON.two(t)) ----------
const T_WAVE = [.7, 2.2];                // waves the sun off (the arm on our side)
const T_NOTICE = b(4.2);                 // 2.6 s: the light has gone; it turns round
const HOPS = [                           // a leap back over the bench toward us, then three hop-steps across to the lamp
  { t: b(5), dur: .5, from: SEAT, to: OVER, up: .72, anticip: .2 },
  { t: b(6.1), dur: .3, from: OVER, to: via(.36), up: .22 },
  { t: b(6.7), dur: .3, from: via(.36), to: via(.7), up: .22 },
  { t: b(7.3), dur: .3, from: via(.7), to: AT_LAMP, up: .22 },
];
const T_LOOK = b(7.8);                   // at the lamp: looks up at the cord
const JUMP = { t: b(8.4), dur: .56, from: AT_LAMP, to: AT_LAMP, up: .62, anticip: .2 };   // jump for the cord
const T_GRAB = JUMP.t + JUMP.dur * .5, T_LAND = JUMP.t + JUMP.dur, T_LET = T_LAND - .04, T_ON = T_LAND + .02;
const T_HAPPY = b(9.6), T_BUBBLE = b(9.8), T_BUBBLE_OUT = b(12.8), T_PULL = b(10.6), T_END_LINE = b(12.4);
const facing = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const RY_PATH = facing(OVER, AT_LAMP);
// facing: along the bench; round toward the camera on the notice; along the path; the camera again at the lamp
const TURN = [[0, BENCH.ry], [T_NOTICE, 33 * deg], [HOPS[0].t + HOPS[0].dur + .05, RY_PATH], [HOPS[3].t + HOPS[3].dur + .05, RY_CAM]];

function face(tp) {
  if (tp >= T_HAPPY) return 'happy';
  if (tp >= T_ON + .05) return 'wow:u';
  if (tp >= JUMP.t - .2) return 'grit:u';                         // the jump: determined, eyes on the bead
  if (tp >= T_LOOK) return 'open:u';                              // looks up at the cord
  if (tp >= T_NOTICE) return tp < T_NOTICE + .6 ? 'wow' : 'open';
  if (Math.abs(tp - 1.2) < .05 || Math.abs(tp - 2.3) < .05) return 'blink';
  return 'open';
}
function creature(t) {
  const tp = TOON.two(t);
  const p = { face: face(tp), sy: 1, sit: 0, arms: [[0, 0], [0, 0]], swing: [0, 0], lean: 0 };
  if (tp < HOPS[0].t - .16) {                                     // sitting: sways, nods on the beat, waves the sun off
    p.pos = SEAT; p.ry = BENCH.ry; p.sit = 1;
    const sw = tp < T_NOTICE ? Math.sin(tp * 5.2) : 0; p.swing = [sw, -sw];
    p.sy = 1 - .03 * pulse(tp) * (tp < T_NOTICE ? 1 : 0) + (tp >= T_NOTICE ? .1 * Math.exp(-(tp - T_NOTICE) / .12) * Math.cos((tp - T_NOTICE) * 22) : 0);
    p.roll = tp < T_NOTICE ? .1 * Math.sin(TAU * tp / (4 * BEAT)) : 0;   // a contented sway, one way per two beats
    const up = EASE.inOut(seg(tp, T_WAVE[0], T_WAVE[0] + .3)) * (1 - EASE.inOut(seg(tp, T_WAVE[1] - .3, T_WAVE[1])));
    p.arms = [[.05, .25], [.05 + up * (2.2 + .32 * Math.sin((tp - T_WAVE[0]) * TAU * 2.2)), .25 * (1 - up)]];
    p.lean = .06 * up;                                            // leans into the wave
  } else if (tp < JUMP.t - .3) {                                  // the hops
    const h = TOON.hops(tp, HOPS); p.pos = h.pos; p.sy = h.sy; p.sit = h.i === 0 ? 1 - seg(tp, HOPS[0].t, HOPS[0].t + .15) : 0;
    const air = h.k > 0 && h.k < 1; p.arms = air ? [[.7, 0], [.7, 0]] : [[.12, 0], [.12, 0]];
    p.lean = air ? .14 : 0;
    if (tp >= T_LOOK) p.lean = -.26 * seg(tp, T_LOOK, T_LOOK + .25);
  } else {                                                        // at the lamp: look up, jump, pull, light, delight
    const j = TOON.hop(tp, JUMP); p.pos = j.pos; p.sy = j.sy;
    const reach = seg(tp, JUMP.t - .2, JUMP.t + .08), drop = seg(tp, T_LET, T_LET + .25);
    p.arms = [[.3 * reach * (1 - drop), 0], [2.55 * reach * (1 - drop) + .15 * drop, 0]];
    p.lean = -.26 * seg(tp, T_LOOK, T_LOOK + .25) * (1 - seg(tp, T_HAPPY - .2, T_HAPPY));
    if (tp >= T_HAPPY) { const u = tp - T_HAPPY; p.sy = 1 + .1 * Math.exp(-u / .35) * Math.sin(u * 13) + .015 * Math.sin(tp * 3.1); p.arms = [[.9 * Math.exp(-u / .6) + .15, 0], [.9 * Math.exp(-u / .6) + .15, 0]]; }
  }
  p.ry = p.ry ?? follow(tp, TURN, 'snappy');
  p.sprout = .1 * Math.sin(tp * 3.3) + (p.sy - 1) * -1.2; p.sproutX = p.lean * .8;
  return p;
}
// the lamp: the bead rides the hand down from the grab to the landing, then springs back; the bulb flickers on
function lampState(t) {
  const tp = TOON.two(t);
  const pull = tp < T_GRAB ? 0 : tp < T_LET ? EASE.inOut(seg(tp, T_GRAB, T_LET)) : 1 - springStep(tp - T_LET, 'bouncy');
  const on = t < T_ON ? 0 : t < T_ON + .08 ? .7 : t < T_ON + .16 ? .15 : t < T_ON + .21 ? .85 : clamp(.85 + (t - T_ON - .21) * 1.2);
  return { on, pull };
}

// the hero's head on the continuous clock (not on twos), for the focus to track
function heroHead(t) {
  const p = t < HOPS[0].t - .2 ? SEAT : t < JUMP.t - .3 ? TOON.hops(t, HOPS).pos : TOON.hop(t, JUMP).pos;
  return [p[0], p[1] + .55, p[2]];
}
const RACK = [[0, 0], [T_LAND - .05, 0], [T_LAND + .2, 1, EASE.inOut], [T_HAPPY - .1, 1], [T_HAPPY + .2, 0, EASE.inOut]];   // 1: focus on the lantern

// ---------- the camera (on ones) ----------
const SLOW = { stiffness: 2.5, damping: 3.16, mass: 1 };   // critically damped, about 3.7 s: a push that lasts the shot
const MID = via(.55);
const CAM = [   // the focus is set from the hero each frame (below), so these keys carry framing only
  { t: -2, az: 30.5, el: 4, dist: 9.2, at: [-.5, 1.45, -1.0], fov: 28 },                                  // behind it, the sun beyond, the lamp waiting
  { t: .2, az: 34.5, el: 3.5, dist: 7.7, at: [-.6, 1.42, -1.0], spring: SLOW },                          // a slow push and arc while the sun goes
  { t: HOPS[0].t + .05, az: 56, el: 7.5, dist: 7.4, at: [MID[0], 1.3, MID[2] - .1] },                  // round to meet the crossing, 3/4 front
  { t: b(7.9), az: 26, el: -4, dist: 5.9, at: [AT_LAMP[0] + .3, 1.42, AT_LAMP[2]], fov: 30 },           // low, looking up: it and the lamp
  { t: T_PULL, az: 20, el: 8, dist: 14.5, at: [.15, .55, -.5] },                                        // pull back: one warm light in the dusk
];

// ---------- build ----------
TOON.build(K => {
  K.island({ r: 3.7, seed: 4 });
  const tree = K.tree({ at: [-2.9, 0, .9], h: 1.45, r: .78 });   // far left, so the sun has clear sky
  K.bench({ at: BENCH.at, ry: BENCH.ry });
  const lamp = K.lamp({ at: LAMP.at, h: LAMP.h, reach: LAMP.reach, cordX: LAMP.cordX });
  for (const [x, z, r] of [[-3.0, .2, .3], [-1.95, 1.7, .26], [2.75, -.4, .3], [2.35, 1.35, .24], [-.5, -2.6, .3], [1.65, -2.65, .26], [.3, -2.75, .22], [.55, 2.55, .22]]) K.bush([x, 0, z], r);
  for (const k of [.36, .7, 1]) { const [x, , z] = via(k); K.mesh(K.G.cyl(1, 1, 1, 24), '#B9A48E', { at: [x, .015, z], scale: [.2, .04, .17], line: 1 }); }   // a stone under each landing
  const R = rnd(8);
  for (let i = 0; i < 30; i++) { const a = R() * TAU, d = 1.1 + R() * 2.3, x = Math.cos(a) * d, z = Math.sin(a) * d;
    let near = false; for (let k = 0; k <= 1; k += .1) { const p = via(k); if (Math.hypot(x - p[0], z - p[2]) < .55) near = true; }
    if (near || Math.hypot(x - BENCH.at[0], z - BENCH.at[2]) < .9 || Math.hypot(x - LAMP.at[0], z - LAMP.at[2]) < .5) continue;
    K.mesh(K.G.ball(1, 12, 8), R() < .55 ? '#F4A2B4' : '#FFF0D2', { at: [x, .05, z], scale: .055 + R() * .03, line: .55, cast: false }); }
  const puffs = K.clouds({ n: 7, ring: [8, 14], y: [-7.5, -5], size: [1.3, 2.2], seed: 5 });   // a few puffs drifting under the island
  const kid = K.mascot({ r: .4 });
  K.moonAt(100, 40);   // the dusk key: high, to the right of the camera, so the bands stay once the sun is down
  return t => {
    // the day: the sun slides down into the cloud sea; the sky, fill, moon and clouds follow
    K.sunAt(SUN_AZ, kf(t, [[0, 5.5], [1.8, 2.4], [2.6, -1.2], [4.4, -4]], ease), { target: [0, 0, 0] });
    K.daylight(kf(t, [[0, 0], [1.6, .12], [2.7, .5], [4.6, .86], [7, 1]], ease));
    K.skyDrift(t * .004); puffs.drift(t, .12);
    tree.canopy.rotation.z = .025 * noise(t * .7, 2); tree.canopy.rotation.x = .02 * noise(t * .6, 5);
    kid.pose(creature(t));
    const L = lampState(t); lamp.set(L.on, L.pull);
    const c = TOON.rig(t, CAM), r = kf(t, RACK), h = heroHead(t), bulb = lamp.bulbAt();
    c.focus = h.map((v, i) => lerp(v, bulb[i], r));   // focus rides the hero; the rack to the lantern blends over it
    K.camera(c);
  };
});

// ---------- the frame: 3D, then the type ----------
shots([[0, t => {
  TOON.frame(t);
  TOON.caption('line1', 'The sun clocks off.', W * .4, H * .125, t, .2, T_NOTICE + .5, { color: TOON.S.ink, shadow: 'rgba(255,236,214,.55)' });
  const [hx, hy] = TOON.K.project([AT_LAMP[0] - .1, 1.0, AT_LAMP[2]]);
  TOON.bubble('bubble', 'My shift.', hx, hy, t, T_BUBBLE, T_BUBBLE_OUT, { side: -1, lift: 60, offset: 50 });
  TOON.caption('line2', 'Someone has to do nights.', W * .075, H * .17, t, T_END_LINE + .15);
}]]);

// ---------- sound cues, from the same times the picture uses ----------
cue(BAR(1) - .4, 'swell', { weight: .45, dur: 2.2, id: 'sunset' });
cue(T_NOTICE, 'pop', { weight: .4, pitch: 5, id: 'notice' });
TOON.landsOf(HOPS).forEach((tl, i) => cue(tl, 'land', { weight: i ? .45 : .75, pan: lerp(-.3, .3, i / 3), id: 'hop' }));
cue(T_LET, 'click', { weight: .6, pan: .25, id: 'cord' });            // the cord at the bottom of its pull
cue(T_ON, 'thump', { weight: .5, pan: .25, id: 'lamp' });
cue(T_ON + .21, 'chime', { weight: .55, pan: .25, id: 'lamp-on' });
cue(springAt(T_BUBBLE, .5, 'soft'), 'pop', { weight: .7, id: 'bubble' });
cue(T_END_LINE, 'swell', { weight: .35, dur: 2.5, id: 'end' });
