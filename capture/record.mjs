// Records a scripted browser session on the live site to a constant 30 fps MP4.
//
//   node capture/record.mjs <scenario.mjs> <out.mp4> [--phone] [--keep-frames]
//
// A scenario exports `options` (optional) and `async function run(page, h)`. Frames come from the DevTools
// screencast (one JPEG per repaint, with its timestamp) and are resampled to 30 fps by ffmpeg, so a still page
// holds its last frame instead of dropping time. Headless Chrome draws no pointer, so `h` injects a small pointer
// (desktop) or tap ring (phone) that follows the real input events; nothing else on the page is changed.
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const [scenarioPath, outPath, ...flags] = process.argv.slice(2);
const phone = flags.includes("--phone");
const keep = flags.includes("--keep-frames");
const scenario = await import(pathToFileURL(resolve(scenarioPath)).href);
const opt = scenario.options ?? {};
const view = phone ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                   : { width: 1920, height: 1080, deviceScaleFactor: 1 };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
         "--hide-scrollbars", "--force-color-profile=srgb", `--window-size=${view.width},${view.height}`],
});
const context = await browser.createBrowserContext();
if (opt.geolocation) await context.overridePermissions(opt.origin ?? "https://kinnokilabs.com", ["geolocation"]);
const page = await context.newPage();
await page.setViewport(view);
if (phone) await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
if (opt.geolocation) await page.setGeolocation(opt.geolocation);
page.on("pageerror", (e) => console.log("pageerror:", e.message));

// Pointer / tap ring, drawn above everything and ignored by hit-testing.
await page.evaluateOnNewDocument((isPhone) => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.id = "__rec_pointer";
    d.style.cssText = isPhone
      ? "position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid rgba(20,20,20,.55);background:rgba(255,255,255,.25);pointer-events:none;z-index:2147483647;opacity:0;transition:none"
      : "position:fixed;left:0;top:0;width:22px;height:22px;pointer-events:none;z-index:2147483647;opacity:0";
    if (!isPhone) d.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L6.5 13.8 L9.6 20.5 L12.6 19.2 L9.6 12.6 L15.6 12.6 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(d);
    const move = (x, y) => { d.style.transform = `translate(${x}px,${y}px)`; d.style.opacity = 1; };
    addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
    addEventListener("pointerdown", (e) => { move(e.clientX, e.clientY); if (isPhone) d.style.background = "rgba(255,255,255,.55)"; }, true);
    addEventListener("pointerup", () => { if (isPhone) { d.style.background = "rgba(255,255,255,.25)"; setTimeout(() => (d.style.opacity = 0), 250); } }, true);
  });
}, phone);

const frameDir = resolve(dirname(outPath), `.frames-${Date.now()}`);
mkdirSync(frameDir, { recursive: true });
const frames = [];
let recording = false;
const cdp = await page.createCDPSession();
cdp.on("Page.screencastFrame", async (f) => {
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  if (!recording) return;
  const name = `f${String(frames.length).padStart(6, "0")}.jpg`;
  writeFileSync(join(frameDir, name), Buffer.from(f.data, "base64"));
  frames.push({ name, t: f.metadata.timestamp });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const h = {
  phone, sleep,
  async start() {
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1,
      maxWidth: view.width * view.deviceScaleFactor, maxHeight: view.height * view.deviceScaleFactor });
    recording = true; this.t0 = Date.now() / 1000;
  },
  async stop() { recording = false; await cdp.send("Page.stopScreencast"); },
  // Smooth pointer travel (desktop), then a click.
  async moveTo(x, y, ms = 600) {
    const from = this._pos ?? { x: view.width * 0.6, y: view.height * 0.6 };
    const n = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) {
      const k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await sleep(ms / n);
    }
    this._pos = { x, y };
  },
  async click(x, y, ms = 600) { await this.moveTo(x, y, ms); await sleep(120); await page.mouse.down(); await sleep(70); await page.mouse.up(); },
  async tap(x, y) { await page.touchscreen.tap(x, y); this._pos = { x, y }; },
  async clickEl(sel, ms = 600) {
    const el = typeof sel === "string" ? await page.waitForSelector(sel, { visible: true, timeout: 15000 }) : sel;
    const b = await el.boundingBox();
    if (phone) return this.tap(b.x + b.width / 2, b.y + b.height / 2);
    return this.click(b.x + b.width / 2, b.y + b.height / 2, ms);
  },
  async typeSlow(text, ms = 70) { for (const ch of text) { await page.keyboard.type(ch); await sleep(ms); } },
  byText: (role, name) => page.waitForSelector(`::-p-aria([name="${name}"][role="${role}"])`, { visible: true, timeout: 20000 }),
};

try {
  await scenario.run(page, h);
} finally {
  if (recording) await h.stop();
  await browser.close();
}
if (frames.length < 2) throw new Error(`only ${frames.length} frames recorded`);

// Constant 30 fps: each screencast frame lasts until the next one arrives.
const lines = [];
for (let i = 0; i < frames.length; i++) {
  const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / 30;
  lines.push(`file '${frames[i].name}'`, `duration ${Math.max(dur, 0.001).toFixed(4)}`);
}
lines.push(`file '${frames.at(-1).name}'`);
writeFileSync(join(frameDir, "list.txt"), lines.join("\n"));
const W = view.width * view.deviceScaleFactor, H = view.height * view.deviceScaleFactor;
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(frameDir, "list.txt"),
  "-vf", `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-preset", "slow",
  "-movflags", "+faststart", resolve(outPath)], { stdio: "inherit" });
const span = frames.at(-1).t - frames[0].t;
console.log(`${outPath}: ${frames.length} screencast frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps captured) -> 30 fps`);
if (!keep) rmSync(frameDir, { recursive: true, force: true });
