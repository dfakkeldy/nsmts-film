// The harness's own smoke test: a pill that springs between three widths on the beat, a liquid two-edge
// highlight, a word reveal, a cursor click, and sound cues. One continuous shot; the last frame equals the first.
const KEYS = [[0, 360], [tb(2), 980], [tb(4), 620], [tb(6), 360]];
const BAR = [[0, 0, 1], [tb(2), 1, 2], [tb(4), 0, 1], [tb(6), 0, 1]];
for (const [t] of KEYS.slice(1)) { cue(t, 'whoosh', { weight: .5, id: 'pill' }); cue(springAt(t, .97, 'snappy'), 'tick', { weight: .6 }); }
cue(tb(1), 'click', { id: 'press' });
const PATH = [{ t: 0, x: 1500, y: 860 }, { t: tb(1), x: 1040, y: 560, click: true }, { t: tb(5), x: 1180, y: 620 }, { t: 4, x: 1500, y: 860 }];
shots([[0, (t) => {
  bg();
  const w = follow(t, KEYS, 'snappy'), h = 120, x = W / 2 - w / 2, y = H / 2 - h / 2;
  box(x, y, w, h, h / 2, PAL.ink, { shadow: { blur: 50, y: 18, color: 'rgba(0,0,0,.22)' } });
  // the highlight: three equal cells, the active cell's edges on different springs (lead stretches ahead)
  const cell = (w - 24) / 3, [a, b] = edges(t, BAR.map(([t0, i0, i1]) => [t0, i0, i1]), { lead: 'snappy' });
  box(x + 12 + a * cell, y + 12, (b - a) * cell, h - 24, (h - 24) / 2, '#FFFFFF', { alpha: .14 });
  const labels = ['Listen', 'Mark', 'Loop'];
  labels.forEach((s, i) => text(w > 700 ? `tab${i}` : null, s, x + 12 + cell * (i + .5), y + h / 2 + 14, { size: 40, color: '#fff', align: 'center', alpha: clamp((w - 600) / 200) }));
  const p = cursor(t, PATH);
  CX.save(); CX.translate(p.x, p.y); CX.scale(1 - .15 * p.press, 1 - .15 * p.press);
  CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(0, 44); CX.lineTo(12, 33); CX.lineTo(22, 54); CX.lineTo(30, 50); CX.lineTo(20, 30); CX.lineTo(36, 30); CX.closePath();
  CX.fillStyle = '#111'; CX.fill(); CX.lineWidth = 3; CX.strokeStyle = '#fff'; CX.stroke(); CX.restore();
  words('title', 'Every frame is a function of time', W / 2, 250, .3, t < 3.2 ? t : 3.2 - (t - 3.2) * 4, { size: 64, align: 'center', weight: 600 });
}]]);
LOOPS.hello = t => SHOTS[0][1](t, t, 4); LOOPS.hello.len = 4;
