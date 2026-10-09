// Exploration for the gold-mine insert (not a recording): Fletcher sheet 19's "Gold Mine" beside Glendale Brook
// (F19-JUD-094) at zoom 14 and 15, then its popup; screenshots each step and prints the popup's text.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("ns-marks-the-spot:province-license:v1", "accepted"); } catch {} });
const [lat, lon, z] = (process.argv[2] ?? "45.8339,-61.3455,14").split(",");
await p.goto(`https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=fletcher&taxSale=off&mode=current&layers=modern,fletcher&position=${lat},${lon},${z}`, { waitUntil: "domcontentloaded" });
await sleep(16000);
await p.screenshot({ path: `capture/probe/gm-a-z${z}.png` });
await p.mouse.move(1120, 517); await p.mouse.wheel({ deltaY: Number(process.argv[3] ?? -60) }); await sleep(6000);
await p.screenshot({ path: `capture/probe/gm-b-wheel.png` });
console.log("after wheel:", await p.evaluate(() => document.querySelector("[class*=coord], .leaflet-control-container")?.innerText?.slice(0, 120)));
const mark = await p.evaluate(() => [...document.querySelectorAll(".leaflet-marker-icon, .leaflet-interactive")].map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.className?.baseVal ?? e.className).slice(0, 60), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), Math.round(r.width)]; }).filter((m) => Math.abs(m[2] - 1120) < 60 && Math.abs(m[3] - 517) < 60));
console.log("marks near centre:", JSON.stringify(mark));
const [x, y] = mark.length ? mark[0].slice(2, 4) : [1120, 517];
await p.mouse.click(x, y); await sleep(5000);
await p.screenshot({ path: `capture/probe/gm-c-popup.png` });
console.log("popup:", await p.evaluate(() => { const e = document.querySelector(".leaflet-popup"); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), e.innerText]; }));
await b.close();
