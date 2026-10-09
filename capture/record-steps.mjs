// Records a scripted session as step captures: a normal headless browser, one screenshot per recorded frame.
//
//   node capture/record-steps.mjs <scenario.mjs> <out.mp4> [--phone]
//
// For views that stall under frame control (the georeferencer's panel), and for direct manipulation with no
// long animations: every pointer step, drag step or keystroke is followed by a short real-time pause for the page
// to update, then a screenshot, which becomes exactly one frame at 30 fps. A wait of s seconds keeps capturing
// real time for s seconds and spreads what it caught over s x 30 frames, so a change during a wait still shows,
// just without in-between motion. Same scenario API as record-vt.mjs (load, settle, start, wait, moveTo, click,
// drag, type, press, during, frame, nearest, aria, find); nothing on the page is changed except an injected pointer.
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const [scenarioPath, outPath, ...flags] = process.argv.slice(2);
const phone = flags.includes("--phone");
const scenario = await import(pathToFileURL(resolve(scenarioPath)).href);
const opt = scenario.options ?? {};
const FPS = 30, SETTLE = opt.stepSettleMs ?? 90;
const view = phone ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                   : { width: 1920, height: 1080, deviceScaleFactor: opt.dpr ?? 1 };
const T0 = Date.now();
const log = (...a) => console.error(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  headless: true, protocolTimeout: 600000, ...(opt.profile ? { userDataDir: resolve(opt.profile) } : {}),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-color-profile=srgb"],
});
const context = opt.profile ? browser.defaultBrowserContext() : await browser.createBrowserContext();
if (opt.geolocation) await context.overridePermissions(opt.origin ?? "https://kinnokilabs.com", ["geolocation"]);
const page = await context.newPage();
await page.setViewport(view);
if (phone) await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
if (opt.geolocation) await page.setGeolocation(opt.geolocation);
if (opt.noCache) await page.setCacheEnabled(false);
page.on("pageerror", (e) => console.log("pageerror:", e.message));
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

const frameDir = resolve(dirname(outPath), `.steps-${Date.now()}`);
mkdirSync(frameDir, { recursive: true });
let n = 0, recording = false, lastFile = null;
const name = (i) => join(frameDir, `f${String(i).padStart(6, "0")}.jpg`);
async function shoot() {
  const buf = await page.screenshot({ type: "jpeg", quality: 93 });
  return buf;
}
async function frame() {
  if (!recording) return;
  await sleep(SETTLE);
  writeFileSync(name(n), await shoot()); lastFile = name(n); n++;
}
const ease = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
let pos = { x: view.width * 0.62, y: view.height * 0.62 };
const pointer = (x, y, o) => page.evaluate((x, y, o) => window.__recPointer?.(x, y, o), x, y, o);

const h = {
  phone, page,
  async load(url, settleMs = 12000) { log("load", url); await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 }); await sleep(settleMs); log("settled"); },
  async start() { recording = true; log("recording"); },
  async stop() { recording = false; },
  async settle(ms) { log("settle", ms); await sleep(ms); },
  async during(p) { return p; },
  frame,
  // Capture real time for s seconds, spread over s x 30 frames (a still page simply repeats).
  async wait(s) {
    const total = Math.max(1, Math.round(s * FPS)); if (!recording) { await sleep(s * 1000); return; }
    const t0 = Date.now(), shots = [];
    while (Date.now() - t0 < s * 1000) shots.push({ t: (Date.now() - t0) / 1000, buf: await shoot() });
    if (!shots.length) shots.push({ t: 0, buf: await shoot() });
    for (let i = 0; i < total; i++) {
      const t = i / FPS; let k = 0; while (k + 1 < shots.length && shots[k + 1].t <= t) k++;
      writeFileSync(name(n), shots[k].buf); lastFile = name(n); n++;
    }
  },
  async moveTo(x, y, s = 0.6) {
    if (phone) { pos = { x, y }; return; }
    const from = { ...pos }, k = Math.max(1, Math.round(s * FPS));
    for (let i = 1; i <= k; i++) {
      const e = ease(i / k), px = from.x + (x - from.x) * e, py = from.y + (y - from.y) * e;
      await page.mouse.move(px, py); await pointer(px, py, 1); await frame();
    }
    pos = { x, y };
  },
  async click(x, y, s = 0.6) {
    await this.moveTo(x, y, s);
    if (phone) { await pointer(x, y, 1); await page.touchscreen.tap(x, y); await this.wait(0.3); await pointer(x, y, 0); }
    else { await page.mouse.down(); await frame(); await page.mouse.up(); await frame(); }
  },
  async drag(x0, y0, x1, y1, s = 0.8) {
    await this.moveTo(x0, y0, 0.5); await page.mouse.down(); await frame();
    const k = Math.max(2, Math.round(s * FPS));
    for (let i = 1; i <= k; i++) {
      const e = ease(i / k), px = x0 + (x1 - x0) * e, py = y0 + (y1 - y0) * e;
      await page.mouse.move(px, py); await pointer(px, py, 1); await frame();
    }
    await page.mouse.up(); await frame(); pos = { x: x1, y: y1 };
  },
  async clickEl(sel, s = 0.6) { const el = typeof sel === "string" ? await page.$(sel) : sel; const b = await el.boundingBox(); return this.click(b.x + b.width / 2, b.y + b.height / 2, s); },
  async type(text, perChar = 0.07) { for (const ch of text) { await page.keyboard.type(ch); await this.wait(perChar); } },
  async press(key) { await page.keyboard.press(key); await frame(); },
  async nearest(x, y, selector = "path.leaflet-interactive", r = 90) {
    return page.evaluate((x, y, sel, r) => {
      for (let d = 0; d <= r; d += 2) for (let a = 0; a < 360; a += 8) {
        const px = x + d * Math.cos(a * Math.PI / 180), py = y + d * Math.sin(a * Math.PI / 180);
        const el = document.elementFromPoint(px, py); if (el && el.matches(sel)) return [Math.round(px), Math.round(py)];
      }
      return null;
    }, x, y, selector, r);
  },
  aria: (role, name) => page.$(`::-p-aria([name="${name}"][role="${role}"])`),
  // Centre of the first visible button whose text or aria-label is exactly `name`, or null (as record-vt.mjs).
  find: (name, selector = "button, [role=button]") => page.evaluate((name, sel) => {
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect(); if (!r.width) continue;
      if ((e.innerText ?? "").trim() === name || e.getAttribute("aria-label") === name) return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
    }
    return null;
  }, name, selector),
};

try { await scenario.run(page, h); } finally { await browser.close(); }
if (n < 2) throw new Error(`only ${n} frames recorded`);
const W = view.width * view.deviceScaleFactor, H = view.height * view.deviceScaleFactor;
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(frameDir, "f%06d.jpg"),
  "-vf", `scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-preset", "slow",
  "-movflags", "+faststart", resolve(outPath)], { stdio: "inherit" });
console.log(`${outPath}: ${n} frames, ${(n / FPS).toFixed(2)} s at ${FPS} fps (step capture)`);
rmSync(frameDir, { recursive: true, force: true });
