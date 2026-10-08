// uimorph specimen: one shape, never cut, 4 bars at 120 BPM (8 s), a seamless loop. Something happens on every beat:
// button -> loader -> check -> island -> player (play/pause, scrub) -> volume (dragged past its end) -> tabs (liquid
// indicator) -> chart (draws itself, hover tooltip) -> toast -> button. The cursor drives every change.
const L = DUR, b = tb, INK = UIM.S.ink, WHITE = '#FFFFFF';
const C = [W / 2, H / 2];

// ---------- the cursor (world coordinates; the shape is centred on C) ----------
const PATH = [
  { t: 0, x: 980, y: 880 },
  { t: b(1), x: 790, y: 738, click: true },              // press the button
  { t: b(2.6), x: 900, y: 860 },
  { t: b(5), x: 722, y: 842, click: true },              // play -> pause
  { t: b(6), x: 623, y: 776, hold: [b(6), b(7.25)] },    // grab the playhead...
  { t: b(7.25), x: 880, y: 776 },                        // ...and scrub
  { t: b(8.5), x: 771, y: 720, hold: [b(8.5), b(9.6)] }, // grab the volume knob...
  { t: b(9.6), x: 1074, y: 720 },                        // ...and drag it past the end
  { t: b(10.5), x: 720, y: 722, click: true },           // Week
  { t: b(11.25), x: 912, y: 722, click: true },          // Month
  { t: b(13), x: 747, y: 800 },                          // hover the chart
  { t: b(13.8), x: 934, y: 760 },
  { t: b(14), x: 934, y: 760, click: true },             // save
  { t: b(15.2), x: 980, y: 880 },
  { t: L, x: 980, y: 880 },
];

// ---------- content ----------
const button = B => UIM.label(B, 'Listen', { id: '~button' });
const island = (B, k, t) => { const s = B.h * .58; UIM.art(B.x + (B.h - s) / 2, B.y + (B.h - s) / 2, s);
  UIM.T('~island', 'Chapter Four', B.x + B.h, B.y + B.h * .6, { size: B.h * .26 }); UIM.bars(B.x + B.w - B.h * 1.25, B.y + B.h * .3, B.h * .8, B.h * .4, t, { n: 5 }); };
// the playhead: 32% until play, then advancing; scrubbed by the cursor while held; then advancing from where it was dropped
const RATE = .018, TX = B => [B.x + B.h * .1, B.w - B.h * .2];
function playhead(t, B) {
  const [tx, tw] = TX(B), held = tt => clamp((cursor(tt, PATH).x - tx) / tw);
  if (t < b(5)) return .32; if (t < b(6)) return .32 + (t - b(5)) * RATE;
  if (t <= b(7.25)) return held(t); return held(b(7.25)) + (t - b(7.25)) * RATE;
}
const player = (B, k, t) => {
  const pad = B.h * .1, s = B.h * .36; UIM.art(B.x + pad, B.y + pad, s);
  UIM.T('player:title', 'Chapter Four', B.x + pad * 2 + s, B.y + pad + s * .44, { size: B.h * .1 });
  UIM.T('player:sub', 'The Quiet Hours', B.x + pad * 2 + s, B.y + pad + s * .8, { size: B.h * .088, color: '#9A9893', weight: 500 });
  const [tx, tw] = TX(B), held = t >= b(6) && t <= b(7.25);
  UIM.track(tx, B.y + B.h * .66, tw, playhead(t, B), { h: B.h * .022, knobR: B.h * .03, press: held ? 1 : 0 });
  const ctl = B.y + B.h * .85; UIM.playPause(B.x + B.w / 2, ctl, B.h * .1, seg(t, b(5), b(5) + .18));
  for (const d of [-1, 1]) { const x = B.x + B.w / 2 + d * B.h * .32; CX.fillStyle = WHITE; CX.beginPath(); CX.moveTo(x + d * B.h * .05, ctl); CX.lineTo(x - d * B.h * .03, ctl - B.h * .045); CX.lineTo(x - d * B.h * .03, ctl + B.h * .045); CX.closePath(); CX.fill(); }
};
// the volume: dragged directly while held, stretched past its end, springing back on release
const volume = (B, k, t) => {
  const tx = B.x + B.h, tw = B.w - B.h * 1.4, ty = B.y + B.h / 2;
  const raw = tt => (cursor(tt, PATH).x - tx) / tw;
  const v = drag(t, b(8.5), b(9.6), tt => clamp(raw(tt)), () => clamp(raw(b(9.6))), 'snappy');
  const stretch = drag(t, b(8.5), b(9.6), tt => rubber(Math.max(0, raw(tt) - 1) * tw, 0, 50), () => 0, 'bouncy');
  // speaker icon, same stroke as everything else
  const x = B.x + B.h * .42, y = ty, s = B.h * .16; CX.fillStyle = WHITE; CX.beginPath(); CX.moveTo(x - s, y - s * .5); CX.lineTo(x - s * .4, y - s * .5); CX.lineTo(x + s * .3, y - s * 1.1); CX.lineTo(x + s * .3, y + s * 1.1); CX.lineTo(x - s * .4, y + s * .5); CX.lineTo(x - s, y + s * .5); CX.closePath(); CX.fill();
  CX.save(); CX.lineWidth = UIM.S.stroke; CX.strokeStyle = WHITE; CX.lineCap = 'round'; CX.beginPath(); CX.arc(x + s * .55, y, s * .7, -.8, .8); CX.stroke(); CX.restore();
  UIM.track(tx, ty, tw, v, { h: B.h * .14, knob: false, stretch });
};
const TABS = [[b(10), 0, 1], [b(10.5), 1, 2], [b(11.25), 2, 3]];
const tabsDraw = (B, k, t) => UIM.tabs(B, ['Day', 'Week', 'Month'], edges(t, TABS, { lead: 'snappy' }), { ind: INK, onCol: WHITE, ids: 'tab' });
const DATA = [12, 18, 15, 26, 22, 34, 31, 45, 41, 58, 63, 84];
const chartDraw = (B, k, t) => UIM.chart(B, DATA.map(v => v * 1000), EASE.inOut(seg(t, b(12) + .1, b(13.2))), {
  from: 0, to: 84320, caption: 'minutes listened', id: 'chart', hoverX: lerp(.55, .9, ease(seg(t, b(13), b(13.8)))), hoverP: seg(t, b(12.9), b(13.1)) });
const toast = (B, k, t) => { UIM.check({ x: B.x + B.h * .1, y: B.y, w: B.h * .8, h: B.h }, seg(t, b(14) + .1, b(14) + .45), { size: B.h * .3 });
  UIM.T('toast', 'Saved to your library', B.x + B.h * .95, B.y + B.h * .6, { size: B.h * .25 }); };

// ---------- the states ----------
const STATES = [
  { t: 0, w: 300, h: 96, r: 48, fill: INK, draw: button },
  { t: b(1), w: 96, h: 96, r: 48, fill: INK, draw: (B, k, t) => UIM.spinner(B, t) },
  { t: b(2), w: 96, h: 96, r: 48, fill: INK, draw: (B, k, t) => UIM.check(B, seg(t, b(2) + .05, b(2) + .4)) },
  { t: b(3), w: 520, h: 96, r: 48, fill: INK, draw: island },
  { t: b(4), w: 640, h: 340, r: 44, fill: INK, draw: player },
  { t: b(8), w: 560, h: 96, r: 48, fill: INK, draw: volume },
  { t: b(10), w: 600, h: 100, r: 50, fill: WHITE, draw: tabsDraw },
  { t: b(12), w: 640, h: 440, r: 40, fill: WHITE, draw: chartDraw },
  { t: b(14), w: 520, h: 96, r: 48, fill: INK, draw: toast },
  { t: b(15), w: 300, h: 96, r: 48, fill: INK, draw: button },
];

// ---------- sound cues, from the same times the picture uses ----------
for (const p of PATH) if (p.click) cue(p.t, 'click', { weight: .7, id: 'click' });
cue(springAt(b(2), .5), 'pop', { weight: .8, id: 'check' });
cue(b(6), 'tick', { weight: .5, id: 'grab' }); cue(b(7.25), 'tick', { weight: .4, id: 'drop' });
cue(b(8.5), 'tick', { weight: .5, id: 'grab' }); cue(b(9.6), 'snap', { weight: .8, id: 'release' });
cue(b(12) + .1, 'riser', { weight: .5, dur: 1.1, id: 'chart' }); cue(b(13.2), 'chime', { weight: .6, id: 'chart-done' });
cue(springAt(b(14) + .1, .5), 'pop', { weight: .9, id: 'toast' });
// no sound on every morph: the clicks and pops carry it, and the music fills the beat (video-sound's sound-design rules)

shots([[0, t => UIM.film(t, STATES, { cursor: PATH, loop: L, fill: .6 })]]);
