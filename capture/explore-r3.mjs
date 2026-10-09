// Exploration for R3 (not a recording): the Fletcher layer at Mabou, switched to 3D terrain; report the 3D view's
// controls and screenshot a turn, so the recording can be planned.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `capture/probe/r3-${n}.png` });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.log("pageerror", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("console error", m.text().slice(0, 200)); });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("ns-marks-the-spot:province-license:v1", "accepted"); } catch {} });
await p.goto("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=46.07,-61.39,13", { waitUntil: "domcontentloaded" });
await sleep(14000);
await shot(p, "0-2d");
const btn = await p.$('::-p-aria([name="3D terrain"][role="button"])');
console.log("3D button:", !!btn);
if (btn) { await btn.click(); }
for (let i = 1; i <= 4; i++) { await sleep(8000); await shot(p, `1-3d-${i}`); }
const buttons = await p.evaluate(() => [...document.querySelectorAll("button, [role=button], canvas")].filter((e) => e.getBoundingClientRect().width > 0)
  .map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.innerText || e.getAttribute("aria-label") || e.className || "").toString().slice(0, 50), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), Math.round(r.width), Math.round(r.height)]; }));
console.log(JSON.stringify(buttons).slice(0, 3000));
// A slow turn: right-drag across the map (MapLibre rotates and pitches with the right button or ctrl+drag).
await p.mouse.move(1200, 600); await p.keyboard.down("Control"); await p.mouse.down();
for (let i = 1; i <= 30; i++) { await p.mouse.move(1200 + i * 8, 600 - i * 2); await sleep(60); }
await p.mouse.up(); await p.keyboard.up("Control");
await sleep(6000); await shot(p, "2-turn");
console.log((await p.evaluate(() => document.body.innerText)).slice(0, 800));
await b.close();
