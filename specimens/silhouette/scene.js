// silhouette specimen: "Ovens lit at four." One take on a curtained stage, 4 bars at 96 BPM (10 s). A baker walks
// through the sleeping town with a lantern, pushes the bakery door and steps in; the door shuts on his light. The shop
// window and the gable window catch, the chimney smokes and the far town wakes while the sky turns from night through
// rose to morning. The sun clears the hills at stage left, the rooster on the roof crows at it and the birds on the next
// roof lift. The lamp goes out, the door opens with its bell, the window sells out loaf by loaf, and the baker turns to
// the sun and bows as the curtains close. The organising idea: the light is carried, from the lantern to the ovens to
// the town to the sun.
const b = tb, GYs = H * SIL.S.ground;

// ---------- the clocks: hour of the story, camera ----------
// night holds while he walks; dawn is one deliberate eased ramp over four beats; morning holds to the end
const HOUR = t => 4.1 + .1 * seg(t, 0, b(8)) + 3.05 * EASE.inOut(seg(t, b(8.5), b(12.5)));
const CAM = t => [W / 2 + 390 * EASE.inOut(seg(t, .3, 5.2)), 1 + .05 * EASE.inOut(seg(t, b(8), b(14)))];   // ends with the door at the frame centre, where the curtains meet

// ---------- the set (street-layer world x; the camera ends looking at about 430..2270) ----------
const BAKERY = { x: 1200, w: 470, h: 300, roof: 170, door: 150 };   // door centre at world x 1350, hinged on its right
const NEXT = { x: 1960, w: 300, h: 220, roof: 120, eaves: 14 };      // the house next door; birds roost on its roof
const BAKER = { h: 215, step: .46, look: { hat: 'toque', build: 1, coat: .22, carry: 'lantern' } };
const ST = BAKER.step * BAKER.h;

// ---------- the beats (times the picture and the sound share) ----------
const ARRIVE = b(6.25), PUSH = ARRIVE - .2;                 // he stops at the door and pushes it; it swings in
const STEP0 = ARRIVE + .3, STEP1 = STEP0 + .62;             // one step over the threshold, up onto the step
const DOOR_SHUT = STEP1 + .1;                              // the door shuts on him and his lantern
const SHOP_ON = b(9.25), GABLE_ON = b(9.75), SMOKE = b(9.75), NEXT_ON = b(10.5);   // a dark beat after the door shuts, then the ovens
const SUN0 = b(10), SUN1 = b(12.5), SUN = { x: 640, y0: 770, y1: 520, r: 44 };
const LAMP_OFF = b(12), OPEN = b(12.25), TURN = b(12.75), BOW = b(13.25), CLOSE = b(14.25);

// the walk: from off stage left to the door, 9.92 strides (what SIL.stopX gives), so the feet stop clean; then one
// step in. The step lands on its leading foot and the hips settle over both feet, about 95 px past STOP_X: at the door.
const STOP_X = 1255, X0 = STOP_X - 9.92 * ST, STEP_X = STOP_X + ST / 2;
const WALK = [[0, X0], [ARRIVE, STOP_X, { accel: 0, decel: .8 }], [STEP0, STOP_X], [STEP1, STEP_X, { accel: .15, decel: .45 }]];
const DOOR = t => follow(t, [[-1e4, 0], [ARRIVE, 1], [DOOR_SHUT, 0], [OPEN, .92]], 'smooth');

// the sun's rise, and the moment its disc clears the far hills (computed from the same curve the sky draws)
const sunY = t => lerp(SUN.y0, SUN.y1, EASE.inOut(seg(t, SUN0, SUN1)));
const RIDGE = { y: 688, amp: 34, freq: .0032, seed: 2 }, MIDR = { y: 806, amp: 38, freq: .003, seed: 9 };
const hillTop = (() => { let top = H; for (let sx = SUN.x - SUN.r; sx <= SUN.x + SUN.r; sx += 4) {   // the camera has stopped panning by then
  for (const [R, d] of [[RIDGE, .12], [MIDR, .55]]) top = Math.min(top, SIL.ridgeY((sx - W / 2) / 1.003 + W / 2 + 390 * d, R)); } return top; })();
const SKYLINE = Math.min(hillTop, 744 - 100);   // the far town (depth .3, base y 744) has roofs up to about 100 px tall
const CROW = (() => { for (let t = SUN0; t < SUN1; t += 1 / FPS) if (sunY(t) + SUN.r + 8 < SKYLINE) return Math.round(t * FPS) / FPS; return SUN1; })();
const BIRDS = CROW + .22;

// a reach with the far hand (the near one holds the lantern): eases in, holds, eases out
const reach = (t, a, hold = .3) => Math.min(ease(seg(t, a, a + .2)), 1 - ease(seg(t, a + .2 + hold, a + .45 + hold)));

// the baker. Walking: in front of the house until he stands in the doorway, then in its inDoor hook (behind the door
// panel, which shuts on him). After OPEN: standing on the step, he turns to the sun and takes a curtain-call bow.
function baker(t, L) {
  const open = DOOR(t);
  if (t >= OPEN) {
    const bow = EASE.inOut(seg(t, BOW, BOW + .4)) - EASE.inOut(seg(t, BOW + .55, BOW + .9));
    const g = SIL.stand(BAKER.h, { lean: .5 * bow });
    return SIL.figure(BAKERY.x + BAKERY.door + 22, GYs - 6, g,   // a little right of centre: bowing to stage left keeps his head inside the arch
      { ...BAKER.look, carry: null, scale: .965, dir: SIL.turn(t, TURN, .32),
      arms: { far: bow > .01 ? [-.95, .25, bow] : [1.45, .1, reach(t, OPEN - .12)], near: [-.35, 1.33, bow] } });   // a curtain call: hand to the belly, the other arm swept back
  }
  if (t > DOOR_SHUT && open < .02) return;   // gone in: the door is shut
  const inStep = EASE.inOut(seg(t, STEP0 + .05, STEP1));
  SIL.walker(t, { ...BAKER, keys: WALK, y: GYs - 6 * inStep,
    look: { ...BAKER.look, scale: 1 - .035 * inStep, lanternOn: t > DOOR_SHUT ? open : 1, vis: L.vis, arms: { far: [1.45, .1, reach(t, PUSH)] } } });
}
// the shop window's goods: two shelves of loaves, which sell one by one once the door opens
const SOLD = [3, 0, 5, 2, 6, 1, 4], soldAt = i => OPEN + .25 + .11 * SOLD.indexOf(i);
const loaves = (x, y, w, h, t) => { CX.fillRect(x, y + h * .74, w, 5); CX.fillRect(x, y + h * .4, w, 4);
  const loaf = (i, cx, cy, rx, ry) => { const k = 1 - EASE.exit(seg(t, soldAt(i), soldAt(i) + .12)); if (k <= 0) return;
    CX.beginPath(); CX.ellipse(cx, cy, rx * k, ry * k, 0, Math.PI, TAU); CX.fill(); };
  for (let i = 0; i < 4; i++) loaf(i, x + w * (i + .5) / 4, y + h * .74, w * .1, h * .13);
  for (let i = 0; i < 3; i++) loaf(4 + i, x + w * (i + 1) / 4, y + h * .4, w * .085, h * .1); };

function street(L) {
  const t = L.t, open = DOOR(t);
  SIL.ground(L);
  // back row: a sleeping cottage, the house next door (its window wakes with the town), the bread cart
  SIL.house(L, 160, { w: 270, h: 190, roof: 110, chimney: { at: .25, w: 26, h: 90 }, windows: [{ x: 50, y: 70, w: 54, h: 66 }] });
  SIL.house(L, NEXT.x, { ...NEXT, chimney: { at: .72, w: 26, h: 80 }, windows: [{ x: 48, y: 96, w: 56, h: 68, on: SIL.light(t, NEXT_ON) }] });
  SIL.fence(L, 660, 960);
  SIL.cart(L, 1745, { dir: 1 });
  // the bakery: shop window with loaves, round gable window, an awning, the pretzel sign, the door
  const shop = SIL.light(t, SHOP_ON) * (.93 + .07 * noise(t * 5, 9));
  SIL.house(L, BAKERY.x, { w: BAKERY.w, h: BAKERY.h, roof: BAKERY.roof, chimney: { at: .8, w: 36, h: 150 },
    windows: [{ x: 230, y: 70, w: 180, h: 130, on: shop, panes: [3, 1], inside: (x, y, w, h) => loaves(x, y, w, h, t) },
      { x: 235 - 34, y: BAKERY.h + 40, w: 68, h: 68, round: true, on: SIL.light(t, GABLE_ON), panes: [2, 2] }],
    awning: { x: 220, w: 200, y: 232, depth: 24 },
    door: { x: BAKERY.door, w: 116, h: 285, open, hinge: 'right', light: t < OPEN ? .45 * ease(seg(t, STEP0, STEP1)) : 1 },
    inDoor: t >= STEP1 ? () => baker(t, L) : null });
  SIL.sign(BAKERY.x, GYs - 245, 74, t, SIL.emblems.pretzel);
  SIL.smoke(L, BAKERY.x + BAKERY.w * .8, GYs - BAKERY.h - 160, { from: SMOKE });
  // the rooster on the bakery's ridge wakes as the sky pales and crows when the sun clears the hills
  SIL.rooster(BAKERY.x + BAKERY.w / 2, GYs - BAKERY.h - BAKERY.roof + 2, 92, t, { dir: -1, wake: SUN0, crow: CROW });
  // the birds on the next roof lift at the crow and fly off toward the sun
  SIL.flock(L, { perches: SIL.roofPerches(NEXT.x, NEXT, 6, 'left', GYs), t0: BIRDS, dir: [-1, -.5], size: 15, speed: 400, seed: 8 });
  if (t < STEP1) baker(t, L);
  SIL.lamp(L, 720, { on: SIL.light(t, -1, LAMP_OFF) });
}

shots([[0, t => {
  SIL.stage(t, {
    hour: HOUR(t), cam: CAM(t),
    sky: { moon: [1640, 205, 30], sun: [SUN.x, sunY(t), SUN.r] },
    layers: [
      { depth: .12, draw: L => SIL.ridge(L, RIDGE) },
      { depth: .3, draw: L => { SIL.town(L, { y: 744, from: -300, to: 2500, seed: 4, wake: [b(9.5), b(12)] }); SIL.ridge(L, { y: 742, amp: 6, freq: .01, seed: 6 }); } },
      { depth: .55, draw: L => { SIL.ridge(L, MIDR);
        for (const [x, s, k] of [[140, 110, 1], [430, 140, 2], [780, 95, 3], [1180, 150, 4], [1540, 120, 5], [1900, 135, 6], [2260, 105, 7]]) SIL.roundTree(L, x, { y: SIL.ridgeY(x, MIDR) + 6, size: s, seed: k }); } },
      { depth: 1, draw: street },
      { depth: 1.35, draw: L => { for (const [x, h, k] of [[430, 150, 1], [1130, 120, 2], [2060, 160, 3]]) SIL.grass(L, x, { y: GYs + 64, h, n: 11, seed: k }); } },   // the nearest row passes in front
    ],
  });
  SIL.curtains(follow(t, [[-10, 0], [-.4, 1], [CLOSE, 0]], SIL.CURTAIN_SPRING));
  SIL.card(t, [{ t: b(1.5), text: 'Ovens lit at four.', id: 'cap1' }, { t: b(11), text: 'Sold out by nine.', id: 'cap2' }], { y: 108 });
  SIL.finish();
}]]);

// ---------- sound cues, from the same times the picture uses ----------
cue(0, 'swish', { weight: .45, dur: 1.2, id: 'curtains-open' });
cue(springAt(b(1.5), .9, SIL.CARD_SPRING), 'tick', { weight: .35, id: 'card' });
cue(springAt(DOOR_SHUT, .97, 'smooth'), 'land', { weight: .5, id: 'door-shut' });
cue(SHOP_ON, 'pop', { weight: .7, id: 'shop-window' });
cue(GABLE_ON, 'pop', { weight: .55, pitch: 5, id: 'gable-window' });
cue(SUN0, 'swell', { weight: .45, dur: 2.5, id: 'sunrise' });
cue(b(11), 'swish', { weight: .3, id: 'card-flip' });
cue(CROW, 'chime', { weight: .55, pan: .1, id: 'rooster-crow' });   // the crow itself, or a bright two-note in its place
cue(BIRDS + .1, 'whoosh', { weight: .3, pan: .45, id: 'birds' });
cue(OPEN, 'bell', { weight: .6, id: 'shop-bell' });
cue(CLOSE, 'swish', { weight: .45, dur: 1.1, id: 'curtains-close' });
// no footsteps, no sound on the camera move, the town waking, the lamp or the loaves: the light changes carry those
