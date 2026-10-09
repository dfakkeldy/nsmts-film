// Exploration for R2 (not a recording): load sheet 16 into the georeferencer, load its control points, switch to
// the curved warp, and screenshot each step so the recording's coordinates can be planned.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `capture/probe/r2-${n}.png` });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto("https://kinnokilabs.com/apps/nsmarksthespot/map/?theme=georeferencing&position=46.07,-61.42,11", { waitUntil: "domcontentloaded" });
await sleep(12000);
await shot(p, "0-start");
const add = await p.$('input[aria-label="Add a map file"]');
console.log("map file input:", !!add);
await add.uploadFile("assets/scans/fletcher-sheet16-w3000.jpg");
await sleep(9000);
await shot(p, "1-scan");
console.log((await p.evaluate(() => document.querySelector(".georeference-panel")?.innerText ?? "no panel")).slice(0, 500));
const pts = await p.$('input[aria-label="Load a Fletcher points file"]');
console.log("points input:", !!pts);
if (pts) { await pts.uploadFile("assets/scans/fletcher-sheet16-w3000-points.csv"); await sleep(9000); await shot(p, "2-points"); }
console.log((await p.evaluate(() => document.querySelector(".georeference-panel")?.innerText ?? "no panel")).slice(0, 900));
const tps = await p.$('::-p-aria([name="Curved warp (TPS)"][role="checkbox"])');
console.log("tps:", !!tps);
if (tps) { await tps.click(); await sleep(8000); await shot(p, "3-tps"); }
const marks = await p.evaluate(() => [...document.querySelectorAll(".georeference-panel [class*=gcp], .georeference-panel svg circle, .georeference-panel [data-gcp-id]")]
  .slice(0, 12).map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, e.className?.baseVal ?? e.className, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }));
console.log(JSON.stringify(marks));
console.log((await p.evaluate(() => document.querySelector(".georeference-panel")?.innerText ?? "no panel")).slice(0, 900));
await b.close();
