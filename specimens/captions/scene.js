// captions specimen: one narrated line about a made-up reading lamp, Hesper, captioned three ways. Sentence one is a
// broadcast subtitle card, sentence two kinetic word-by-word pages, sentence three keyword captions (one mode a
// sentence, to show the range; a real film keeps one). The lamp is the picture and it listens: its head leans toward
// the words while the voice runs and eases back at each pause, its light swells with the voice, a ring pulses on its
// base at every word, it dims on "dims", and its light changes as the key words land (Bright, Warm, Dark).
// 1920 x 1080, 30 fps, 10 s; the voice starts at 0.57 s.
// The timings in words.json came from a scratch `say` line timed with whisper-cli DTW; no audio ships with it.

const INK = '#1D2230', CREAM = '#F6EEDF', AMBER = '#F2A93B';
const VOICE = captions.load('specimens/captions/words.json', { offset: .5, keys: ['Bright', 'Warm', 'Dark'] });
const word = s => VOICE.words.find(w => w.bare === s);

// ---------- the plan: one mode a sentence, switched a hair before each sentence's first word ----------
// The last page ("Dark for sleep.") lands as the room goes dark, so it gets a window of its own with cream type: the
// colour belongs to the page, never to the frame, and no frame shows ink on the dark wall or a word changing colour.
const S2 = word('say').start - .06, S3 = word('bright').start - .06, S4 = word('dark').start - .001;
const SUB = { plate: 'line', plateColor: INK, plateAlpha: .9, color: CREAM };
const KIN = { position: [.675, .44], maxW: 900, size: 92, color: INK, edge: 'none', accent: AMBER, accentInk: INK };
const KEY = { position: [.675, .45], maxW: 900, size: 54, keySize: 236, edge: 'none', color: INK };
const PLAN = [[0, 'subtitle', SUB], [S2, 'kinetic', KIN], [S3, 'keyword', KEY], [S4, 'keyword', { ...KEY, color: CREAM }]];

// ---------- the room: the lamp's light, keyed to the words ----------
const LIGHT = {
  dusk: { wall: '#4A5268', table: '#3C4357', light: '#FFE2AC', level: 0, night: 0 },
  warm: { wall: '#EFE3CC', table: '#D9C4A1', light: '#FFE0A6', level: 1, night: 0 },
  dim: { wall: '#A68D6E', table: '#8E7558', light: '#F7C47A', level: .42, night: 0 },
  bright: { wall: '#F5F4EF', table: '#DEDACE', light: '#FFFFFF', level: 1.1, night: 0 },
  amber: { wall: '#F0CF98', table: '#D7AB6F', light: '#FFC468', level: .95, night: 0 },
  ember: { wall: '#5A3F2E', table: '#45311F', light: '#F2A93B', level: .3, night: .5 },   // amber goes out through warm, not grey
  night: { wall: '#222938', table: '#1A1F2B', light: '#FFE2AC', level: 0, night: 1 },
};
const ON = .22, DIM = word('dims').start, BLINK = 9.45;
// the light changes as each key word lands: at its page's in-time, when the previous page has just gone
const PRE = captions.PRESET.keyword.pre;
const SWITCH = { bright: word('bright').start - PRE, amber: word('warm').start - PRE, night: word('dark').start - PRE };
const KEYS = [[0, 'dusk'], [ON, 'warm', .06], [DIM, 'dim', .8], [SWITCH.bright, 'bright', .06], [SWITCH.amber, 'amber', .06],
  [SWITCH.night, 'ember', .04], [SWITCH.night + .04, 'night', .1]];
function room(t) {
  let R = { ...LIGHT.dusk };
  for (const [t0, name, d] of KEYS.slice(1)) {
    if (t < t0) break;
    const k = (d > .1 ? EASE.inOut : easeOut)(seg(t, t0, t0 + d)), S = LIGHT[name];
    R = { wall: mixCol(R.wall, S.wall, k), table: mixCol(R.table, S.table, k), light: mixCol(R.light, S.light, k), level: lerp(R.level, S.level, k), night: lerp(R.night, S.night, k) };
  }
  return R;
}

// ---------- the lamp ----------
const TABLE = 800, BASE = [330, TABLE], ELBOW = [438, 530], PIVOT = [612, 404], REST = [752, TABLE + 16], LEAN = 5.5 * Math.PI / 180;
function lamp(t, R) {
  const body = mixCol(INK, '#4B556F', R.night), joint = mixCol('#3A4157', '#5E6884', R.night);
  // it listens: the head leans toward the words while the voice runs and eases back at each pause (a small nod at a
  // comma, a full one at a full stop), and the light swells a little with the voice. Both come from captions.level().
  const lean = captions.level(t, { attack: .22, release: .26 }), swell = 1 + .2 * captions.level(t);
  const ang = Math.atan2(REST[1] - PIVOT[1], REST[0] - PIVOT[0]) - LEAN * lean, u = [Math.cos(ang), Math.sin(ang)], n = [-u[1], u[0]];
  const AIM = [PIVOT[0] + (REST[1] - PIVOT[1]) / Math.tan(ang), REST[1]];   // the pool slides along the table with the head
  const at = (p, a, b) => [p[0] + u[0] * a + n[0] * b, p[1] + u[1] * a + n[1] * b], mouth = at(PIVOT, 118, 0), mw = 80;
  // the light, behind the lamp: a soft wash on the wall, a cone, a pool on the table
  if (R.level > .01) {
    CX.save();
    const wash = CX.createRadialGradient(mouth[0], mouth[1], 20, mouth[0], mouth[1], 620);
    for (const [k, a] of [[0, 1], [.3, .55], [.6, .2], [.85, .05], [1, 0]]) wash.addColorStop(k, rgba(R.light, .22 * R.level * swell * a)); CX.fillStyle = wash; CX.fillRect(-200, -200, W + 400, TABLE + 200);
    const cone = CX.createLinearGradient(mouth[0], mouth[1], AIM[0], AIM[1]);
    cone.addColorStop(0, rgba(R.light, .5 * R.level * swell)); cone.addColorStop(1, rgba(R.light, .1 * R.level * swell));
    const mL = at(PIVOT, 118, mw * .92), mR = at(PIVOT, 118, -mw * .92);
    CX.beginPath(); CX.moveTo(mL[0], mL[1]); CX.lineTo(AIM[0] - 330, AIM[1]); CX.lineTo(AIM[0] + 330, AIM[1]); CX.lineTo(mR[0], mR[1]); CX.closePath(); CX.fillStyle = cone; CX.fill();
    CX.translate(AIM[0], AIM[1]); CX.scale(1, .13); const pool = CX.createRadialGradient(0, 0, 0, 0, 0, 340);
    pool.addColorStop(0, rgba(R.light, .55 * Math.min(1, R.level) * swell)); pool.addColorStop(1, rgba(R.light, 0)); CX.fillStyle = pool; CX.beginPath(); CX.arc(0, 0, 340, 0, TAU); CX.fill();
    CX.restore();
  }
  books(R);
  // the body: base, arms, joints, shade
  box(BASE[0] - 116, TABLE - 30, 232, 30, [16, 16, 5, 5], body);
  line([[BASE[0], TABLE - 28], ELBOW], body, 17); line([ELBOW, PIVOT], body, 14);
  circle(BASE[0], TABLE - 30, 19, body); circle(ELBOW[0], ELBOW[1], 16, body); circle(ELBOW[0], ELBOW[1], 5.5, joint);
  const shade = [at(PIVOT, -16, 30), at(PIVOT, 118, mw), at(PIVOT, 118, -mw), at(PIVOT, -16, -30)];
  CX.beginPath(); shade.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y)); CX.closePath(); CX.fillStyle = body; CX.fill();
  circle(PIVOT[0], PIVOT[1], 34, body); circle(PIVOT[0], PIVOT[1], 6, joint);
  CX.save(); CX.translate(mouth[0], mouth[1]); CX.rotate(ang); CX.beginPath(); CX.ellipse(0, 0, 11, mw * .86, 0, 0, TAU);
  CX.fillStyle = mixCol(joint, R.light, clamp(R.level)); CX.fill(); CX.restore();
  // it listens: a ring leaves the light on its base at every word; after the last word it rests, then blinks once
  const led = [BASE[0] + 74, TABLE - 15], on = clamp(R.level * 1.4 + R.night * .55);
  for (const w of VOICE.words) { const p = seg(t, w.start, w.start + .55); if (p <= 0 || p >= 1) continue;
    circle(led[0], led[1], 6 + 28 * EASE.outExpo(p), null, { stroke: AMBER, lw: 2.5, alpha: .75 * (1 - p) }); }
  const blink = kick(t, BLINK, { attack: .08, tau: .35 });
  if (blink > .01) circle(led[0], led[1], 6 + 22 * EASE.outExpo(seg(t, BLINK, BLINK + .6)), null, { stroke: AMBER, lw: 2.5, alpha: .8 * (1 - seg(t, BLINK, BLINK + .6)) });
  circle(led[0], led[1], 6, mixCol(joint, AMBER, clamp(on * (.75 + .25 * captions.level(t)) + blink)));
}

// two books lying in the pool of light, lit on top. At night they go cool with the lamp's body, never to the wall's
// colour, and a faint rim keeps the stack's outline (the navy book is the night palette's own hue, so it needs both).
function books(R) {
  const shade = c => mixCol(c, '#343C52', .5 * R.night), lit = rgba(R.light, .7 * clamp(R.level)), rim = rgba(CREAM, .2 * R.night);
  for (const [x, y, w, h, c] of [[664, TABLE - 34, 300, 34, '#34405E'], [694, TABLE - 62, 236, 28, '#D98A2B']]) {
    box(x, y, w, h, 6, shade(c));
    box(x + w - 16, y + 6, 10, h - 12, 2, shade(CREAM), { alpha: .85 - .25 * R.night });   // the page block at the fore-edge
    box(x + 4, y, w - 8, 3, 1.5, lit);                                       // light along the top
    if (R.night > .01) box(x + 5, y, w - 10, 2, 1, rim);                     // and at night, a faint rim
  }
}

shots([[0, t => {
  const R = room(t);
  bg(R.wall);
  CX.save(); cam(W / 2 - 40, H / 2 + 10, 1 + .035 * EASE.inOut(t / DUR));   // a slow push on the room, never on the captions
  CX.fillStyle = R.table; CX.fillRect(-200, TABLE, W + 400, H);
  CX.fillStyle = rgba(INK, .12); CX.fillRect(-200, TABLE, W + 400, 5);
  lamp(t, R);
  CX.restore();
  captions.draw(t, PLAN);
}]]);

// ---------- checks and sound, from the same times the picture uses ----------
captions.check(PLAN);   // prints any card or page faster than 20 characters a second
cue(ON, 'click', { weight: .8, id: 'lamp-on' });
for (const p of captions.segments([[S2, 'kinetic', KIN], [S3, null]])) cue(p.in, 'pop', { weight: .3, id: 'page' });
cue(DIM, 'suck', { weight: .5, dur: .8, id: 'dim' });
cue(SWITCH.bright, 'click', { weight: .9, pitch: 2, id: 'switch' }); cue(SWITCH.amber, 'click', { weight: .9, id: 'switch' });
cue(SWITCH.night, 'click', { weight: .9, pitch: -3, id: 'switch' });
cue(BLINK, 'tick', { weight: .4, id: 'standby' });
