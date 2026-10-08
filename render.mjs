// render.mjs: renders film.html in headless Chrome. Size, fps and length come from the project's PROJECT (config.js).
// Run it from the project folder (or the engine folder with --project=specimens/<look> for a look's specimen).
//
//   Look at it (open the images with the Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480]        contact sheet of chosen times  -> out/sheet.jpg
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320]            EVERY frame in a stretch (motion) -> out/strip.jpg
//     node render.mjs --beats [--every=1] [--from=0] [--to=8]         one frame per beat, labelled       -> out/beats.jpg
//     node render.mjs --onion=2.0:2.6 [--n=8]                         frames blended into one image: a move's path,
//                                                                     spacing and easing                 -> out/onion.png
//     node render.mjs --stills=1.2,3.4                                full-size PNGs                     -> out/stills/
//     node render.mjs --texts=2.5,4                                   the text registry at those times (what --inspect sees)
//   Outputs default to out/ (out/<project>/ with --project). A --strip at 60 fps over more than ~0.4 s is past the ~25
//   frames a sheet should hold: pass --fps=30 or a shorter span.
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600  full-resolution crops of a region
//   Check it without watching it:
//     node render.mjs --inspect [--every=0.1]    text cut by the frame edge or outside the safe area, text colliding,
//                                                 text not up long enough to read (the last card too, unless the film
//                                                 loops; '@' ids are voiced captions, judged at 20 characters a second),
//                                                 tiny text, page errors, a loop whose last frame isn't its first.
//                                                 It sees only registered text (text(), words(), readable()), not text
//                                                 covered by a later layer or warped by a post pass. Exits 2 on errors.
//     node render.mjs --determinism [--n=6]      renders sample frames in two fresh pages in different orders and
//                                                 diffs them: any frame that depends on history fails it.
//     node render.mjs --events                   the film's sound cues (cue() in the scenes) -> out/cues.json for the
//                                                 video-sound skill
//   Make the video:
//     node render.mjs --frames [--range=0:8] [--workers=3]             JPEG frames -> out/frames (parallel, resumable)
//     node render.mjs --encode [--audio=out/sound/master.wav | --no-audio] --out=out/film.mp4
//     node render.mjs --clip [--range=0:4] --out=out/clip.mp4          straight to MP4, one worker (short tests)
//   Options for every mode:
//     --subframes=4 [--shutter=0.5]   motion blur: each frame is the average of N sub-frames spread over the shutter
//                                     (0.5 = a 180-degree shutter), kept inside the shot so cuts stay sharp. Costs N x.
//                                     Use 4 for UI and type, 8 for whip-fast moves; 2 strobes hard edges into two copies.
//                                     None for pixel art (it softens every pixel edge) or flat print looks.
//     --loop=<name>                   render a standalone loop (LOOPS.name) instead of the film
//     --project=<dir>                 load <dir>/config.js and <dir>/manifest.js (default src)
//     --fps=N                         override PROJECT.fps (sheets and checks only; --frames uses PROJECT.fps)
//     --chrome=<path>  --soft-gl  --no-slot  --allow-errors
//   Render slots: every run takes one of MF_RENDER_SLOTS (default 2) machine-wide slots before it starts Chrome, so
//   parallel agents queue instead of swamping a 16 GB Mac. --no-slot skips it (only when you know nothing else runs).
//   Chrome on some Macs quits about 30 s after launch whatever it is doing; every mode here relaunches and carries on.
import puppeteer, { ProtocolError } from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
const PAGE = args.page || 'film.html', PROJ = args.project || '';
const ALLOW = !!args['allow-errors'];
// Frames are JPEGs (BT.601 maths, full range). Convert them to BT.709 limited range with accurate rounding and tag the
// file to match: without the explicit matrix ffmpeg converts with BT.601 maths under a BT.709 label, and players
// shift colours by up to 8 levels (measured: #2f6fdb came back as #276fe0). With it, flat colours return within about 2 levels (256 tested, 0.4 on average).
const BT709 = ['-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// ---------- Chrome ----------
function chromeCandidates() {
  const out = [args.chrome, process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (const base of [`${homedir()}/Library/Caches/ms-playwright`, `${homedir()}/.cache/ms-playwright`]) {
    if (!existsSync(base)) continue;
    for (const n of readdirSync(base).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1]))
      out.push(`${base}/${n}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
        `${base}/${n}/chrome-mac/Chromium.app/Contents/MacOS/Chromium`, `${base}/${n}/chrome-linux64/chrome`, `${base}/${n}/chrome-linux/chrome`);
  }
  out.push('C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return out;
}
const CHROME = chromeCandidates().find(p => p && existsSync(p));
if (!CHROME && !args.encode) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
const launch = () => puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu,
    '--enable-gpu-rasterization', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
});

// ---------- render slots ----------
const SLOT_DIR = '/tmp/motion-film-render-slots', SLOTS = Math.max(1, +(process.env.MF_RENDER_SLOTS || 2));
let SLOT = null;
async function takeSlot() {
  if (args['no-slot'] || args.encode) return;
  mkdirSync(SLOT_DIR, { recursive: true }); let said = false;
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const d = `${SLOT_DIR}/slot${i}`;
      try { mkdirSync(d); writeFileSync(`${d}/pid`, String(process.pid)); SLOT = d; return; } catch {}
      try { const pid = +readFileSync(`${d}/pid`, 'utf8'); if (pid) process.kill(pid, 0); }   // alive (EPERM also means alive)
      catch (e) { if (e.code === 'ESRCH' || e.code === 'ENOENT') rmSync(d, { recursive: true, force: true }); }
    }
    if (!said) { console.log(`waiting for a render slot (${SLOTS} in use; MF_RENDER_SLOTS sets the limit)…`); said = true; }
    await sleep(2000);
  }
}
const freeSlot = () => { if (SLOT) { try { rmSync(SLOT, { recursive: true, force: true }); } catch {} SLOT = null; } };
process.on('exit', freeSlot);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { freeSlot(); process.exit(130); });

// ---------- errors ----------
const ERRS = new Map(), FAILED = [];
function noteError(msg, t = null, tag = '') {
  const key = String(msg).split('\n')[0], e = ERRS.get(key);
  if (e) { e.n++; if (t != null) { e.t0 = Math.min(e.t0, t); e.t1 = Math.max(e.t1, t); } return; }
  ERRS.set(key, { n: 1, t0: t ?? Infinity, t1: t ?? -Infinity });
  console.log(`[page error${tag}${t != null ? ` at t=${t.toFixed(3)}` : ''}]`, msg);
}

// ---------- page ----------
// helpers injected into every page: an accumulator for motion blur and onion skins, a sheet compositor and a differ
const HELPERS = `
window.__acc = { s: null, n: 0, w: 0, h: 0, c: null,
  reset() { this.s = null; this.n = 0; },
  add(src) { const w = src.width, h = src.height; if (!this.c || this.c.width !== w || this.c.height !== h) { this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; }
    const x = this.c.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, w, h); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, w, h).data;
    if (!this.s) { this.s = new Float32Array(d.length); this.w = w; this.h = h; } for (let i = 0; i < d.length; i++) this.s[i] += d[i]; this.n++; },
  async addURL(u) { const im = new Image(); im.src = u; await im.decode(); this.add(im); },
  result(type, q, scale) { const x = this.c.getContext('2d'), id = x.createImageData(this.w, this.h), n = this.n;
    for (let i = 0; i < this.s.length; i++) id.data[i] = Math.round(this.s[i] / n); x.putImageData(id, 0, 0);
    if (!scale || scale === 1) return this.c.toDataURL(type, q);
    const o = document.createElement('canvas'); o.width = Math.round(this.w * scale); o.height = Math.round(this.h * scale); const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(this.c, 0, 0, o.width, o.height); return o.toDataURL(type, q); } };
window.__sheet = async (urls, labels, cols, w) => { const ims = []; for (const u of urls) { const im = new Image(); im.src = u; await im.decode(); ims.push(im); }
  const h = Math.round(w * ims[0].height / ims[0].width), rows = Math.ceil(ims.length / cols), c = document.createElement('canvas'); c.width = cols * w; c.height = rows * h;
  const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, c.width, c.height);
  ims.forEach((im, i) => { const px = (i % cols) * w, py = Math.floor(i / cols) * h; x.drawImage(im, px, py, w, h); x.strokeStyle = '#555'; x.strokeRect(px + .5, py + .5, w - 1, h - 1);
    const lab = labels[i]; x.font = '15px sans-serif'; const lw = x.measureText(lab).width + 12; x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(px, py, lw, 24); x.fillStyle = '#fff'; x.fillText(lab, px + 6, py + 17); });
  return c.toDataURL('image/jpeg', .9); };
window.__diff = async (a, b) => { const load = async u => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const A = await load(a), B = await load(b); let max = 0, over = 0, sum = 0; for (let i = 0; i < A.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(A[i] - B[i]); sum += d; if (d > max) max = d; if (d > 2) over++; }
  return { max, over, mean: sum / (A.length * .75) }; };`;

let browser = null, INFO = null;
async function openPage(tag = '') {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(HELPERS);
  page.on('console', m => {
    const s = m.text(), url = m.location().url || '';
    if (m.type() === 'error' && s.startsWith('frame error at t=')) return;
    if (m.type() === 'error' && s.startsWith('Failed to load') && url.startsWith('file:')) return noteError(`${s}: ${url}`, null, tag);
    if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, s);
  });
  const cdp = await page.createCDPSession(); await cdp.send('Runtime.enable');
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails: d }) => noteError((d.exception && d.exception.description || d.text) +
    (d.url && !(d.exception && /\n\s+at /.test(d.exception.description || '')) ? `\n    at ${d.url}:${d.lineNumber + 1}:${d.columnNumber + 1}` : ''), null, tag));
  const q = new URLSearchParams({ render: '' }); if (PROJ) q.set('project', PROJ);
  await page.goto(pathToFileURL(resolve(PAGE)).href + '?' + q.toString(), { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  const info = await page.evaluate(() => ({ W, H, FPS, DUR: window.LOOP ? window.LOOP.len : DUR, CAPTURE: window.CAPTURE, BPM, OFF, METER,
    loop: !!PROJECT.loop, gpuNeeded: !!PROJECT.gpu, manifest: typeof MANIFEST === 'undefined' ? [] : MANIFEST, project: PROJECT_DIR }));
  await page.setViewport({ width: info.W, height: info.H, deviceScaleFactor: 1 });
  INFO = info; return page;
}
const chromeGone = (e, page) => e instanceof ProtocolError || !browser.connected || (page && page.isClosed()) || /Target closed|Session closed|detached/i.test(String(e && e.message));
async function relaunch() { try { await browser.close(); } catch {} browser = await launch(); }
// run fn(page, item) over items in order on one page, relaunching Chrome whenever it goes away
async function runSeq(items, fn, tag = '') {
  const out = []; let page = await openPage(tag), i = 0, relaunches = 0;
  while (i < items.length) {
    try { out.push(await fn(page, items[i], i)); i++; }
    catch (e) { if (!chromeGone(e, page) || ++relaunches > 50) throw e; await relaunch(); page = await openPage(tag); }
  }
  return out;
}
const drain = async page => { for (const e of await page.evaluate(() => (window.FRAME_ERRORS || []).splice(0))) noteError(e.message, e.t); };

// ---------- one frame ----------
const SUB = Math.max(1, +(args.subframes || 1)), SHUTTER = clamp01(+(args.shutter ?? .5));
function clamp01(x) { return Math.max(0, Math.min(1, isNaN(x) ? .5 : x)); }
async function subTimes(page, t, fps) {
  if (SUB === 1) return [t];
  const [a, b] = await page.evaluate(t => window.LOOP ? [0, window.LOOP.len] : window.shotSpan(t), t);
  return Array.from({ length: SUB }, (_, k) => Math.min(b - 1e-4, Math.max(a, t + ((k + .5) / SUB - .5) * SHUTTER / fps)));
}
// returns a data URL of the frame at t (with motion blur if --subframes), scaled by scale
async function frameURL(page, t, { type = 'image/jpeg', q = .94, scale = 1, fps = INFO.FPS } = {}) {
  const ts = await subTimes(page, t, fps);
  let url;
  if (INFO.CAPTURE === 'canvas' && ts.length === 1) url = await page.evaluate((t, type, q, scale) => window.renderAt(t, type, q, scale), t, type, q, scale);
  else if (INFO.CAPTURE === 'canvas') url = await page.evaluate(async (ts, type, q, scale) => { __acc.reset(); for (const s of ts) { await window.drawAt(s); __acc.add(window.outCanvas()); } return __acc.result(type, q, scale); }, ts, type, q, scale);
  else {
    const clip = { x: 0, y: 0, width: INFO.W, height: INFO.H };
    const shots = [];
    for (const s of ts) { await page.evaluate(s => window.drawAt(s), s); shots.push('data:image/png;base64,' + await page.screenshot({ type: 'png', clip, encoding: 'base64' })); }
    url = await page.evaluate(async (us, type, q, scale) => { __acc.reset(); for (const u of us) await __acc.addURL(u); return __acc.result(type, q, scale); }, shots, type, q, scale);
  }
  const errs = await page.evaluate(() => (window.FRAME_ERRORS || []).splice(0)); for (const e of errs) noteError(e.message, e.t);
  return { url, failed: errs.length > 0 };
}
const toBuf = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
// default outputs go under out/<project>/ when --project is given, so parallel runs on different specimens don't collide
const OUTDIR = PROJ ? `out/${PROJ.replace(/\/+$/, '').split('/').pop()}` : 'out';
const out = (def) => { const f = args.out || def.replace(/^out\//, OUTDIR + '/'); mkdirSync(dirname(f), { recursive: true }); return f; };

// ---------- modes ----------
await takeSlot();
if (!args.encode) browser = await launch();
try {
  if (args.sheet || args.strip || args.beats) {
    const probe = await openPage(); const fps = +(args.fps || INFO.FPS); await probe.close();
    let ts, labels;
    if (args.strip) { const [a, b] = span(args.strip); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) ts.push(i / fps); labels = ts.map(t => `${t.toFixed(3)}s f${Math.round(t * INFO.FPS)}`); }
    else if (args.beats) {
      const every = +(args.every || 1), from = +(args.from ?? 0), to = +(args.to ?? INFO.DUR); ts = []; labels = [];
      for (let n = Math.ceil(((from - INFO.OFF) / (60 / INFO.BPM)) / every) * every; INFO.OFF + n * 60 / INFO.BPM < Math.min(to, INFO.DUR) - 1e-6; n += every) {
        const t = INFO.OFF + n * 60 / INFO.BPM; if (t < 0) continue; ts.push(t); labels.push(`bar ${Math.floor(n / INFO.METER) + 1}.${(n % INFO.METER) + 1}  ${t.toFixed(2)}s`); }
    } else { ts = times(args.sheet); labels = ts.map(t => `${t.toFixed(2)}s`); }
    const crop = args.crop ? times(args.crop) : null;
    const cols = +(args.cols || (args.strip ? 6 : args.beats ? 4 : Math.min(3, ts.length)));
    const w = +(args.w || (crop && ts.length < 3 ? crop[2] : args.strip ? 320 : args.beats ? 480 : 640));
    const scale = crop ? 1 : Math.min(1, (w * 1.5) / INFO.W);
    const urls = await runSeq(ts, async (page, t) => {
      const f = await frameURL(page, t, { scale, fps, q: .9 });
      if (!crop) return f.url;
      return page.evaluate(async (u, c) => { const im = new Image(); im.src = u; await im.decode(); const k = document.createElement('canvas'); k.width = c[2]; k.height = c[3]; k.getContext('2d').drawImage(im, c[0], c[1], c[2], c[3], 0, 0, c[2], c[3]); return k.toDataURL('image/jpeg', .92); }, f.url, crop);
    });
    const page = await openPage(), file = out(args.strip ? 'out/strip.jpg' : args.beats ? 'out/beats.jpg' : 'out/sheet.jpg');
    writeFileSync(file, toBuf(await page.evaluate((u, l, c, w) => window.__sheet(u, l, c, w), urls, labels, cols, w)));
    console.log(`${file}  (${ts.length} frames)`);
  } else if (args.onion) {
    const [a, b] = span(args.onion), n = Math.max(2, +(args.n || 8)), ts = Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
    const urls = await runSeq(ts, async (page, t) => (await frameURL(page, t, { type: 'image/png', scale: Math.min(1, 1280 / INFO.W) })).url);
    const page = await openPage(), file = out('out/onion.png');
    writeFileSync(file, toBuf(await page.evaluate(async us => { __acc.reset(); for (const u of us) await __acc.addURL(u); return __acc.result('image/png', 1, 1); }, urls)));
    console.log(`${file}  (${n} frames from ${a}s to ${b}s blended: ghosts show the path; their spacing shows the easing)`);
  } else if (args.stills) {
    const dir = args.out || `${OUTDIR}/stills`; mkdirSync(dir, { recursive: true });
    await runSeq(times(args.stills), async (page, s) => {
      if (s === times(args.stills)[0]) console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
      const t0 = Date.now(), f = await frameURL(page, s, { type: 'image/png' }), file = `${dir}/t${s.toFixed(2).replace('.', '_')}.png`;
      writeFileSync(file, toBuf(f.url)); console.log(`${file}  ${Date.now() - t0} ms`);
    });
  } else if (args.texts) {
    const page = await openPage(); for (const t of times(args.texts)) { const tx = await page.evaluate(t => window.textsAt(t), t); await drain(page);
      console.log(`t=${t}: ${tx.length} registered`); for (const x of tx) console.log(`   ${x.id.padEnd(18)} a=${x.a} px=${x.px ?? '-'} box=${x.box}  "${x.text}"`); }
  } else if (args.inspect) {
    await inspect();
  } else if (args.determinism) {
    const probe = await openPage(), D = INFO.DUR; await probe.close();
    const n = Math.max(2, +(args.n || 6)), ts = Array.from({ length: n }, (_, i) => +(D * (i + .5) / n).toFixed(4));
    const A = await runSeq(ts, async (p, t) => (await frameURL(p, t, { type: 'image/png' })).url, '#A');
    const order = ts.map((t, i) => i).reverse(), Bm = await runSeq(order, async (p, i) => { await p.evaluate(t => window.drawAt(t), ts[(i + 1) % n]); return (await frameURL(p, ts[i], { type: 'image/png' })).url; }, '#B');
    const B = []; order.forEach((i, k) => { B[i] = Bm[k]; });
    const page = await openPage(); let bad = 0;
    for (let i = 0; i < n; i++) {
      const d = A[i] === B[i] ? { max: 0, over: 0, mean: 0 } : await page.evaluate((a, b) => window.__diff(a, b), A[i], B[i]);
      const ok = d.max <= 2; if (!ok) bad++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} t=${ts[i]}  max diff ${d.max}/255, ${d.over} channel values over 2`);
    }
    console.log(bad ? `${bad} of ${n} frames depend on what was drawn before: look for Date.now, Math.random, accumulated state, CSS transitions, unseeded noise` : 'deterministic: frames match whatever order they render in');
    if (bad) process.exitCode = 2;
  } else if (args.events) {
    const page = await openPage(), cues = await page.evaluate(() => window.CUES_OUT);
    const meta = await page.evaluate(() => ({ fps: FPS, duration: DUR, bpm: BPM, offset: OFF, meter: METER, key: PROJECT.key || null }));
    const file = out('out/cues.json'); writeFileSync(file, JSON.stringify({ ...meta, cues }, null, 1));
    const kinds = cues.reduce((m, c) => (m[c.kind] = (m[c.kind] || 0) + 1, m), {});
    console.log(`${file}  ${cues.length} cues (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ') || 'none'}) over ${meta.duration} s = ${(cues.length / meta.duration * 10).toFixed(1)} per 10 s`);
  } else if (args.frames) {
    await frames();
  } else if (args.clip) {
    const page0 = await openPage(), len = INFO.DUR, fps = INFO.FPS;
    if (INFO.gpuNeeded) { const g = await page0.evaluate(() => window.gpuInfo()); console.log('GPU:', g);
      if (/swiftshader|software|no webgl/i.test(g) && !args['soft-gl']) { console.error('this film needs a GPU and Chrome landed on software rendering (about 30x slower): fix the GPU or pass --soft-gl'); process.exit(1); } }
    await page0.close();
    const [a, b] = args.range ? span(args.range) : typeof args.clip === 'string' ? span(args.clip) : [0, len];
    const audio = args['no-audio'] ? '' : args.audio || '';
    const file = out('out/clip.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      ...(audio ? ['-ss', String(a), '-t', String(b - a), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', ...BT709, '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((b - a) * fps), ts = Array.from({ length: n }, (_, i) => a + i / fps), start = Date.now();
    await runSeq(ts, async (page, t, i) => { const f = await frameURL(page, t, { q: .93 }); const buf = toBuf(f.url);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % fps === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/frame`); });
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`wrote ${file}`);
  } else if (args.encode) {
    await encode();
  } else {
    console.log('nothing to do: see the usage notes at the top of render.mjs');
  }
} finally {
  if (browser) try { await browser.close(); } catch {}
}
if (ERRS.size) {
  const n = [...ERRS.values()].reduce((s, e) => s + e.n, 0);
  console.log(`\n${n} page error${n > 1 ? 's' : ''} (${ERRS.size} distinct):`);
  for (const [k, e] of ERRS) console.log(`  ${e.n}x  ${k}${e.t0 <= e.t1 ? `  (t ${e.t0.toFixed(2)}${e.t1 > e.t0 ? '-' + e.t1.toFixed(2) : ''})` : ''}`);
  if (FAILED.length) console.log(`${FAILED.length} frames left unwritten: fix the shot and run --frames again`);
  console.log(ALLOW ? '--allow-errors: exiting 0 anyway' : 'exiting 2 (pass --allow-errors to accept them)');
  if (!ALLOW) process.exitCode = 2;
}
freeSlot();

// ---------- frames and encode ----------
function framesDir() { return args.dir || 'out/frames' + (args.loop ? '-loop-' + args.loop : ''); }
async function frames() {
  const probe = await openPage(), info = INFO; await probe.close();
  if (info.gpuNeeded) { const p = await openPage(), g = await p.evaluate(() => window.gpuInfo()); await p.close(); console.log('GPU:', g);
    if (/swiftshader|software|no webgl/i.test(g) && !args['soft-gl']) { console.error('this film needs a GPU and Chrome landed on software rendering (about 30x slower): fix the GPU or pass --soft-gl'); process.exit(1); } }
  if (ERRS.size && !ALLOW) { console.error('the page errored while loading (above): fix it first, or pass --allow-errors'); process.exit(2); }
  const DIR = framesDir(), STAMP = `${DIR}/frames.json`, fps = info.FPS;
  const stamp = { of: args.loop ? 'loop:' + args.loop : 'film', project: info.project, page: PAGE, fps, size: [info.W, info.H], subframes: SUB, shutter: SHUTTER, scripts: info.manifest };
  const was = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, 'utf8')) : null, held = !!was && existsSync(DIR) && readdirSync(DIR).some(f => /^f\d{5}\.jpg$/.test(f));
  const differ = held ? Object.keys(stamp).filter(k => JSON.stringify(was[k]) !== JSON.stringify(stamp[k])) : [];
  if (differ.length) { console.error(`${DIR} holds frames rendered differently (${differ.join(', ')} changed). Move or empty it first, or delete ${STAMP} to resume into it anyway.`); process.exit(1); }
  const [a, b] = args.range ? span(args.range) : [0, info.DUR], workers = +(args.workers || 3);
  mkdirSync(DIR, { recursive: true }); if (!held) writeFileSync(STAMP, JSON.stringify(stamp));
  const first = Math.round(a * fps), last = Math.min(Math.ceil(info.DUR * fps) - 1, Math.round(b * fps) - 1);
  const todo = []; for (let i = first; i <= last; i++) { const f = `${DIR}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers${SUB > 1 ? `, ${SUB} sub-frames each` : ''}`);
  const queue = [...todo]; let done = 0, relaunches = 0; const start = Date.now();
  while (queue.length && relaunches < 1000) {
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      let page; try { page = await openPage('#' + w); } catch { return; }
      while (queue.length) {
        const i = queue.shift(), f = `${DIR}/f${String(i).padStart(5, '0')}.jpg`;
        let r = null; try { r = await frameURL(page, i / fps, { q: .94 }); }
        catch (e) { if (chromeGone(e, page)) { queue.unshift(i); return; } noteError(e && e.stack || String(e), i / fps, '#' + w); }
        if (r && (!r.failed || ALLOW)) { writeFileSync(f + '.tmp', toBuf(r.url)); renameSync(f + '.tmp', f); } else FAILED.push(i);
        if (++done % (fps * 2) === 0 || done === todo.length) { const el = (Date.now() - start) / 1000; console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame effective  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`); }
      }
    }));
    if (queue.length) { relaunches++; await relaunch(); console.log(`Chrome closed; relaunched (${relaunches}), ${queue.length} frames left`); }
  }
}
async function encode() {
  const DIR = framesDir();
  if (!existsSync(DIR)) { console.error(`no frames in ${DIR}: render them first (--frames)`); process.exit(1); }
  const st = existsSync(`${DIR}/frames.json`) ? JSON.parse(readFileSync(`${DIR}/frames.json`, 'utf8')) : null, fps = st ? st.fps : +(args.fps || 30);
  const n = readdirSync(DIR).filter(f => /^f\d{5}\.jpg$/.test(f)).length;
  for (let i = 0; i < n; i++) if (!existsSync(`${DIR}/f${String(i).padStart(5, '0')}.jpg`)) { console.error(`frame f${String(i).padStart(5, '0')}.jpg is missing: render it (--frames) before encoding`); process.exit(1); }
  const audio = args['no-audio'] ? '' : args.audio || '';
  if (!audio && !args['no-audio']) { console.error('pass --audio=<wav> (e.g. the video-sound master) or --no-audio for a silent cut'); process.exit(1); }
  if (audio && !existsSync(audio)) { console.error(`no such audio file: ${audio}`); process.exit(1); }
  const file = out('out/film.mp4');
  console.log(`encoding ${n} frames at ${fps} fps -> ${file}${audio ? ' with ' + audio : ' (silent)'}`);
  await new Promise((ok, bad) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', ...BT709, '-movflags', '+faststart', file], { stdio: 'inherit' });
    p.on('close', c => c ? bad(new Error('ffmpeg exited ' + c)) : ok()); });
  console.log('wrote ' + file);
}

// ---------- inspect ----------
async function inspect() {
  const probe = await openPage(), info = INFO;
  const shotStarts = await probe.evaluate(() => SHOTS.map(s => s[0])); const fonts = await probe.evaluate(() => [...document.fonts].filter(f => f.status === 'error').map(f => f.family));
  await probe.close();
  const every = +(args.every || .1), fps = info.FPS, D = info.DUR, ts = new Set();
  for (let t = 0; t < D - 1e-6; t += every) ts.add(+t.toFixed(4));
  for (let i = 0; i < shotStarts.length; i++) { ts.add(+shotStarts[i].toFixed(4)); const end = i + 1 < shotStarts.length ? shotStarts[i + 1] : D; ts.add(+Math.max(0, end - 1 / fps).toFixed(4)); }
  const T = [...ts].filter(t => t >= 0 && t < D).sort((a, b) => a - b);
  const samples = await runSeq(T, async (page, t) => { const texts = await page.evaluate(t => window.textsAt(t), t); await drain(page); return { t, texts }; });
  const page = await openPage(), safe = await page.evaluate(() => safeRect());
  const issues = []; const add = (level, kind, t, msg) => issues.push({ level, kind, t: +t.toFixed(3), msg });
  for (const f of fonts) add('error', 'font', 0, `font "${f}" failed to load: text falls back to another face`);
  const minPx = 28 * Math.min(info.W, info.H) / 1080, related = (a, b) => a === b || a.startsWith(b + '#') || b.startsWith(a + '#');
  for (const { t, texts } of samples) {
    for (const x of texts) {
      const [bx, by, bw, bh] = x.box;
      if (bx >= info.W || by >= info.H || bx + bw <= 0 || by + bh <= 0) continue;   // wholly outside: a camera move or crop has taken it out of shot
      if (bx < -1 || by < -1 || bx + bw > info.W + 1 || by + bh > info.H + 1) add(x.a > .5 ? 'error' : 'warn', 'out-of-frame', t, `"${x.text}" (${x.id}) is cut by the frame edge: box ${x.box}`);
      else if (x.a > .5 && (bx < safe[0] - 1 || by < safe[1] - 1 || bx + bw > safe[0] + safe[2] + 1 || by + bh > safe[1] + safe[3] + 1)) add('warn', 'outside-safe', t, `"${x.text}" (${x.id}) leaves the safe area ${safe.map(Math.round)}`);
      const px = x.px || bh / .75; if (x.a > .5 && px < minPx && !x.id.startsWith('~')) add('warn', 'tiny', t, `"${x.text}" (${x.id}) is set at about ${Math.round(px)} px on screen, under ${Math.round(minPx)} px (28 px at 1080p, scaled to this frame)`);
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const A = texts[i], B = texts[j]; if (related(A.id, B.id)) continue;
      const ix = Math.max(0, Math.min(A.box[0] + A.box[2], B.box[0] + B.box[2]) - Math.max(A.box[0], B.box[0])), iy = Math.max(0, Math.min(A.box[1] + A.box[3], B.box[1] + B.box[3]) - Math.max(A.box[1], B.box[1]));
      const small = Math.min(A.box[2] * A.box[3], B.box[2] * B.box[3]) || 1;
      if (ix * iy / small > .08 && A.a > .3 && B.a > .3) add(A.a > .6 && B.a > .6 ? 'error' : 'warn', 'collision', t, `"${A.text}" (${A.id}) and "${B.text}" (${B.id}) overlap ${Math.round(ix * iy / small * 100)}%`);
    }
  }
  // reading time: each piece of text's unbroken runs on screen (same id, same text, alpha >= .6)
  const open = new Map(), runs = [];
  samples.forEach(({ t, texts }, k) => {
    const next = k + 1 < samples.length ? samples[k + 1].t : D, seen = new Set();
    for (const x of texts) { if (x.a < .6 || x.id.includes('#')) continue; const key = x.id + '|' + x.text; seen.add(key);
      const r = open.get(key); if (r && r.k === k - 1) { r.end = next; r.k = k; } else { if (r) runs.push(r); open.set(key, { id: x.id, text: x.text, start: t, end: next, k }); } }
    for (const [key, r] of open) if (!seen.has(key) && r.k < k) { runs.push(r); open.delete(key); }
  });
  runs.push(...open.values());
  // Unvoiced text needs 1 s + 3 words a second; voiced captions (ids starting '@', the words being spoken) are judged
  // like subtitles: at most 20 characters a second, at least 0.83 s. '~' ids are deliberately fast and skipped. The last
  // card is checked too (a closing line that ends with the film still has to be read), unless the film loops.
  for (const r of runs) {
    if (r.id.startsWith('~') || (info.loop && r.end >= D - 1e-3)) continue;
    const words = r.text.split(/\s+/).filter(Boolean).length, got = r.end - r.start, voiced = r.id.startsWith('@');
    const need = voiced ? Math.max(.83, r.text.length / 20) : Math.max(1.2, 1 + words / 3);
    if (got + every * .5 < need) add('warn', 'reading-time', r.start, `"${r.text}" (${r.id}) is readable for about ${got.toFixed(2)} s${r.end >= D - 1e-3 ? ' before the film ends' : ''}; it needs about ${need.toFixed(1)} s (${voiced ? '20 characters a second, voiced' : '1 s + 3 words a second'})`);
  }
  if (info.loop) {
    const a = (await frameURL(page, 0, { type: 'image/png' })).url, b = (await frameURL(page, D, { type: 'image/png' })).url, d = a === b ? { max: 0 } : await page.evaluate((a, b) => window.__diff(a, b), a, b);
    if (d.max > 6) add('error', 'loop-seam', D, `PROJECT.loop is set but the frame at ${D} s differs from frame 0 (max ${d.max}/255): the loop will jump`);
  }
  for (const [k, e] of ERRS) add('error', 'page-error', e.t0 === Infinity ? 0 : e.t0, `${e.n}x ${k}`);
  ERRS.clear();
  const registered = samples.reduce((n, s) => n + s.texts.length, 0);
  const file = out('out/inspect.json'); writeFileSync(file, JSON.stringify({ samples: T.length, every, registered, issues }, null, 1));
  if (!registered) console.log('note: no text was registered in any frame: if the film has words, draw them with text()/words() or call readable(), or the checks can\'t see them');
  const errs = issues.filter(i => i.level === 'error'), warns = issues.filter(i => i.level === 'warn');
  const group = list => Object.entries(list.reduce((m, i) => ((m[i.kind] = m[i.kind] || []).push(i), m), {}));
  for (const [kind, list] of group(errs)) { console.log(`ERROR ${kind} x${list.length}`); for (const i of list.slice(0, 6)) console.log(`   t=${i.t}  ${i.msg}`); }
  for (const [kind, list] of group(warns)) { console.log(`warn  ${kind} x${list.length}`); for (const i of list.slice(0, 4)) console.log(`   t=${i.t}  ${i.msg}`); }
  console.log(`${T.length} frames checked (every ${every} s, plus each shot's first and last frame): ${errs.length} errors, ${warns.length} warnings -> ${file}`);
  if (errs.length) process.exitCode = 2;
}
