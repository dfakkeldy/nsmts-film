// Exploration for R3 at full height exaggeration (not a recording): the R3 view in 3D terrain, its settings panel
// opened, "Terrain height" set to the slider's maximum (10x), then screenshots before and after and the panel's text.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.setCacheEnabled(false);
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("ns-marks-the-spot:province-license:v1", "accepted"); } catch {} });
await p.goto(`https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=${process.argv[2] ?? "46.168,-61.405,14"}`, { waitUntil: "domcontentloaded" });
await sleep(10000);
const buttons = () => p.evaluate(() => [...document.querySelectorAll("button, summary, [role=button]")].filter((e) => e.getBoundingClientRect().width > 0)
  .map((e) => { const r = e.getBoundingClientRect(); return [(e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").slice(0, 40), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), e.getAttribute("aria-expanded")]; }));
const click = async (name) => { const hit = (await buttons()).find((x) => x[0] === name); if (!hit) { console.log("no", name); return false; } await p.mouse.click(hit[1], hit[2]); return true; };
await click("3D terrain"); await sleep(30000);
await p.screenshot({ path: `capture/probe/r3x-0-${(process.argv[2] ?? "default").replace(/,/g, "_")}.png` });
console.log("3D buttons:", JSON.stringify((await buttons()).filter((x) => x[1] > 1400 || /terrain|setting|height/i.test(x[0]))));
for (const name of ["Terrain settings", "3D settings", "Settings"]) if (await click(name)) break;
await sleep(1500);
await click("Terrain height"); await sleep(1500);
const tag = (process.argv[2] ?? "default").replace(/,/g, "_");
const set = await p.evaluate(() => {
  const r = [...document.querySelectorAll("input[type=range]")].find((e) => e.getBoundingClientRect().width > 0 && /Height exaggeration/.test(e.closest("label")?.innerText ?? ""));
  if (!r) return null;
  const b = r.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y + b.height / 2), Math.round(b.width), r.value, r.max];
});
console.log("height slider:", set);
await p.screenshot({ path: "capture/probe/r3x-1-panel.png" });
if (set) { await p.mouse.click(set[0] + set[2] - 2, set[1]); await sleep(1000); }
console.log("now:", await p.evaluate(() => [...document.querySelectorAll(".relief-slider output")].map((o) => o.innerText)));
const dir = () => p.evaluate(() => [...document.querySelectorAll("label, div, span")].map((e) => e.innerText).find((t) => /^Direction\s+-?\d+°/.test(t ?? "")));
for (const [name, n] of (process.argv[3] ?? "").split(";").filter(Boolean).map((x) => x.split("*"))) for (let i = 0; i < +n; i++) { await click(name); await sleep(700); }
console.log("direction:", await dir());
await click("3D settings"); await sleep(20000);
await p.screenshot({ path: `capture/probe/r3x-2-ten-${tag}${process.argv[3] ? "-" + process.argv[3].replace(/[^a-z0-9]/gi, "") : ""}.png` });
console.log("status:", await p.evaluate(() => document.querySelector(".research-terrain-status")?.innerText ?? "ready"));
await b.close();
