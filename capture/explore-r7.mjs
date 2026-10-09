// Exploration for R7 (not a recording): the main map at phone size; import the exported GeoPDF (Mabou, Fletcher) and
// show the location dot on it. Screenshots each step and lists the visible controls.
import puppeteer from "puppeteer-core";
import { shimUpsert } from "./shim-upsert.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `capture/probe/r7-${n}.png` });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const ctx = await b.createBrowserContext();
await ctx.overridePermissions("https://kinnokilabs.com", ["geolocation"]);
const p = await ctx.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
await p.setGeolocation({ latitude: 46.0705, longitude: -61.3935, accuracy: 12 });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await shimUpsert(p, (...a) => console.log(...a));
p.on("console", (m) => { if (["error", "warn", "warning"].includes(m.type())) console.log("console", m.type(), m.text().slice(0, 300)); });
p.on("requestfailed", (r) => console.log("requestfailed", r.url().slice(0, 160), r.failure()?.errorText));
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("ns-marks-the-spot:province-license:v1", "accepted"); } catch {} });
await p.goto("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern&position=46.07,-61.39,13", { waitUntil: "domcontentloaded" });
await sleep(10000);
await shot(p, "0-load");
const controls = async () => p.evaluate(() => [...document.querySelectorAll("button, [role=button], input, a")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.y < 844 && r.y > -1; })
  .map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || e.type || "").replace(/\s+/g, " ").slice(0, 40), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }));
console.log("controls:", JSON.stringify(await controls()));
const clickText = async (name) => { const xy = await p.evaluate((name) => { for (const e of document.querySelectorAll("button, [role=button], a")) { const r = e.getBoundingClientRect(); if (r.width && ((e.innerText || "").replace(/\s+/g, " ").trim().startsWith(name) || e.getAttribute("aria-label") === name)) { e.scrollIntoView({ block: "center" }); const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; } } return null; }, name); console.log("click", name, xy); if (xy) { await p.touchscreen.tap(...xy); await sleep(2500); } return xy; };
await clickText("⌕ Search & layers"); await shot(p, "0b-panel");
console.log("panel controls:", JSON.stringify(await controls()));
await clickText("My Maps"); await shot(p, "0c-mymaps");
console.log("my maps controls:", JSON.stringify(await controls()));
const add = await p.$('input[aria-label="Add a map file"]');
console.log("map file input present:", !!add);
if (add) { await add.uploadFile("capture/downloads/nova-scotia-map-2026-10-09.pdf"); await sleep(12000); await shot(p, "1-import"); console.log("after import:", JSON.stringify(await controls())); }
const radio = await p.$("input[type=radio]"); if (radio) { const bb = await radio.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(800); }
await clickText("Use this frame"); await sleep(6000); await shot(p, "2-placed");
console.log("placed controls:", JSON.stringify(await controls()));
if (await p.evaluate(() => [...document.querySelectorAll("button")].some((e) => e.innerText.trim() === "×" && e.getBoundingClientRect().width))) { await clickText("×"); await sleep(1500); }
await shot(p, "3-map");
await clickText("Use my location"); await sleep(6000); await shot(p, "4-located");
console.log("located controls:", JSON.stringify(await controls()));
const labels = await p.evaluate(() => [...document.querySelectorAll("button")].filter((e) => e.getBoundingClientRect().width).map((e) => [e.getAttribute("aria-label"), e.title, e.innerText.slice(0, 30), Math.round(e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2), Math.round(e.getBoundingClientRect().y + e.getBoundingClientRect().height / 2)]));
console.log("buttons:", JSON.stringify(labels));
const tapAt = async (x, y, n) => { await p.touchscreen.tap(x, y); await sleep(2500); await shot(p, n); console.log(n, JSON.stringify(await controls())); console.log("inputs:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input[type=file]")].map((e) => [e.getAttribute("aria-label"), e.accept])))); };
const b1 = labels.find((l) => /mark|point|pin/i.test((l[0] || "") + (l[1] || ""))); console.log("mark button", JSON.stringify(b1));
await p.setGeolocation({ latitude: 46.0705, longitude: -61.3935, accuracy: 8 });
if (b1) await tapAt(b1[3], b1[4], "5-mark");
await sleep(15000); await shot(p, "6-marked"); console.log("6-marked", JSON.stringify(await controls()));
console.log("inputs2:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input")].map((e) => [e.type, e.getAttribute("aria-label"), e.accept, e.capture]))));
console.log("text6:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1500));
// photos: My Maps > Add photos to map > Choose photos
await clickText("⌕ Search & layers"); await sleep(1500);
await clickText("Add photos to map"); await sleep(1500); await shot(p, "7-photos");
const ph = await p.$$("input[type=file]"); console.log("file inputs now:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("input[type=file]")].map((e) => [e.getAttribute("aria-label"), e.accept, e.multiple]))));
const photoInput = await p.$('input[type=file][accept*="image"]:not([aria-label="Add a map file"])') ?? ph[ph.length - 1];
await photoInput.uploadFile("capture/probe/test-photo.jpg"); await sleep(6000); await shot(p, "8-photo-added");
console.log("text8:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1800));
console.log("8 controls:", JSON.stringify(await controls()));
await clickText("Create 1 point"); await sleep(3000); await shot(p, "9-photo-layer");
console.log("text9:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(600, 2000));
await clickText("×"); await sleep(2000); await shot(p, "10-photo-map");
await clickText("Record a track"); await sleep(1500);
for (let i = 1; i <= 8; i++) { await p.setGeolocation({ latitude: 46.0705 + i * 0.00012, longitude: -61.3935 + i * 0.0002, accuracy: 6 }); await sleep(1000); }
await shot(p, "11-track");
console.log("text11:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1200));
console.log("11 controls:", JSON.stringify(await controls()));
console.log((await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1800));
await b.close();
