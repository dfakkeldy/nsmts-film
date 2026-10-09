// film.js: "NS Marks The Spot", a portfolio film for Dan Fakkeldy (96 s, 90 BPM). A book of numbered plates on paper
// (looks/plates.js): drawn figures, stills from the live map, and recordings of the live site shown inside engraved
// frames (a desktop window, a phone). The paper never cuts; it turns. One survey mark carries through and lands on
// Dan's name. Times come from the narration (sound/words/film-v1.json) and the beat sheet (brief/beat-sheet.md).

const { add } = PLT;
const INK = PLT.S.ink, RED = PLT.S.red, GRA = PLT.S.graphite, PAPER = PLT.S.paper, U = PLT.u;

// ---------- the plan ----------
// Pages slide across the fixed paper (a turn); SLIDES[k] is when page k leaves and page k + 1 arrives.
const SLIDES = [10.45, 13.35, 30.55, 39.55, 45.75, 66.75, 88.95], SLIDE = .6;
const WIN = [300, 118, 1320, 742];                       // the desktop window (16:9, the takes' aspect)
const SCR = [W / 2 - 171.5, 118, 343, 742];               // the phone's screen (390 x 844 points, scaled)
const WIPE = .4;                                          // a take change inside a window

// FIG. captions: [t, number, name, typeAt]; a null name clears the caption. A name that extends the one before it
// under the same number keeps typing instead of being struck back.
const FIGS = [
  [0, '1', 'Mabou Highlands, 1880s', -1.0],
  [5.38, '1', 'Mabou Highlands, 1880s · today'],
  [10.45, null, null],
  [13.33, '2', 'Where the data lives'],
  [21.97, '2', 'Queried live'],
  [25.81, '2', '100+ layers, each cited'],
  [31.17, '3', 'One parcel, many sources'],
  [39.75, '4', 'Georeferencing'],
  [41.93, '4.1', 'Three control points'],
  [46.21, '4.2', 'Residuals'],
  [50.13, '4.3', 'Curved warp'],
  [54.09, '4.4', '24 Fletcher sheets'],
  [58.13, '5', 'Small-hydro screening'],
  [61.0, '5', 'Bare-earth viewshed'],
  [64.29, '6', 'GeoPDF out'],
  [67.29, '6', 'GeoPDF in'],
  [70.37, '7', 'Field log'],
  [76.39, '8', 'Pocket map'],
  [78.95, '8', 'Driveway measured'],
  [81.67, '8', 'Offline'],
  [86.2, '9', 'iPhone, in TestFlight'],
  [88.95, null, null],
];

const VOICE = captions.load('sound/words/film-v1.json');
// one subtitle window a sentence, so a card never carries the end of one sentence into the next
const SUB_STYLE = { color: INK, plate: false, edge: 'none', size: 44 };
const SUBS = [[0, 'subtitle', SUB_STYLE],
  ...VOICE.words.filter((w, i, a) => i > 0 && /[.!?]$/.test(a[i - 1].w)).map(w => [w.start - .001, 'subtitle', SUB_STYLE]), [88.9, null]];
captions.check(SUBS);

// ---------- images ----------
const IM = {
  y1884: img('assets/stills/highlands-1884.png'), today: img('assets/stills/highlands-today.png'),
  sheetToday: img('assets/stills/sheet16-today.png'), scan: img('assets/scans/Fletcher sheet 16, Mabou (1884).jpg'),
  icon: img('assets/brand/app-icon.png'), logo: img('assets/brand/logo-mark-light.png'),
};

// ---------- small tools ----------
// takeTime(t, pairs): film time to a take's own time, piecewise linear through [[film t, take t], ...], held at the ends
function takeTime(t, pairs) {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let i = 1; i < pairs.length; i++) if (t <= pairs[i][0]) return lerp(pairs[i - 1][1], pairs[i][1], invLerp(pairs[i - 1][0], pairs[i][0], t));
  return pairs[pairs.length - 1][1];
}
// cropAt(t, keys, box): a push-in inside a take: keys [[t, [x, y, w]], ...] eased between; the height follows the box
function cropAt(t, keys, box) {
  const [x, y, w] = keys.length === 1 ? keys[0][1] : kf(t, keys, EASE.inOut);
  return [x, y, w, w * box[3] / box[2]];
}
const hasTake = name => typeof FOOTAGE !== 'undefined' && !!FOOTAGE[name];
async function clipped(r, fn) { CX.save(); CX.beginPath(); CX.rect(r[0], r[1], r[2], r[3]); CX.clip(); try { await fn(); } finally { CX.restore(); } }

// mark(c, r, p): the survey mark, a control-point cross: a circle drawn round, then the cross through it
function mark(c, r, p, o = {}) {
  if (p <= 0) return;
  const col = o.col || RED, lw = o.lw || 3 * U, kc = EASE.outExpo(seg(p, 0, .6)), kx = EASE.outExpo(seg(p, .3, 1));
  CX.save(); CX.globalAlpha *= o.alpha ?? 1; CX.strokeStyle = col; CX.lineWidth = lw; CX.lineCap = 'round';
  CX.beginPath(); CX.arc(c[0], c[1], r, -Math.PI / 2, -Math.PI / 2 + TAU * kc); CX.stroke();
  const e = r * 1.6 * kx; CX.beginPath();
  CX.moveTo(c[0] - e, c[1]); CX.lineTo(c[0] + e, c[1]); CX.moveTo(c[0], c[1] - e); CX.lineTo(c[0], c[1] + e); CX.stroke();
  CX.restore();
  if (kx > 0) circle(c[0], c[1], 2.4 * U * kx, col, { alpha: o.alpha });
}
// frameRect(b, p): an engraved frame: a rule at the edge, a hairline outside it, small corner ticks; drawn on over p
function frameRect(b, p = 1, o = {}) {
  if (p <= 0) return;
  const [x, y, w, h] = b, g = 9 * U, k = EASE.inOut(clamp(p));
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  lineTo(rect(x, y, x + w, y + h), k, INK, o.lw || 2 * U);
  lineTo(rect(x - g, y - g, x + w + g, y + h + g), k, GRA, 1.1 * U);
  if (k >= 1) for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
    line([[cx + sx * g, cy + sy * (g + 6 * U)], [cx + sx * g, cy + sy * (g + 16 * U)]], GRA, 1.1 * U);
    line([[cx + sx * (g + 6 * U), cy + sy * g], [cx + sx * (g + 16 * U), cy + sy * g]], GRA, 1.1 * U);
  }
}
// wipeLine(x, b): the line that carries a take change across a window
function wipeLine(x, b, a = 1) {
  if (a <= .01) return;
  line([[x, b[1] - 14 * U], [x, b[1] + b[3] + 14 * U]], INK, 2 * U, { alpha: a });
  for (const [y, s] of [[b[1] - 14 * U, -1], [b[1] + b[3] + 14 * U, 1]]) PLT.shape([[x, y], [x - 7 * U, y + s * 11 * U], [x + 7 * U, y + s * 11 * U]], { fill: RED, alpha: a });
}
// a loupe over a take: `at` is a point in the take's pixels. The glass sits over where that point is drawn and shows
// the take around it mag times larger, drawn from the take's own frame so the text it reads stays sharp.
async function footLens(name, tl, crop, box, at, r, mag, o = {}) {
  const a = o.alpha ?? 1; if (a <= .01) return;
  const k = box[2] / crop[2], x = box[0] + (at[0] - crop[0]) * k + (o.dx || 0), y = box[1] + (at[1] - crop[1]) * k + (o.dy || 0);
  const tp = [crop[0] + (x - box[0]) / k, crop[1] + (y - box[1]) / k], half = r / (k * mag);
  CX.save(); CX.globalAlpha *= a; CX.beginPath(); CX.arc(x, y, r, 0, TAU); CX.clip();
  CX.fillStyle = PAPER; CX.fillRect(x - r, y - r, 2 * r, 2 * r);
  await footage(name, tl, [x - r, y - r, 2 * r, 2 * r], { crop: [tp[0] - half, tp[1] - half, 2 * half, 2 * half] });
  CX.restore();
  PLT.lens(x, y, r, { mag: 1, barrel: 0, lift: o.lift ?? .2, alpha: a });
}
// a loupe that glides in from below right and settles; with t1, it lifts and leaves the way it came from t1
const glide = (t, t0, t1 = Infinity) => {
  const out = isFinite(t1) ? seg(t, t1, t1 + .45) : 0, k = EASE.glide(seg(t, t0, t0 + .55)) - EASE.exit(out);
  return { alpha: Math.min(seg(t, t0, t0 + .2), 1 - (isFinite(t1) ? seg(t, t1 + .25, t1 + .45) : 0)), dx: (1 - k) * 220 * U, dy: (1 - k) * 160 * U, lift: lerp(.9, .2, k) };
};

// a take, or its placeholder while it is still to record
async function take(name, tl, box, crop) {
  if (hasTake(name)) return footage(name, tl, box, { crop });
  CX.save(); CX.fillStyle = 'rgba(133,126,113,.10)'; CX.fillRect(box[0], box[1], box[2], box[3]); CX.restore();
  PLT.hatch([[box[0], box[1]], [box[0] + box[2], box[1]], [box[0] + box[2], box[1] + box[3]], [box[0], box[1] + box[3]]], .8, 22 * U, { col: GRA, alpha: .25 });
  PLT.label('~ph', `${name} · to record`, box[0] + box[2] / 2, box[1] + box[3] / 2, { size: 30 * U, align: 'center', color: GRA });
}
// clips(t, list, box): a sequence of takes in one window; each change wipes right to left, centred on its t0.
// list: [{ t0, name, T (remap pairs), C (crop keys), draw (optional, instead of a take) }]
async function clips(t, list, box) {
  let i = 0; while (i + 1 < list.length && t >= list[i + 1].t0 - WIPE / 2) i++;
  const one = async (c) => c.draw ? c.draw(t, box) : take(c.name, takeTime(t, c.T), box, cropAt(t, c.C, box));
  const k = i > 0 ? EASE.inOut(seg(t, list[i].t0 - WIPE / 2, list[i].t0 + WIPE / 2)) : 1;
  if (k >= 1) return clipped(box, () => one(list[i]));
  const lx = box[0] + box[2] * (1 - k);
  await clipped([box[0], box[1], lx - box[0], box[3]], () => one(list[i - 1]));
  await clipped([lx, box[1], box[0] + box[2] - lx, box[3]], () => one(list[i]));
  wipeLine(lx, box);
}
const clipAt = (t, list) => { let i = 0; while (i + 1 < list.length && t >= list[i + 1].t0) i++; return list[i]; };

// ---------- page 0: the cold open (0-10.45) ----------
// Both stills are the same view (the Mabou Highlands on Fletcher's sheet 14, 46.158 N 61.36 W, zoom 13, framed north of
// the gap at the sheets' join), 2800 x 1576 px; the view's centre sits at (1440, 894) px, and the push-in scales about
// it, so the seam and the mark stay put.
const MB = [1440, 894], KS = WIN[2] / 2800, MABOU = [WIN[0] + MB[0] * KS, WIN[1] + MB[1] * KS], SEAM = MABOU[0];
function coldOpen(t) {
  const z = lerp(1, 1.07, ease(seg(t, 0, 10.6))), crop = [MB[0] - MB[0] / z, MB[1] - MB[1] / z, 2800 / z, 1576 / z];
  const x0 = WIN[0], x1 = WIN[0] + WIN[2];
  const lx = t < 6.6 ? lerp(x1, x0, EASE.inOut(seg(t, 3.9, 5.38))) : lerp(x0, SEAM, EASE.inOut(seg(t, 6.6, 8.2)));
  const still = (im, a, b) => { if (b - a < .5) return; CX.save(); CX.beginPath(); CX.rect(a, WIN[1], b - a, WIN[3]); CX.clip();
    CX.drawImage(im, crop[0], crop[1], crop[2], crop[3], WIN[0], WIN[1], WIN[2], WIN[3]); CX.restore(); };
  still(IM.y1884, x0, lx); still(IM.today, lx, x1);
  wipeLine(lx, WIN, clamp(Math.min(lx - x0, x1 - lx) / (30 * U)));
  frameRect(WIN, 1);
  // the halves named, once they sit side by side
  const la = seg(t, 8.0, 8.5);
  if (la > 0) {
    PLT.label('l1884', 'Fletcher, 1884', SEAM - 24 * U, WIN[1] + WIN[3] - 26 * U, { size: 32 * U, align: 'right', alpha: la });
    PLT.label('ltoday', 'Today', SEAM + 24 * U, WIN[1] + WIN[3] - 26 * U, { size: 32 * U, alpha: la });
  }
  mark(MABOU, 24 * U, seg(t, 9.85, 10.55));
}

// ---------- page 1: the title (10.45-13.0) ----------
function titlePage(t) {
  mark([W / 2, 380 * U], 32 * U, seg(t, 10.6, 11.3));
  const a = EASE.punch(seg(t, 10.7, 11.2));
  PLT.label(a > .9 ? 'title' : null, 'NS Marks The Spot', W / 2, 560 * U, { size: 124 * U, weight: 500, align: 'center', alpha: a, blur: (1 - a) * 12 });
  const r = EASE.inOut(seg(t, 11.2, 11.8)) * 360 * U;
  if (r > 1) line([[W / 2 - r, 610 * U], [W / 2 + r, 610 * U]], GRA, 1.2 * U);
}

// ---------- page 2: where the data lives (13.0-30.55) ----------
// Nova Scotia (assets/geo/ns-outline.js: Natural Earth, equirectangular at 45.2 N, 1000 units wide) and four real endpoints the map
// queries, one per kind the voice names, each with its host, protocol and licence as the app records them.
const NO = [170, 236], NSK = .62;
const nsPt = (lon, lat) => [NO[0] + (lon - NS_LONLAT.lon0) * NS_LONLAT.k * NS_LONLAT.s * NSK, NO[1] + (NS_LONLAT.lat0 - lat) * NS_LONLAT.s * NSK];
const NSR = NS_OUTLINE.map(r => [...r, r[0]].map(([x, y]) => [NO[0] + x * NSK, NO[1] + y * NSK]));
const NSBOX = [NO[0], NO[1], NS_BOX[0] * NSK, NS_BOX[1] * NSK];
const nsRegion = () => { CX.beginPath(); for (const r of NSR) { r.forEach(([x, y], i) => i ? CX.lineTo(x, y) : CX.moveTo(x, y)); CX.closePath(); } };
const MAB_NS = nsPt(-61.39, 46.07);
const ENDS = [
  { t: 17.01, name: 'Province of Nova Scotia', host: 'nsgiwa.novascotia.ca', proto: 'ArcGIS REST', lic: 'Province licence' },
  { t: 18.85, name: 'Nova Scotia open data', host: 'data.novascotia.ca', proto: 'Socrata API', lic: 'OGL – Nova Scotia' },
  { t: 20.09, name: 'Environment Canada', host: 'geo.weather.gc.ca', proto: 'OGC WMS', lic: 'ECCC end-use licence' },
  { t: 20.57, name: 'Inverness County zoning', host: 'services5.arcgis.com', proto: 'ArcGIS feature service', lic: 'No stated licence' },
];
const EY = [300, 455, 610, 765].map(y => y * U), EX = 1000 * U;
function dataPlate(t) {
  const po = seg(t, 13.33, 15.3);
  for (const r of NSR) lineTo(r, EASE.inOut(po), INK, 2 * U);
  PLT.hatch(nsRegion, -.62, 7 * U, { box: NSBOX, anchor: NO, p: seg(t, 14.7, 16.5), col: GRA, lw: 1 * U, alpha: .55 });
  // more than a hundred layers: the land engraved over and over as the layers stack up
  [[.35, 9, 25.9], [1.15, 11, 26.35], [-1.3, 13, 26.8]].forEach(([a, g, t0]) =>
    PLT.hatch(nsRegion, a, g * U, { box: NSBOX, anchor: NO, p: seg(t, t0, t0 + .7), col: GRA, lw: .9 * U, alpha: .32 }));
  mark(MAB_NS, 16 * U, seg(t, 15.6, 16.3));
  ENDS.forEach((e, i) => {
    const p = seg(t, e.t - .15, e.t + .75), y = EY[i];
    if (p <= 0) return;
    PLT.leader(null, '', MAB_NS, [EX - 40 * U, y - 11 * U], p, { label: false, shelf: 26 * U, dot: 0 });
    const a = EASE.punch(seg(p, .55, 1));
    PLT.label(a > .9 ? `e${i}` : null, e.name, EX, y, { size: 36 * U, alpha: a, blur: (1 - a) * 8 });
    const q = EASE.punch(seg(t, 23.41 + i * .1, 23.9 + i * .1));
    const host = q > 0 ? `${e.host} · ${e.proto}` : e.host;
    PLT.label(a > .9 ? `h${i}` : null, host, EX, y + 40 * U, { family: 'Space Grotesk', weight: 500, size: 28 * U, color: GRA, alpha: a });
    const l = EASE.punch(seg(t, 24.53 + i * .12, 25.0 + i * .12));
    if (l > 0) PLT.label(l > .9 ? `lic${i}` : null, e.lic.toUpperCase(), EX, y + 80 * U, { weight: 600, size: 28 * U, tracking: 2.5 * U, color: RED, alpha: l, blur: (1 - l) * 8 });
  });
  const h = EASE.punch(seg(t, 27.0, 27.45));
  if (h > 0) {
    PLT.label(h > .9 ? 'hundred' : null, '100+', 560 * U, 760 * U, { weight: 500, size: 132 * U, color: RED, alpha: h, blur: (1 - h) * 10 });
    PLT.label(h > .9 ? 'layers' : null, 'layers', 566 * U, 812 * U, { size: 38 * U, alpha: h });
  }
}

// ---------- page 3: one parcel (30.55-39.55) ----------
// R1: 5471 Highway 19, Judique (PID 50169663), searched and opened; the sheet scrolls through its checks. The loupe
// reads the water check's empty result, "No mapped water feature intersects this parcel."
const R1T = [[30.55, 2.0], [33.0, 4.3], [38.4, 15.6]];
const R1C = [[32.6, [0, 0, 1320]], [33.6, [600, 100, 1320]]];
const R1_EMPTY = [1700, 312];                              // "No mapped water feature..." at take time 15.6 s
async function parcelPage(t) {
  const tl = takeTime(t, R1T), crop = cropAt(t, R1C, WIN);
  await clipped(WIN, () => take('r1-parcel', tl, WIN, crop));
  frameRect(WIN, 1);
  if (t > 38.4 && hasTake('r1-parcel')) await footLens('r1-parcel', tl, crop, WIN, R1_EMPTY, 165 * U, 1.5, glide(t, 38.45));
}

// ---------- page 4: georeferencing, the idea (39.55-45.75) ----------
// Sheet 16's scan (3000 x 2087 px) beside today's map (the still at 46.035 N 61.42 W, zoom 11, 2800 x 1576 px at 2x:
// the map container's centre is at CSS (1120, 517) and the still's crop starts at CSS (400, 70)). Three of the sheet's
// real control points (graticule crossings, from its points file) pair across, then the scan drapes onto the map by
// the affine transform those three points fix.
const PL = [150 * U, 214 * U, 760 * U, 528 * U], PR = [1010 * U, 214 * U, 760 * U, 528 * U];
const SC = [250, 80, 2500, 1737];
const GCP = [[[983.0, 391.4], -61.5, 46.083333], [[1975.1, 398.1], -61.333333, 46.083333], [[1479.5, 1117.4], -61.416667, 46.0]];
const WORLD = 256 * 2 ** 11, merX = lon => WORLD * (lon + 180) / 360;
const merY = lat => { const r = lat * Math.PI / 180; return WORLD * (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; };
const stillPx = (lon, lat) => [2 * (1120 + merX(lon) - merX(-61.42) - 400), 2 * (517 + merY(lat) - merY(46.035) - 70)];
// affine [a, b, c, d, e, f] (x' = a x + c y + e, y' = b x + d y + f) through three point pairs
function affine3(P, Q) {
  const [[x1, y1], [x2, y2], [x3, y3]] = P, D = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
  const solve = (v1, v2, v3) => [(v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / D, (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / D,
    (v1 * (x2 * y3 - x3 * y2) + v2 * (x3 * y1 - x1 * y3) + v3 * (x1 * y2 - x2 * y1)) / D];
  const [a, c, e] = solve(Q[0][0], Q[1][0], Q[2][0]), [b, d, f] = solve(Q[0][1], Q[1][1], Q[2][1]);
  return [a, b, c, d, e, f];
}
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const SP = GCP.map(g => g[0]), MP = GCP.map(g => stillPx(g[1], g[2]));
const A_SM = affine3(SP, MP);                                     // scan px -> still px
// the map panel's crop: the scan crop's footprint on the map, padded, at the panel's aspect
const MC = (() => {
  const cs = [[SC[0], SC[1]], [SC[0] + SC[2], SC[1]], [SC[0], SC[1] + SC[3]], [SC[0] + SC[2], SC[1] + SC[3]]].map(p => apply(A_SM, p));
  const xs = cs.map(p => p[0]), ys = cs.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let w = (Math.max(...xs) - Math.min(...xs)) * 1.7, h = w * PR[3] / PR[2];
  if (h > 1576) { h = 1576; w = h * PR[2] / PR[3]; }                // kept inside the still (2800 x 1576)
  return [clamp(cx - w / 2, 0, 2800 - w), clamp(cy - h / 2, 0, 1576 - h), w, h];
})();
const M_SCREEN = [PR[2] / MC[2], 0, 0, PR[3] / MC[3], PR[0] - MC[0] * PR[2] / MC[2], PR[1] - MC[1] * PR[3] / MC[3]];   // still px -> screen
const A0 = [PL[2] / SC[2], 0, 0, PL[3] / SC[3], PL[0] - SC[0] * PL[2] / SC[2], PL[1] - SC[1] * PL[3] / SC[3]];       // scan px -> left panel
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const A1 = mul(M_SCREEN, A_SM);                                   // scan px -> the map panel, draped
const MAPMARK = MP.map(p => apply(M_SCREEN, p));
const PAIR_T = [42.97, 43.2, 43.43];
function georefPlate(t) {
  CX.drawImage(IM.sheetToday, MC[0], MC[1], MC[2], MC[3], PR[0], PR[1], PR[2], PR[3]);
  frameRect(PR, 1);
  PLT.label('lmap', "Today's map", PR[0], PR[1] - 22 * U, { size: 30 * U });
  const drop = seg(t, 41.95, 42.5), k = EASE.inOut(seg(t, 44.1, 45.4));
  PLT.label(k < .5 ? 'lscan' : null, 'Fletcher sheet 16, 1884', PL[0], PL[1] - 22 * U, { size: 30 * U, alpha: 1 - seg(k, 0, .5) });
  if (drop <= 0) { CX.save(); CX.setLineDash([9 * U, 7 * U]); CX.strokeStyle = GRA; CX.lineWidth = 1.4 * U; CX.strokeRect(PL[0], PL[1], PL[2], PL[3]); CX.restore(); }
  else {
    // the scan drops into its frame (a slight scale and a shadow that tightens), then drapes onto the map
    const s = lerp(1.06, 1, EASE.outExpo(drop)), c = [PL[0] + PL[2] / 2, PL[1] + PL[3] / 2];
    const Sd = [s, 0, 0, s, c[0] - s * c[0], c[1] - s * c[1]], A = mul(Sd, A0).map((v, i) => lerp(v, A1[i], k));
    if (drop < 1) PLT.contact(c[0], c[1] + PL[3] * .52, PL[2] * .5, 22 * U, .25 * (1 - drop));
    const cr = PL.map((v, i) => lerp(v, PR[i], k));
    CX.save(); CX.beginPath(); CX.rect(cr[0], cr[1], cr[2], cr[3]); CX.clip(); CX.globalAlpha = lerp(EASE.outExpo(drop), .72, k);
    CX.transform(...A); CX.drawImage(IM.scan, 0, 0); CX.restore();
    if (k < 1) frameRect(cr, 1);
    // the three control points, paired across, carried by the drape onto their places on the map
    SP.forEach((sp, i) => {
      const p = seg(t, PAIR_T[i], PAIR_T[i] + .5); if (p <= 0) return;
      const a = apply(A, sp), b = MAPMARK[i], m = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 90 * U];
      const arc = Array.from({ length: 25 }, (_, j) => { const u = j / 24; return [(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * m[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * m[1] + u * u * b[1]]; });
      if (k < 1) PLT.construct(arc, EASE.inOut(seg(t, PAIR_T[i] + .1, PAIR_T[i] + .7)), { alpha: 1 - k });
      mark(b, 13 * U, seg(t, PAIR_T[i] + .15, PAIR_T[i] + .75));
      mark(a, 13 * U, p);
    });
  }
}

// ---------- page 5: the desktop takes (45.75-66.75) ----------
// R2 the georeferencer (residuals; the curved warp), R3 the sheets on 3D terrain, R4 small hydro, R5 the viewshed,
// R6 the GeoPDF export (the framing, then the dialog).
const TAKES_B = [
  { t0: 45.75, name: 'r2-georef', T: [[45.75, .2], [51.8, 3.55], [54.25, 7.95]], C: [[0, [0, 0, 1500]]],
    lens: { at: [700, 201], t0: 48.25, t1: 49.9, r: 130, mag: 1.8 } },
  { t0: 54.05, name: 'r3-terrain', T: [[53.85, .6], [57.8, 5.0]], C: [[0, [330, 0, 1590]]] },
  { t0: 57.6, name: 'r4-hydro', T: [[57.4, 3.0], [59.57, 4.8], [61.2, 6.5]], C: [[59.3, [600, 60, 1100]], [60.1, [820, 120, 800]]] },
  { t0: 61.0, name: 'r5-viewshed', T: [[60.8, .3], [62.6, 2.6], [64.4, 5.9]], C: [[62.5, [500, 160, 1400]], [63.2, [800, 380, 1110]]] },
  { t0: 64.2, name: 'r6-export', T: [[64.0, 3.4], [65.35, 6.0]], C: [[0, [0, 0, 1920]]] },
  { t0: 65.15, name: 'r6-export', T: [[64.95, 8.3], [66.2, 11.3], [67.4, 14.0]], C: [[0, [480, 230, 960]]] },
];
async function desktopPage(t) {
  await clips(t, TAKES_B, WIN);
  frameRect(WIN, 1);
  const c = clipAt(t, TAKES_B);
  if (c.lens && t > c.lens.t0 && t < (c.lens.t1 ?? Infinity) + .5 && hasTake(c.name)) await footLens(c.name, takeTime(t, c.T), cropAt(t, c.C, WIN), WIN, c.lens.at, c.lens.r * U, c.lens.mag, glide(t, c.lens.t0, c.lens.t1));
}

// ---------- page 6: the phone (66.75-88.95) ----------
// R7 a GeoPDF on the phone with the location dot, R8 field logging, R9 the pocket map (Poker), then the iPhone app:
// its real icon in the engraved phone, no app screens.
const BODY = [SCR[0] - 18 * U, SCR[1] - 18 * U, SCR[2] + 36 * U, SCR[3] + 36 * U];
function phoneBody() {
  const [x, y, w, h] = BODY;
  CX.save(); CX.lineJoin = 'round';
  rr(x, y, w, h, 54 * U); CX.strokeStyle = INK; CX.lineWidth = 2.6 * U; CX.stroke();
  rr(x - 8 * U, y - 8 * U, w + 16 * U, h + 16 * U, 60 * U); CX.strokeStyle = GRA; CX.lineWidth = 1.1 * U; CX.stroke();
  rr(SCR[0], SCR[1], SCR[2], SCR[3], 38 * U); CX.strokeStyle = INK; CX.lineWidth = 1.2 * U; CX.stroke();
  CX.restore();
  for (const [yy, hh] of [[250, 60], [330, 60]]) line([[x - 8 * U, (yy) * U], [x - 8 * U, (yy + hh) * U]], INK, 3.2 * U);   // volume buttons
  line([[x + w + 8 * U, 300 * U], [x + w + 8 * U, 400 * U]], INK, 3.2 * U);                                              // side button
}
function iosScreen(t) {
  const c = [W / 2, 400 * U], s = 168 * U, a = EASE.punch(seg(t, 86.3, 86.85));
  CX.save(); CX.globalAlpha = a; rr(c[0] - s / 2, c[1] - s / 2, s, s, s * .225); CX.clip();
  CX.drawImage(IM.icon, c[0] - s / 2, c[1] - s / 2, s, s); CX.restore();
  PLT.label(a > .9 ? 'appname' : null, 'NS Marks The Spot', c[0], c[1] + s / 2 + 44 * U, { family: 'Space Grotesk', weight: 500, size: 28 * U, align: 'center', alpha: a });
}
// The phone takes, as clips with a wipe between steps. r78-field is one session (R7 then R8); r9-poker is Poker.
// Left out on purpose: R7's zoom from 4.5 to 6.4 s (the software renderer draws the location dot at full map scale
// until the zoom settles), R8's blank frame mid-scroll (~21 s), and R9's typing (0.5-1.9 s), whose suggestion list
// shows other real addresses.
const PF = [[0, [0, 0, 1170]]], R78 = 'r78-field', R9 = 'r9-poker';
const TAKES_P = [
  { t0: 66.75, name: R78, T: [[67.0, 0], [67.6, .75], [68.0, 1.1], [68.3, 2.6], [68.5, 3.0], [69.2, 4.4]], C: PF },
  { t0: 69.25, name: R78, T: [[69.05, 6.5], [70.5, 6.85]], C: PF },
  { t0: 70.3, name: R78, T: [[70.1, 6.85], [71.6, 7.7]], C: PF },                          // a point
  { t0: 71.75, name: R78, T: [[71.55, 10.4], [72.4, 12.4], [72.6, 13.1]], C: PF },         // a photo
  { t0: 72.75, name: R78, T: [[72.55, 15.5], [73.75, 19.4]], C: PF },                      // a track
  { t0: 73.9, name: R78, T: [[73.7, 21.6], [76.3, 23.9]], C: PF },                         // the layers, and export
  { t0: 76.1, name: R9, T: [[76.0, 0], [77.3, .45]], C: PF },
  { t0: 77.45, name: R9, T: [[77.25, 1.95], [78.2, 2.5], [78.95, 2.95], [79.6, 4.6], [80.3, 6.2], [81.0, 8.0], [81.75, 9.9]], C: PF, blur: [4.75, 10.45] },
  { t0: 81.9, name: R9, T: [[81.7, 10.5], [83.6, 12.3], [86.4, 14.85]], C: PF },           // offline
  { t0: 86.2, draw: (t) => iosScreen(t) },
];
// Neighbours' civic numbers on the aerial (take pixels, centres): blurred while the aerial is on. 5471 stays.
const R9_LABELS = [[1102, 432, 4], [324, 824, 4], [240, 1200, 2], [94, 1510, 2], [438, 1542, 2], [426, 1672, 2], [838, 1676, 4], [124, 1676, 2],
  [438, 1814, 2], [156, 1868, 2], [860, 1886, 4], [418, 1952, 2], [116, 2020, 2], [422, 2094, 2], [714, 2110, 4], [428, 2204, 2], [440, 2444, 2],
  [738, 2450, 4], [456, 2514, 2]];
const PK = SCR[2] / 1170, phonePt = ([x, y]) => [SCR[0] + x * PK, SCR[1] + y * PK];
async function blurLabels(c, t) {
  if (!c.blur || !hasTake(c.name)) return; const tl = takeTime(t, c.T); if (tl < c.blur[0] || tl > c.blur[1]) return;
  for (const [x, y, n] of R9_LABELS) {
    const w = n === 4 ? 112 : 70, h = 62, a = phonePt([x - w / 2, y - h / 2]);
    CX.save(); CX.filter = `blur(${(5 * U).toFixed(1)}px)`;
    await footage(c.name, tl, [a[0] - 3, a[1] - 3, w * PK + 6, h * PK + 6], { crop: [x - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20] });
    CX.restore();
  }
}
async function phonePage(t) {
  CX.save(); rr(SCR[0], SCR[1], SCR[2], SCR[3], 38 * U); CX.clip();
  await clips(t, TAKES_P, SCR);
  const c = clipAt(t, TAKES_P); await blurLabels(c, t);
  CX.restore();
  phoneBody();
  // notes beside the phone: each a leader from the thing on the screen to an engraved label
  const note = (id, str, at, y, t0, t1, o = {}) => {
    const p = seg(t, t0, t0 + .7) * (1 - seg(t, t1, t1 + .25)); if (p <= 0) return;
    PLT.leader(null, '', at, [1210 * U, y], Math.min(p, 1), { label: false, shelf: 26 * U, col: o.col });
    const a = EASE.punch(seg(t, t0 + .35, t0 + .8)) * (1 - seg(t, t1, t1 + .25));
    PLT.label(a > .9 ? id : null, str, 1250 * U, y + 11 * U, { size: 34 * U, alpha: a, blur: (1 - Math.min(1, a)) * 8 });
    if (o.sub) PLT.label(a > .9 ? id + 's' : null, o.sub, 1250 * U, y + 52 * U, { weight: 600, size: 28 * U, tracking: 2 * U, color: RED, alpha: a });
  };
  // (the dot holds its place into the next step, and the trace its place through the offline reload)
  note('you', 'You are here,', phonePt([585, 1263]), 470 * U, 69.2, 71.95, { sub: 'ON THE 1884 SHEET' });
  note('drive', 'Driveway: 36.2 m', phonePt([1035, 1150]), 420 * U, 80.55, 83.0);
  const off = seg(t, 81.75, 82.1) * (1 - seg(t, 86.0, 86.2));
  if (off > 0) PLT.label(off > .9 ? 'netoff' : null, 'Network off (airplane mode)', 1250 * U, 250 * U, { family: 'Space Grotesk', weight: 500, size: 28 * U, color: GRA, alpha: off });
  note('offline', 'Offline · Atlas', phonePt([870, 2463]), 700 * U, 83.0, 86.0, { sub: 'THE SAVED COPY' });
  // the app, annotated once it is on the screen
  const p = seg(t, 86.4, 87.2);
  if (p > 0) {
    PLT.leader(null, '', [W / 2 + 96 * U, 360 * U], [1320 * U, 300 * U], p, { label: false, shelf: 28 * U });
    const a = EASE.punch(seg(p, .55, 1));
    PLT.label(a > .9 ? 'native' : null, 'Native iPhone app', 1360 * U, 312 * U, { size: 36 * U, alpha: a, blur: (1 - a) * 8 });
    PLT.label(a > .9 ? 'tf' : null, 'IN TESTFLIGHT', 1360 * U, 356 * U, { weight: 600, size: 28 * U, tracking: 2.5 * U, color: RED, alpha: a });
  }
}

// ---------- page 7: the end card (88.95-96) ----------
function endCard(t) {
  const d = EASE.outExpo(seg(t, 89.85, 90.3));
  mark([W / 2, lerp(300, 340, d) * U], 30 * U, seg(t, 89.4, 90.1));
  const a = EASE.punch(seg(t, 89.9, 90.45));
  PLT.label(a > .9 ? 'name' : null, 'DAN FAKKELDY', W / 2, 470 * U, { weight: 600, size: 92 * U, tracking: 9 * U, align: 'center', alpha: a, blur: (1 - a) * 10 });
  const b = EASE.punch(seg(t, 90.67, 91.15));
  PLT.label(b > .9 ? 'what' : null, 'GIS · web maps · field tools', W / 2, 540 * U, { family: 'Space Grotesk', weight: 500, size: 36 * U, color: GRA, align: 'center', alpha: b });
  if (b > 0) {
    const s = 96 * U; CX.save(); CX.globalAlpha = b; CX.drawImage(IM.logo, W / 2 - 190 * U, 594 * U, s, s); CX.restore();
    PLT.label(b > .9 ? 'kinnoki' : null, 'KinNoKi Labs', W / 2 - 78 * U, 656 * U, { size: 40 * U, alpha: b });
  }
  const c = EASE.punch(seg(t, 91.33, 91.8));
  PLT.label(c > .9 ? 'links' : null, 'kinnokilabs.com   ·   kinnokilabs.com/map', W / 2, 776 * U, { family: 'Space Grotesk', weight: 600, size: 42 * U, align: 'center', alpha: c, blur: (1 - c) * 8 });
}
const CREDITS = [
  "Hugh Fletcher's sheets: David Rumsey Map Collection, David Rumsey Map Center, Stanford Libraries · CC BY-NC-SA 3.0",
  'Contains information licensed under the Open Government Licence – Nova Scotia · Province of Nova Scotia (licensed services)',
  '© OpenStreetMap contributors · Outline: Natural Earth',
];
function credits(t) {
  const a = seg(t, 91.6, 92.2); if (a <= 0) return;
  CREDITS.forEach((s, i) => text('~credit' + i, s, W / 2, (930 + i * 34) * U, { family: 'Space Grotesk', weight: 500, size: 22 * U, color: GRA, align: 'center', alpha: a }));
}

// ---------- the FIG. caption ----------
// PLT.caption with explicit figure numbers (4.1, 4.2...), blank stretches, and names that extend the one before.
function figCaption(t, figs, o) {
  let i = -1; while (i + 1 < figs.length && t >= figs[i + 1][0]) i++; if (i < 0) return;
  const { x: gx, y, size } = o, cps = 36, ecps = 90;
  const [t0, num, name, typeAt] = figs[i], pv = i > 0 ? figs[i - 1] : null, prev = pv && pv[2] ? pv[2] : '', prevNum = pv ? pv[1] : null;
  const cont = !!(name && prev && num === prevNum && name.startsWith(prev)), te = cont ? 0 : prev.length / ecps;
  let str = '', shown = null, done = false, tDone = Infinity;
  if (!cont && prev && t < t0 + te) { str = prev.slice(0, Math.max(0, prev.length - Math.floor((t - t0) * ecps))); shown = prevNum; }
  else if (name) {
    const base = cont ? prev : '', rest = name.slice(base.length), ts = typeAt ?? t0 + te, ty = typed(t, ts, rest, cps);
    str = base + ty.str; done = ty.done; tDone = ts + rest.length / cps * 1.05; shown = num;
  }
  if (shown == null) return;
  text('fig', `FIG. ${shown}`, gx - size * .38, y, { family: 'Fraunces', weight: 600, size: size * .7, tracking: size * .12, color: RED, align: 'right' });
  const r = str ? text(done ? 'cap' : '~cap', str, gx + size * .1, y, { family: 'Fraunces', weight: 400, size, color: INK }) : { w: 0 };
  if (done ? (t - tDone < .75 && frac((t - tDone) * 2.2) < .55) : true) { CX.save(); CX.fillStyle = RED; CX.fillRect(gx + size * .1 + r.w + size * .08, y - size * .74, Math.max(2, size * .055), size * .92); CX.restore(); }
}

// ---------- the film ----------
const PAGES = [coldOpen, titlePage, dataPlate, parcelPage, georefPlate, desktopPage, phonePage, endCard];
function pageDx(t, k) {
  let dx = 0;
  if (k > 0) { const s = SLIDES[k - 1]; if (t < s) return null; dx += W * (1 - EASE.inOut(seg(t, s, s + SLIDE))); }
  if (k < SLIDES.length) { const s = SLIDES[k]; if (t > s + SLIDE) return null; dx -= W * EASE.inOut(seg(t, s, s + SLIDE)); }
  return dx;
}
async function film(t) {
  PLT.paper();
  for (let k = 0; k < PAGES.length; k++) {
    const dx = pageDx(t, k); if (dx == null || Math.abs(dx) >= W) continue;
    // a page in mid-turn is not there to be read: its text is left out of the readability checks
    const mk = textsMark(); CX.save(); CX.translate(dx, 0); await PAGES[k](t); CX.restore(); if (dx !== 0) textsDrop(mk);
  }
  PLT.margins();
  figCaption(t, FIGS, { x: 470 * U, y: 86 * U, size: 40 * U });
  captions.draw(t, SUBS);
  credits(t);
  PLT.finish();
}
shots([[0, (t) => film(t)]]);

// ---------- sound cues, from the same times ----------
SLIDES.forEach(s => cue(s + .05, 'swish', { weight: .35 }));
[...TAKES_B.slice(1), ...TAKES_P.slice(1)].forEach(c => cue(c.t0 - WIPE / 2, 'swish', { weight: .2 }));
cue(9.85, 'tick'); cue(10.6, 'tick', { weight: .7 }); cue(15.6, 'tick', { weight: .6 });
ENDS.forEach(e => cue(e.t - .1, 'tick', { weight: .3 }));
cue(27.0, 'pop', { weight: .45 });
cue(38.45, 'land', { weight: .3 }); cue(48.25, 'land', { weight: .3 });
cue(41.95, 'drop', { weight: .4 }); PAIR_T.forEach(p => cue(p, 'tick', { weight: .35 })); cue(44.1, 'whoosh', { weight: .3 });
cue(89.4, 'tick'); cue(89.9, 'chime', { weight: .6 });
