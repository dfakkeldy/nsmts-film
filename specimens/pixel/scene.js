// pixel specimen: "Lamplighter", a 10 s teaser for a game that doesn't exist. One continuous side-scrolling take,
// drawn at 320 x 180 and shown at 6x. The organising idea: she lights lamps along a lake at night, the HUD counts
// them, and the third lamp turns out to be the sun. Through-line object: the flame on her pole.
//
// Beat list (120 BPM, 15 frames a beat):
//  0.00        iris opens on the lamplighter, already walking; the quest caption unfolds at 0.40
//  1.00  b2    lamp 1: she stops, tips the pole into the lantern, it lights (pop); its dithered halo blooms; HUD 1/3
//  1.6-2.0     she hops the creek (her reflection passes under her)
//  2.50  b5    lamp 2 lights; HUD 2/3
//  3.75        she reaches the bank; a dialogue box opens; her portrait says "THE BIG ONE."
//  4.6-6.2     the camera eases right toward the dark horizon she is looking at
//  6.55        the box closes; she raises the pole; a spark arcs to the horizon
//  7.00  b14   the spark lands: the sun lights (chime); HUD 3/3; the palette steps toward dawn on every beat to 8.5
//  7.50  b15   a heart over her head; 8.0 b16 the title drops and lands; 8.5 b17 the subtitle types on; birds cross
//  10.0        hold on the title, the sun still rising

const L = PIX, GROUND = 150, LAMPS = [{ x: 128, on: 1.0 }, { x: 210, on: 2.5 }];
const CREEK = [152, 168], BANK = 280, SUN_X = 204, SUN_ON = 7.0;

// ---------- the world ----------
const MAP = [   // near layer, 8 px tiles from y 149 (the top row of a grass tile is its blades)
  'ggggggggggggggggggG..HggggggggggggG',   // cols 19-20: the creek; col 34 ends at the bank (x 280)
  'ddddddddddddddddddl..rddddddddddddl',
  'ttttttttttttttttttL..RttttttttttttL',
  'DDDDDDDDDDDDDDDDDDL..RDDDDDDDDDDDDL',
];
const LAMP = ['...k...', '..kmk..', '.kmmmk.', 'kmmmmmk', 'kkkkkkk', 'kLLLLLk', 'kLLLLLk', 'kLLLLLk', 'kLLLLLk', 'kLLLLLk', 'kkkkkkk', '.kmmmk.', '..kMk..',
  ...Array(18).fill('..kMk..'), '..kmk..', '.kMMMk.', 'kMmmmMk'];
const ICON = ['.kkk.', 'kmmmk', 'kLLLk', 'kLLLk', 'kLLLk', 'kmmmk', '.kMk.', '..k..'];
const hfFar = L.heightFn({ base: 137, amp: 34, freq: .021, seed: 11, valley: { x: SUN_X + Math.floor(180 * .18), w: 34, depth: 22 } });
const hfMid = L.heightFn({ base: 138, amp: 11, freq: .035, seed: 4, valley: { x: SUN_X + Math.floor(180 * .45), w: 40, depth: 9 } });

// ---------- the lamplighter: 12 x 22, string maps ----------
const HEAD = ['...kkkkk....', '..kbbbbbk...', '.kbbbbbbbk..', '.khhhhhhhkkk', '.kokkkkkkkkk', '.kooosssssk.', '.koosssskssk', '.koSssssssk.', '..kSsrsssk..', '...kSSSSk...'];
const BODY = ['..kyyyyyyk..', '.kYyyYcccck.', '.kcYccccccck', '.kcYcccccck.', '.kccccccccck', '.kCcccccccck', '.kCCccccCCk.', '..kkkkkkkk..'];
const LEGS = {
  idle: { top: 18, rows: ['...kMk.kmk..', '...kMk.kmk..', '..khhk.khhk.', '..kkkk.kkkkk'] },
  a: { top: 18, rows: ['..kMk..kmk..', '.kMk....kmk.', 'khhk....khhk', 'kkk.....kkkk'] },
  b: { top: 17, rows: ['....kMmk....', '....kMmk....', '....kMmk....', '...khhhhk...', '...kkkkkk...'] },
  c: { top: 18, rows: ['..kmk..kMk..', '.kmk....kMk.', 'khhk....khhk', 'kkk.....kkkk'] },
  d: { top: 17, rows: ['....kmMk....', '....kmMk....', '....kmMk....', '...khhhhk...', '...kkkkkk...'] },
  jump: { top: 18, rows: ['...kmk.kMk..', '....kmkMk...', '....khhhhk..', '.....kkkk...'] },
};
// the portrait, 32 x 32, front-on: written as left halves and mirrored, with talking and blinking variants
const sym = h => h + [...h].reverse().join('');
const FACE = ['................', '..........kkkkkk', '........kkbbbbbb', '.......kbbbbbbbb', '......kbbbbbbbbb', '.....kbbbbbbbbbb',
  '.....khhhhhhhhhh', '....kkkkkkkkkkkk', '....kooohhhhhhhh', '...kooooosssssss', '...koooossssssss', '...kooosssssssss', '...kooossskkkkss',
  '...kooosssssssss', '...koossssskkkss', '...koossssskwkss', '...koossssskkkss', '...kooSsssssssss', '...kooSssrrsssss', '....koSSssssssss',
  '....koSSsssssskk', '.....kSSSsssssss', '......kSSSssssss', '.......kkSSSSSSS', '.........kkkkkkk', '.......kkyyyyyyy', '.....kkyyyyyyyyy',
  '....kcyyyyyyyyyy', '...kccYYyyyyyyyy', '..kccccYYYYYYYYY', '.kcccccckkkkkkkk', 'kCcccccccccccccc'];
const PORTRAIT = FACE.map(sym);
const PORTRAIT_TALK = FACE.map((r, i) => sym(i === 20 ? '....koSSssssskkk' : i === 21 ? '.....kSSSssssskr' : i === 22 ? '......kSSSsssskk' : r));
const PORTRAIT_BLINK = FACE.map((r, i) => sym(i === 14 || i === 16 ? '...koossssssssss' : i === 15 ? '...koossssskkkss' : r));

// ---------- her moves: [t0, t1, x0, x1], a trapezoid speed profile each (she is already walking at t = 0) ----------
const MOVES = [[-0.15, 0.85, 40, 114], [1.2, 2.35, 114, 196], [2.75, 3.85, 196, 262]];
function heroX(t) { for (const [t0, t1, x0, x1] of MOVES) { if (t < t0) return x0; if (t <= t1) return lerp(x0, x1, L.walk((t - t0) / (t1 - t0), .2)); } return MOVES[MOVES.length - 1][3]; }
const JUMP = [CREEK[0] - 12, CREEK[1] + 8], JUMP_H = 10;
const jumpU = x => clamp((x - JUMP[0]) / (JUMP[1] - JUMP[0]));
const camX = t => Math.round(clamp(heroX(t) - 100, 0, 162) + 18 * EASE.inOut(seg(t, 4.6, 6.2)));
// when she crosses a given x (for the jump cues): bisection on the move that contains it
function whenAt(x) { for (const [t0, t1, x0, x1] of MOVES) if (x > x0 && x <= x1) { let a = t0, b = t1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (heroX(m) < x) a = m; else b = m; } return (a + b) / 2; } return 0; }
const T_JUMP = whenAt(JUMP[0]), T_LAND = whenAt(JUMP[1]);
// the pole: carried upright, tipped into a lantern to light it, raised to throw
const REACH = LAMPS.map(l => ({ x: l.x, a: l.on - .15, b: l.on + .15, up: .12, down: .1 }));
const THROW = { a: 6.55, b: 7.15, up: .15, down: .2, release: 6.75 };
const poseK = (t, p) => EASE.punch(seg(t, p.a, p.a + p.up)) * (1 - EASE.inOut(seg(t, p.b, p.b + p.down)));
function hero(t) {
  const x = heroX(t), moving = MOVES.some(([t0, t1]) => t > t0 + .02 && t < t1 - .02), u = jumpU(x), inJump = u > 0 && u < 1;
  const jy = inJump ? -4 * JUMP_H * u * (1 - u) : 0;
  const step = Math.floor(x / 7) % 4, legs = inJump ? 'jump' : moving ? 'abcd'[step] : 'idle';
  const bob = legs === 'b' || legs === 'd' ? -1 : 0;   // the passing frames lift the body a pixel
  const X = Math.round(x) - 6, Y = Math.round(GROUND - 22 + jy);
  let hand = [9, 12], tip, reachK = 0;
  const carryTip = h => [h[0] + 4, h[1] - 18];
  for (const r of REACH) { const k = poseK(t, r); if (k > 0) { reachK = k; const h = [lerp(9, 10, k), lerp(12, 9, k)];
    const target = [r.x - 4 - X, 127 - Y], c = carryTip(h); hand = h; tip = [lerp(c[0], target[0], k), lerp(c[1], target[1], k)]; } }
  const tk = poseK(t, THROW);
  if (tk > 0) { const h = [9, lerp(12, 6, tk)], c = carryTip(h), up = [h[0] + 11, h[1] - 14]; hand = h; tip = [lerp(c[0], up[0], tk), lerp(c[1], up[1], tk)]; }
  if (!tip) tip = carryTip(hand);
  return { x, X, Y, bob, legs, hand, tip, reachK, tk, inJump };
}
function drawHero(h, cam) {
  const X = h.X - cam, Y = h.Y, [hx, hy] = h.hand.map(Math.round), tip = [X + h.tip[0], Y + h.tip[1]];
  L.sprite(HEAD, X, Y + h.bob); L.sprite(BODY, X, Y + 10 + h.bob);
  const lg = LEGS[h.legs]; L.sprite(lg.rows, X, Y + lg.top);
  // the pole through her hand, then the near arm and the hand over it
  const dx = tip[0] - (X + hx), dy = tip[1] - (Y + hy), len = Math.hypot(dx, dy) || 1;
  L.line(X + hx - dx / len * 5, Y + hy - dy / len * 5, tip[0], tip[1], 'b');
  L.line(X + 6, Y + 11 + h.bob, X + hx, Y + hy, 'C'); L.rect(X + hx, Y + hy, 2, 2, 's'); L.pset(X + hx, Y + hy + 1, 'S');
  return tip;
}

// ---------- the sun, the spark, the palette ----------
const sunY = t => Math.round(lerp(147, 110, easeOut(seg(t, SUN_ON, SUN_ON + 3.2))));   // whole pixels: it rises in steps
const dawn = t => t < SUN_ON ? 0 : Math.min(1, (Math.floor((t - SUN_ON) / BEAT) + 1) * .25);   // steps on b14, b15, b16, b17
const SUNLIT = L.remap({ 0: '1', 1: '2', 2: '3', 3: 'F', 4: '5', 6: '7', 7: '5', d: 'e', e: 'E', 9: 'b', a: 'A' });
function sparkAt(t, h0) { // the spark's flight: from the pole tip at release to the horizon at SUN_ON
  const u = seg(t, THROW.release, SUN_ON), [x0, y0] = h0, x1 = SUN_X, y1 = 135;
  return [lerp(x0, x1, u), lerp(y0, y1, u) - 30 * 4 * u * (1 - u)];
}
// the title spring: dropped on b16, lands with a shake
const TITLE_Y = 36, titleY = t => Math.round(follow(t, [[0, -24], [tb(16), TITLE_Y]], 'bouncy'));
const T_TITLE_LAND = springAt(tb(16), 1, 'bouncy');
const SUB = 'OUT AT DAWN', T_SUB = tb(17);
const LINE = 'THE BIG ONE.', DLG = { open: 3.75, close: 6.55, type: 3.92, cps: 18 };
const T_TYPED = (() => { for (let t = DLG.type; t < DLG.close; t += 1 / 240) if (typed(t, DLG.type, LINE, DLG.cps).done) return t; return DLG.close; })();

// ---------- sound cues, from the same times the picture uses ----------
cue(.4, 'tick', { weight: .4, id: 'caption' });
for (const l of LAMPS) cue(l.on, 'pop', { weight: .9, pitch: l === LAMPS[0] ? 0 : 2, id: 'lamp' });
cue(T_JUMP, 'swish', { weight: .4, id: 'jump' }); cue(T_LAND, 'land', { weight: .5, id: 'jump-land' });
cue(DLG.open, 'tick', { weight: .4, id: 'dialog' }); cue(DLG.type, 'key', { weight: .35, dur: +(T_TYPED - DLG.type).toFixed(3), id: 'typing' });
cue(THROW.release, 'whoosh', { weight: .6, dur: SUN_ON - THROW.release, id: 'spark' });
cue(SUN_ON, 'chime', { weight: .9, id: 'sun' }); cue(SUN_ON, 'swell', { weight: .6, dur: 1.5, id: 'dawn' });
cue(tb(15), 'pop', { weight: .5, pitch: 7, id: 'heart' });
cue(T_TITLE_LAND, 'thump', { weight: 1, id: 'title' });

// ---------- the frame ----------
function frame(t) {
  const cam = camX(t), lv = dawn(t), h = hero(t);
  L.begin('0');
  // sky: a dithered ramp, stars and moon while it is night, two slow clouds
  L.gradient(0, 138, '0123', { band: .55 });
  if (lv < .75) L.stars({ n: 48, seed: 5, y0: 3, y1: 112, cam, f: .03, t, fps: 3, dim: lv > 0 ? null : '2', big: .12 });
  if (lv < 1) { L.disc(282, 26, 6, 'n'); if (lv < .5) { L.pset(280, 24, 'm'); L.pset(284, 28, 'm'); L.pset(281, 29, 'm'); } }   // the moon fades with the palette
  const drift = L.stepT(t, 4) * 2;
  L.cloud(36 - L.scroll(cam, .08) - drift, 44, 74, '2', { lean: -1 }); L.cloud(188 - L.scroll(cam, .08) - drift, 63, 52, '2', { lean: 1 });
  // the sun, behind the mountains, rising in whole pixels
  if (t >= SUN_ON) { const sy = sunY(t); L.disc(SUN_X, sy, 11, 'y'); L.disc(SUN_X, sy, 9, 'f'); }
  // far mountains, near hills with pines (two parallax layers), then the lake band that mirrors them
  L.ridge({ h: hfFar, cam, f: .18, fill: '4', rim: '5', bottom: 138, light: 1 });
  L.ridge({ h: hfMid, cam, f: .45, fill: '6', rim: '7', bottom: 138, light: 1 });
  L.stamps(L.SPR.pine, { cam, f: .45, gap: 11, y: wx => hfMid(wx) + 2, seed: 2, skip: .4 });
  L.stamps(L.SPR.pineTall, { cam, f: .45, gap: 31, y: wx => hfMid(wx) + 2, seed: 8, skip: .3 });
  L.rect(0, 138, L.W, 42, 'd');
  L.reflect(0, 138, L.W, 180, t, { wave: 1 });
  L.sparkle(0, 140, L.W, 180, t, { c: lv >= .5 ? 'E' : 'e', density: .025, every: 3, seed: 1 });
  const glint = t >= SUN_ON ? clamp((138 - (sunY(t) - 11)) / 12) : 0;   // the sun's road on the water grows as it clears the hills
  if (glint > 0) L.sparkle(SUN_X - 10, 141, SUN_X + 10, 180, t, { c: 'f', density: .3 * glint, every: 2, seed: 4, len: [2, 4] });
  // the near layer: the tile map, the lamps, the creek, her
  L.tiles(MAP, L.TILES.meadow, -cam, GROUND - 1, { seed: 3 });
  for (const l of LAMPS) { const on = t >= l.on, flash = on && t < l.on + 2 / FPS;
    L.sprite(LAMP, l.x - 3 - cam, GROUND - LAMP.length, { remap: { L: flash ? 'w' : on ? 'f' : 'M' } }); if (!on) L.pset(l.x - 1 - cam, 122, 'm'); }
  L.rect(CREEK[0] - cam, 153, CREEK[1] - CREEK[0], 27, 'd');
  const tip = drawHero(h, cam);
  L.reflect(CREEK[0] - cam, 153, CREEK[1] - cam, 180, t, { wave: .6 });
  L.sparkle(CREEK[0] - cam, 155, CREEK[1] - cam, 180, t, { c: 'e', density: .12, every: 3, seed: 6 });
  // light: each lit lamp's pool (it blooms over three frames), the flame she carries, the moon, the sun
  for (const l of LAMPS) if (t >= l.on) { const f = Math.floor((t - l.on) * FPS), r = f < 3 ? [12, 20, 25][f] : 25 + L.fr(t, 8, 2, l.on);
    L.light(l.x - cam, 123, r * (1 - lv * .6), { soft: 10, core: 7 }); }
  if (lv < 1) L.light(tip[0], tip[1] - 3, 17 * (1 - lv), { soft: 7 });
  if (lv < .5) L.light(282, 26, 15, { soft: 7 });
  if (t >= THROW.release && t < SUN_ON) { const hh = hero(THROW.release), [sx, sy] = sparkAt(t, [hh.X - camX(THROW.release) + hh.tip[0], hh.Y + hh.tip[1] - 3]); L.light(sx, sy, 14, { soft: 6, core: 4 }); }
  if (t >= SUN_ON) { const k = Math.min(1, (t - SUN_ON) / .4), sy = sunY(t); L.light(SUN_X, sy, 18 + 24 * k, { soft: 14, core: 14, table: SUNLIT, clip: [0, 0, L.W, 138] });
    if (lv >= .5) L.light(SUN_X, 276 - sy, 16, { soft: 8, table: SUNLIT, clip: [0, 138, L.W, L.H] }); }   // and a smaller glow where it lies on the water
  // what burns, drawn over the light so it keeps its shape
  for (const l of LAMPS) if (t >= l.on + 2 / FPS) { const fx = l.x - cam, k = L.fr(t, 8, 2, l.on); L.rect(fx, 122 + k, 1, 3 - k, 'F'); L.pset(fx - 1 + k, 124, 'F'); L.pset(fx, 124, 'o'); }
  const holding = t < THROW.release;
  if (holding || t > THROW.b) L.sprite(L.SPR.flame[L.fr(t, 10, 3)], tip[0] - 2, tip[1] - 7);
  if (t >= THROW.release && t < SUN_ON) {
    const h0 = (() => { const hh = hero(THROW.release); return [hh.X - camX(THROW.release) + hh.tip[0], hh.Y + hh.tip[1] - 3]; })();
    for (const [dt, c, z] of [[4 / FPS, 'o', 1], [3 / FPS, 'o', 1], [2 / FPS, 'F', 2], [1 / FPS, 'f', 2]]) { const [px, py] = sparkAt(t - dt, h0); if (t - dt >= THROW.release) L.rect(px, py, z, z, c); }
    const [sx, sy] = sparkAt(t, h0); L.sprite(L.SPR.spark[L.fr(t, 15, 2)], sx - 2, sy - 2);
  }
  // each ignition throws a burst: the two lamps, then the sun
  for (const l of LAMPS) L.burst(l.x - cam, 123, Math.floor((t - l.on) * FPS) / 6, { r: 10 });
  L.burst(SUN_X, 135, Math.floor((t - SUN_ON) * FPS) / 8, { r: 16 });
  // fireflies drift to every lit lamp at night
  if (lv < .5) LAMPS.forEach((l, j) => { if (t < l.on + .3) return; const ts = L.stepT(t, 12);
    for (let i = 0; i < 4; i++) { if (hash(Math.floor(t * 5) + i * 7 + j * 31) < .3) continue;
      L.pset(l.x - cam + noise(ts * .7 + i * 3.3, j * 9 + 1) * 13, 122 + noise(ts * .6 + i * 5.1, j * 9 + 2) * 9, 'y'); } });
  // the foreground: reeds and tufts at 1.5x, darkest of all
  L.stamps(L.SPR.tuft, { cam, f: 1.5, gap: 41, y: 181, seed: 3, skip: .4 });
  L.stamps(L.SPR.cattail, { cam, f: 1.5, gap: 13, y: 183, seed: 9, skip: .45, jitter: 6 });
  // birds at dawn
  if (t > 8.3) for (let i = 0; i < 3; i++) { const bx = 336 - (t - 8.3) * 46 + i * 15 - (i === 1 ? 6 : 0), by = 88 + i * 4 + (L.fr(t, 3, 2, i * .2) ? 1 : 0);
    L.sprite(L.SPR.bird[L.fr(t, 6, 2, i * .11)], bx, by); }
  // a heart over her head when the sun comes up
  const ek = t < tb(15) || t > 8.9 ? 0 : t < tb(15) + 2 / FPS || t > 8.9 - 2 / FPS ? .3 : 1;
  L.emote(h.X - cam + 7, h.Y - 2, ek);
  ui(t, cam);
  // the iris opens on her head
  if (t < .5) { const r = lerp(20, 300, EASE.inOut(seg(t, 0, .48))); L.iris(h.X - cam + 6, h.Y + 6, Math.round(r / 3) * 3); }
  // the palette: night stepping to dawn, a two-frame flash when the sun lights
  let pal = L.mix(L.NIGHT, L.DAWN, lv);
  const ff = Math.floor((t - SUN_ON) * FPS + 1e-6); if (ff === 0 || ff === 1) pal = L.toward(pal, '#fff4dc', ff === 0 ? .32 : .14);
  const lf = Math.floor((t - T_TITLE_LAND) * FPS + 1e-6);
  L.present(pal, { shake: lf === 0 ? [0, 1] : lf === 1 ? [0, -1] : [0, 0] });
}

function ui(t, cam) {
  // HUD: three lamp slots; the third is filled by the sun. It leaves before the title lands.
  const hy = Math.round(10 - 30 * easeIn(seg(t, 7.8, 8.05)));
  if (hy > -20) { L.panel(16, hy, 29, 14, L.UI.hud);
    [LAMPS[0].on, LAMPS[1].on, SUN_ON].forEach((on, i) => { const lit = t >= on, pop = lit && t < on + 2 / FPS;
      L.sprite(ICON, 20 + i * 8, hy + 3, { remap: { L: pop ? 'w' : lit ? 'f' : 'M' } }); if (lit && !pop) L.pset(22 + i * 8, hy + 6, 'F'); }); }
  // the quest caption
  L.caption('quest', 'QUEST: LIGHT 3 LAMPS', 52, 10, seg(t, .4, .53) * (1 - seg(t, 3.0, 3.13)));
  // the dialogue
  const open = seg(t, DLG.open, DLG.open + .13) * (1 - seg(t, DLG.close, DLG.close + .13));
  if (open > 0) { const ty = typed(t, DLG.type, LINE, DLG.cps), talking = !ty.done && t >= DLG.type, blink = (t > 5.1 && t < 5.2) || (t > 6.1 && t < 6.2);
    L.dialog('dlg', { x: 16, y: 34, w: 122, h: 44, open, t, str: ty.str, full: LINE, portrait: talking && L.fr(t, 8, 2) ? PORTRAIT_TALK : blink ? PORTRAIT_BLINK : PORTRAIT }); }
  // the title: dropped on a spring, readable once it has landed; the subtitle types on
  if (t >= tb(16)) { const y = titleY(t), settled = t > T_TITLE_LAND + .25;
    L.text(settled ? 'title' : null, 'LAMPLIGHTER', 160, y, { big: true, align: 'center', grad: 'ffyyyYY', outline: 'k', shadow: 'h' }); }
  if (t >= T_SUB) { const ty = typed(t, T_SUB, SUB, 22), x = 160 - L.textW(SUB) / 2;
    L.text(ty.done ? 'sub' : '~sub', ty.str, x, 60, { color: 'w', shadow: 'k' }); }
}

shots([[0, t => frame(t)]]);

// a model sheet for drawing the sprites: node render.mjs --project=specimens/pixel --loop=sheet --stills=0
LOOPS.sheet = t => {
  L.begin('M'); const poses = ['idle', 'a', 'b', 'c', 'd', 'jump'];
  poses.forEach((p, i) => { const X = 12 + i * 18, Y = 20, lg = LEGS[p], bob = p === 'b' || p === 'd' ? -1 : 0;
    L.sprite(HEAD, X, Y + bob); L.sprite(BODY, X, Y + 10 + bob); L.sprite(lg.rows, X, Y + lg.top); });
  L.sprite(PORTRAIT, 130, 12); L.sprite(PORTRAIT_TALK, 166, 12); L.sprite(PORTRAIT_BLINK, 202, 12);
  L.sprite(LAMP, 250, 10, { remap: { L: 'f' } }); L.sprite(LAMP, 262, 10, { remap: { L: 'M' } });
  L.hearts(12, 60, 2, 3); L.emote(60, 72, 1); L.sprite(L.SPR.flame[0], 80, 62); L.sprite(L.SPR.flame[1], 88, 62); L.sprite(L.SPR.flame[2], 96, 62);
  L.tiles(['gggG.Hg', 'dddl.rd', 'tttL.Rt', 'DDDL.RD'], L.TILES.meadow, 12, 86);
  L.text(null, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12, 130, { color: 'w' }); L.text(null, '0123456789 .,!?:-/"+()\'', 12, 140, { color: 'y' });
  L.text(null, 'LAMPLIGHTER', 12, 152, { big: true, grad: 'ffyyyYY', shadow: 'h' });
  L.present(L.NIGHT);
}; LOOPS.sheet.len = 1;
