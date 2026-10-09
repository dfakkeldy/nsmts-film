// Records a scripted session on the live site at a true 30 fps, driving every rendered frame.
//
//   node capture/record-vt.mjs <scenario.mjs> <out.mp4> [--phone]
//
// Chrome's headless shell with begin-frame control renders a frame only when asked; each recorded frame advances
// the animation clock (animation frames, CSS transitions) by exactly 1/30 s and returns its screenshot, so
// animations come out smooth however slowly the software GPU renders. Timers and network fetches still run in real
// time, so a slow frame lets tiles arrive "early"; nothing is invented, only time is resampled. A scenario exports
// `async function run(page, h)` and moves time only through `h` (wait, moveTo, click, tap, type), which records
// every frame it passes. Headless Chrome draws no pointer, so a small pointer (desktop) or tap ring (phone) is
// injected that follows the real input events; nothing else on the page is changed.
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const [scenarioPath, outPath, ...flags] = process.argv.slice(2);
const phone = flags.includes("--phone");
const scenario = await import(pathToFileURL(resolve(scenarioPath)).href);
const opt = scenario.options ?? {};
const FPS = 30, STEP = 1000 / FPS;
const view = phone ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                   : { width: 1920, height: 1080, deviceScaleFactor: opt.dpr ?? 1 };

const browser = await puppeteer.launch({
  executablePath: process.env.SHELL_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  headless: "shell", protocolTimeout: 600000, ...(opt.profile ? { userDataDir: resolve(opt.profile) } : {}),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-color-profile=srgb", "--enable-begin-frame-control",
         "--run-all-compositor-stages-before-draw", "--disable-new-content-rendering-timeout",
         "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging"],
});
// A scenario with a `profile` reuses that browser profile (e.g. maps imported beforehand in a normal browser).
const context = opt.profile ? browser.defaultBrowserContext() : await browser.createBrowserContext();
if (opt.geolocation) await context.overridePermissions(opt.origin ?? "https://kinnokilabs.com", ["geolocation"]);
// A page whose frames are produced only when we ask (HeadlessExperimental.beginFrame).
const bs = await browser.target().createCDPSession();
const { targetId } = await bs.send("Target.createTarget", { url: "about:blank", ...(context.id ? { browserContextId: context.id } : {}), enableBeginFrameControl: true });
const target = await browser.waitForTarget((t) => t._targetId === targetId);
const page = await target.page();
await page.setViewport(view);
if (phone) await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
if (opt.geolocation) await page.setGeolocation(opt.geolocation);
// The 3D view fetches tiles with CORS; a copy cached earlier by the 2D map's plain <img> load lacks the CORS header
// (the tile server omits `Vary: Origin` when no Origin is sent), so a take that turns 3D on can bypass the cache.
if (opt.noCache) await page.setCacheEnabled(false);
page.on("pageerror", (e) => console.log("pageerror:", e.message));
// Local storage set before the app starts (e.g. the Province licence already accepted), so no modal opens: modal
// <dialog>s stall frame-controlled rendering.
if (opt.storage) await page.evaluateOnNewDocument((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch {} }, opt.storage);
await page.evaluateOnNewDocument((isPhone) => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText = isPhone
      ? "position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid rgba(20,20,20,.55);background:rgba(255,255,255,.3);pointer-events:none;z-index:2147483647;opacity:0"
      : "position:fixed;left:0;top:0;width:22px;height:22px;pointer-events:none;z-index:2147483647;opacity:0";
    if (!isPhone) d.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L6.5 13.8 L9.6 20.5 L12.6 19.2 L9.6 12.6 L15.6 12.6 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(d);
    window.__recPointer = (x, y, o) => { d.style.transform = `translate(${x}px,${y}px)`; d.style.opacity = o; };
  });
}, phone);

const cdp = await page.createCDPSession();
const frameDir = resolve(dirname(outPath), `.vt-${Date.now()}`);
mkdirSync(frameDir, { recursive: true });
let n = 0, recording = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const log = (...a) => console.error(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

// Frame clock in ms. While loading we pump frames at real time; while recording each frame is exactly STEP.
let ticks = 1e6, last = null, pumping = false;
async function begin(screenshot) {
  const r = await cdp.send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval: STEP,
    ...(screenshot ? { screenshot: { format: "jpeg", quality: 93 } } : {}) });
  return r.screenshotData;
}
async function frame() {
  ticks += STEP;
  if (!recording) { await begin(false); return; }
  const data = await begin(true);
  if (data) last = Buffer.from(data, "base64");
  if (!last) last = Buffer.from((await begin(true)) ?? "", "base64");
  writeFileSync(join(frameDir, `f${String(n++).padStart(6, "0")}.jpg`), last);
}
async function pump(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const t0 = Date.now(); await begin(false); await sleep(30); ticks += Date.now() - t0; }
}
// Input is acknowledged only after a frame renders, so send it and keep rendering (and recording) until it lands.
async function during(promise) {
  let done = false, err = null; const t = Date.now();
  promise.then(() => (done = true), (e) => { done = true; err = e; });
  await sleep(5);
  for (let k = 0; !done && k < 600; k++) { if (recording) await frame(); else { await begin(false); await sleep(30); } }
  if (!done) log("input still pending after", Date.now() - t, "ms");
  if (err) throw err;
}
const ease = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
let pos = { x: view.width * 0.62, y: view.height * 0.62 }, shown = 0;
const pointer = (x, y, o) => page.evaluate((x, y, o) => window.__recPointer?.(x, y, o), x, y, o);

const h = {
  phone, page,
  // Load a URL in real time (virtual time not yet started), then let it settle.
  async load(url, settleMs = 12000) {
    log("load", url);
    const nav = page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    let done = false; nav.finally(() => (done = true));
    while (!done) await pump(200);
    await nav; log("loaded; settling", settleMs, "ms"); await pump(settleMs); log("settled");
  },
  // From here on, the animation clock moves exactly one frame per recorded frame.
  async start() { recording = true; log("recording"); },
  async stop() { recording = false; },
  async wait(s) { for (let i = 0; i < Math.round(s * FPS); i++) await frame(); },
  // Let real time pass with the page clock running freely (e.g. while tiles stream), without recording.
  async settle(ms) { log("settle", ms); const r = recording; recording = false; await pump(ms); recording = r; },
  async moveTo(x, y, s = 0.6) {
    if (phone) { pos = { x, y }; return; }
    const from = { ...pos }, k = Math.max(1, Math.round(s * FPS));
    for (let i = 1; i <= k; i++) {
      const e = ease(i / k), px = from.x + (x - from.x) * e, py = from.y + (y - from.y) * e;
      await during(page.mouse.move(px, py)); await during(pointer(px, py, 1)); shown = 1;
      await frame();
    }
    pos = { x, y };
  },
  async click(x, y, s = 0.6) {
    await this.moveTo(x, y, s);
    if (phone) {
      await during(pointer(x, y, 1)); await this.wait(0.15);
      await during(page.touchscreen.tap(x, y)); await this.wait(0.25); await during(pointer(x, y, 0));
    } else {
      await this.wait(0.12); await during(page.mouse.down()); await frame(); await frame(); await during(page.mouse.up());
    }
  },
  // Press at (x0, y0), drag to (x1, y1) over s seconds with the pointer following, release.
  async drag(x0, y0, x1, y1, s = 0.8) {
    await this.moveTo(x0, y0, 0.5); await this.wait(0.1);
    await during(page.mouse.down());
    const k = Math.max(2, Math.round(s * FPS));
    for (let i = 1; i <= k; i++) {
      const e = ease(i / k), px = x0 + (x1 - x0) * e, py = y0 + (y1 - y0) * e;
      await during(page.mouse.move(px, py)); await during(pointer(px, py, 1)); await frame();
    }
    await during(page.mouse.up()); pos = { x: x1, y: y1 };
  },
  async clickEl(sel, s = 0.6) {
    const el = typeof sel === "string" ? await page.$(sel) : sel;
    if (!el) throw new Error(`no element ${sel}`);
    const b = await el.boundingBox();
    return this.click(b.x + b.width / 2, b.y + b.height / 2, s);
  },
  async wheel(dy, steps = 1) { for (let i = 0; i < steps; i++) { await during(page.mouse.wheel({ deltaY: dy })); await this.wait(0.5); } },
  async type(text, perChar = 0.07) { for (const ch of text) { await during(page.keyboard.type(ch)); await this.wait(perChar); } },
  async press(key) { await during(page.keyboard.press(key)); await frame(); },
  during, frame,
  // Nearest point to (x, y), within r px, whose topmost element matches `selector` (e.g. a clickable map feature).
  async nearest(x, y, selector = "path.leaflet-interactive", r = 90) {
    let res;
    await during(page.evaluate((x, y, sel, r) => {
      for (let d = 0; d <= r; d += 2) for (let a = 0; a < 360; a += 8) {
        const px = x + d * Math.cos(a * Math.PI / 180), py = y + d * Math.sin(a * Math.PI / 180);
        const el = document.elementFromPoint(px, py);
        if (el && el.matches(sel)) return [Math.round(px), Math.round(py)];
      }
      return null;
    }, x, y, selector, r).then((v) => (res = v)));
    return res;
  },
  async aria(role, name) { let el = null; await during(page.$(`::-p-aria([name="${name}"][role="${role}"])`).then((v) => (el = v))); return el; },
  // Centre of the first visible button whose text or aria-label is exactly `name`, or null. A plain DOM lookup:
  // accessibility-tree queries can hang on heavy pages under frame control.
  async find(name, selector = "button, [role=button]") {
    let res = null;
    await during(page.evaluate((name, sel) => {
      for (const e of document.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect(); if (!r.width) continue;
        if ((e.innerText ?? "").replace(/\s+/g, " ").trim() === name || e.getAttribute("aria-label") === name) return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
      }
      return null;
    }, name, selector).then((v) => (res = v)));
    return res;
  },
};

try {
  await scenario.run(page, h);
} finally {
  await browser.close();
}
if (n < 2) throw new Error(`only ${n} frames recorded`);
const W = view.width * view.deviceScaleFactor, H = view.height * view.deviceScaleFactor;
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(frameDir, "f%06d.jpg"),
  "-vf", `scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-preset", "slow",
  "-movflags", "+faststart", resolve(outPath)], { stdio: "inherit" });
console.log(`${outPath}: ${n} frames, ${(n / FPS).toFixed(2)} s at ${FPS} fps`);
rmSync(frameDir, { recursive: true, force: true });
