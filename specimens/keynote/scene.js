// keynote specimen: "Murmur", a made-up audiobook app, launched in 10 s on bright white (4 bars at 96 BPM, one take).
// The organising idea: the app keeps your place. The through-line is the accent playhead dot: it rides the phone's
// scrubber, gets called out, jumps to the laptop at the same second of the book, and ends as the dot in the app icon.
//   bar 1  the phone turns in from edge-on, the screen wakes, "Meet Murmur."
//   bar 2  the camera pushes in; two features, one per beat, with leader lines
//   bar 3  the camera pulls back and finds the laptop, shut; its lid opens on the beat and the screen lights as it
//          comes up; the dot jumps from phone to laptop; "Pick up where you left off."
//   bar 4  the devices part, the dot flies home and the icon blooms round it; the name; hold
const b = tb, SP = KN.SPRING, S = KN.S;
const LEN = 17608, POS0 = .2459;                       // the book: 4:53:28, playing from 1:12:08 in real time
const pos = t => POS0 + Math.max(0, t) / LEN;
const CH = [.07, .16, .25, .36, .47, .58, .7, .81, .92];   // chapter marks
const PUSH = 1.9, PULL = b(7), LIDT = b(8), HOP = [b(9.5), b(10.5)], PART = b(11.5), HOME = b(12.5), NAME = b(13);

// ---------- the world and its camera ----------
// World units are the family shot's frame pixels: the phone stands at PW, the laptop comes to rest at [750, 650].
// The camera keeps the phone's centre at frame point [fx, fy] at zoom z, and those three ride critically damped
// springs, so the reveal, the push-in and the pull-back are camera moves that both devices share.
const PW = [1450, 545, .38];
const CAM = [
  [-9, [1060, 720, .64 / PW[2]]],
  [-.3, [960, 622, .72 / PW[2]], SP.reveal],           // the reveal, already moving at frame 0
  [PUSH, [1190, 548, .88 / PW[2]], SP.cam],             // push in on the phone, leaving the left of frame for callouts
  [PULL, [PW[0], PW[1], 1], SP.cam],                    // pull back to the family shot
];
const camAt = t => { const [fx, fy, z] = follow(t, CAM); return KN.camera(PW[0], PW[1], fx, fy, z); };
// the phone's own turn and float (the camera stays dead steady between keys)
const YAW = [[-9, 1.32], [-.3, -.16, SP.reveal], [PUSH, -.42, SP.cam], [PULL, -.16, SP.cam]];
const part = t => EASE.exit(seg(t, PART, PART + .72));
function phoneAt(t) { const e = part(t); return [PW[0] + 720 * e, PW[1] + 2 * Math.sin(t * 1.3), PW[2], follow(t, YAW) + .03 * Math.sin(t * 1.05 + .4) - .5 * e]; }
// the laptop waits off to the left with its lid shut, slides in with the pull-back (same spring, same start), turning
// from three-quarter to face the phone, and opens on the next beat
const LT = [[-9, [250, 650, .5]], [PULL, [750, 650, .12], SP.cam]];
const LID = [[-9, -Math.PI / 2], [LIDT, .2, SP.lid]];
function laptopAt(t) { const [x, y, yaw] = follow(t, LT), e = part(t); return [x - 1320 * e, y + 2 * Math.sin(t * 1.1 + 2), .56, { yaw: yaw + .02 * Math.sin(t * .9 + 1) + .4 * e, lid: follow(t, LID) }]; }
// leaving: the devices soften as they accelerate away (it reads as speed, and hides motion-blur sub-frame steps)
const away = t => 7 * EASE.exit(seg(t, PART + .05, PART + .6));

// ---------- what the screens show ----------
const phoneScreen = t => B => KN.player(B, {
  wake: easeOut(seg(t, b(2), b(2) + .45)), pos: pos(t), len: LEN, knob: t < HOP[0] ? 1 : 0,
  ticks: CH, tickP: seg(t, b(2) + .15, b(2) + 1.1), sleep: springStep(t - b(5), 'snappy'), sleepLeft: 1800 - Math.max(0, t - b(5)),
});
const laptopScreen = (t, lid) => B => KN.desktop(B, {
  wake: KN.lidWake(lid), pos: pos(t), len: LEN, ticks: CH, tickP: 1,
  knob: t >= HOP[1] && t < PART ? 1 : 0, toast: springStep(t - HOP[1] - .05, 'snappy'),
});

// ---------- the end card ----------
const ICON = [960, 392, 204];

shots([[0, t => {
  KN.stage(t, { light: [W / 2, H * .45] });
  CX.save(); KN.push(1 + .01 * t / DUR + .025 * EASE.inOut(seg(t, HOME, DUR)));   // a slow push, leaning in on the end card
  const cam = camAt(t);
  // the products, through the one camera (the laptop only exists from the pull-back to the parting)
  let lap = null, ph = null;
  if (t > PULL && t < PART + .8) { const [x, y, s, rot] = laptopAt(t); lap = KN.focus(away(t), () => KN.laptop(x, y, s, rot, laptopScreen(t, rot.lid), { cam })); }
  // rack focus: the phone pulls into focus as it turns in, and softens while the dot hands over to the laptop
  if (t < PART + .8) { const [x, y, s, yaw] = phoneAt(t), soft = 11 * (1 - KN.EASE.settle(seg(t, 0, .95))) + 2.6 * ease(seg(t, HOP[0] - .1, HOP[1] + .1)) + away(t);
    ph = KN.focus(soft, () => KN.phone(x, y, s, yaw, phoneScreen(t), { cam })); }

  // bar 1: the name
  KN.headline('meet', 'Meet Murmur.', W / 2, 200, t, { t0: .2, t1: PUSH + .05 });

  // bar 2: two features, one per beat; the line leads, the label lands on the beat. Each label stays level with its
  // anchor; they let go one after the other as the camera starts to pull back, the lines drawing back into the phone.
  if (ph && t > b(4) - .5 && t < PULL + .8) {
    const k = ph.at(...ph.ui.knob), mo = ph.at(...ph.ui.moon);
    KN.callout('resume', 'Resumes mid-sentence', t, { at: k, label: 930, t0: b(4), t1: PULL + .2 });
    KN.callout('sleep', 'Sleep timer', t, { at: mo, label: 930, t0: b(5), t1: PULL + .3, ringR: 22 });
  }

  // bar 3: the dot jumps from the phone's scrubber to the laptop's, at the same second of the book
  if (ph && lap) KN.flyDot(t, HOP[0], HOP[1], ph.at(...ph.ui.knob), lap.at(...lap.ui.knob), { r0: 8 * ph.rig.s, r1: 9 * lap.rig.s, peak: 15, lift: 170 });
  // bar 4: ... and flies home into the icon, which blooms round it
  const [ix, iy, isz] = ICON, [dx, dy, dr] = KN.iconDot(ix, iy, isz);
  if (lap) KN.flyDot(t, PART, HOME, lap.at(...lap.ui.knob), [dx, dy], { r0: 9 * lap.rig.s, r1: dr, peak: 20, lift: 120 });
  // ... and keeps playing: the dot creeps along the icon's track through the hold
  if (t >= HOME) KN.appIcon(ix, iy, isz, springStep(t - HOME, SP.bloom), { track: EASE.outExpo(seg(t, HOME + .06, HOME + .7)), pos: .4 + .05 * ease(seg(t, HOME + .5, DUR)) });

  // the promise: lands under the products, then settles into the end card as its tagline
  const m = follow(t, [[0, 0], [PART + .15, 1, SP.cam]]);
  KN.headline('promise', 'Pick up where you left off.', W / 2, lerp(900, 768, m), t, { t0: HOP[0], size: lerp(60, 46, m), color: mixCol(S.ink, S.mute, m), tracking: lerp(-1.2, 0, m), stagger: .07 });
  KN.headline('name', 'Murmur', W / 2, 672, t, { t0: NAME, size: 124, weight: 700, tracking: -3 });
  CX.restore();
  KN.finish();
}]]);

// ---------- sound, from the same times the picture uses ----------
cue(0, 'swell', { weight: .45, dur: 1.8, id: 'reveal' });
cue(b(2), 'chime', { weight: .35, id: 'screen-wakes' });
cue(b(4), 'tick', { weight: .55, id: 'callout' }); cue(b(5), 'tick', { weight: .55, pitch: 3, id: 'callout' });
cue(PULL, 'whoosh', { weight: .3, dur: .9, id: 'pull-back' });
cue(LIDT, 'click', { weight: .3, id: 'lid-opens' });   // on the beat, as the lid lifts (its settle would land on the dot's swish)
cue(HOP[0], 'swish', { weight: .5, id: 'dot-lifts' }); cue(HOP[1], 'pop', { weight: .7, id: 'dot-lands' });
cue(PART, 'whoosh', { weight: .4, dur: .6, id: 'devices-part' });
cue(springAt(HOME, .5, SP.bloom), 'pop', { weight: .8, pitch: 5, id: 'icon' });
cue(NAME, 'bell', { weight: .55, id: 'name' });
