// Debug probe for begin-frame control: launch, create a controlled target, load a page, pump frames, screenshot.
import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  headless: "shell", protocolTimeout: 60000,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-begin-frame-control",
         "--run-all-compositor-stages-before-draw", "--disable-new-content-rendering-timeout", "--disable-threaded-animation",
         "--disable-threaded-scrolling", "--disable-checker-imaging"] });
log("launched");
const context = await browser.createBrowserContext();
const bs = await browser.target().createCDPSession();
const { targetId } = await bs.send("Target.createTarget", { url: "about:blank", browserContextId: context.id, enableBeginFrameControl: true });
log("target", targetId);
const target = await browser.waitForTarget((t) => t._targetId === targetId, { timeout: 15000 });
log("got target");
const page = await target.page();
log("page", !!page);
await page.setViewport({ width: 1920, height: 1080 });
const cdp = await page.createCDPSession();
let ticks = 1e6;
const begin = async (shot) => {
  const r = await cdp.send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval: 33.3,
    ...(shot ? { screenshot: { format: "jpeg", quality: 80 } } : {}) });
  ticks += 33.3; return r;
};
log("first frame", JSON.stringify(Object.keys(await begin(false))));
const nav = page.goto(process.argv[2], { waitUntil: "domcontentloaded", timeout: 60000 });
let done = false; nav.then(() => (done = true), (e) => { done = true; log("nav err", e.message); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let k = 0; while (!done && k < 2000) { await begin(false); await sleep(40); k++; if (k % 100 === 0) log('loading', k); }
log("nav done after frames", k);
for (let i = 0; i < 300; i++) { const t0 = Date.now(); await begin(false); await sleep(40); if (i % 50 === 0) log("pump", i, Date.now() - t0, "ms"); }
const t1 = Date.now(); const rr = await begin(true); log('shot ms', Date.now() - t1);
const r = await begin(true); log("shot", r.hasDamage, (r.screenshotData || "").length);
if (r.screenshotData) writeFileSync("capture/probe/bf.jpg", Buffer.from(r.screenshotData, "base64"));
await browser.close(); log("closed");
