// Exploration for R9 (not a recording): how Poker saves itself for offline use, and its offline reload.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `capture/probe/r9b-${n}.png` });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const ctx = await b.createBrowserContext();
const p = await ctx.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
p.on("console", (m) => { if (/service|offline|cache|sw/i.test(m.text())) console.log("console", m.text().slice(0, 200)); });
await p.goto("https://kinnokilabs.com/poker", { waitUntil: "domcontentloaded" });
console.log("url:", p.url());
for (let i = 0; i < 6; i++) { await sleep(5000); console.log(i, "sw:", await p.evaluate(async () => { const rs = await navigator.serviceWorker?.getRegistrations(); return JSON.stringify((rs || []).map((r) => [r.scope, !!r.active, !!r.installing, !!r.waiting])); })); }
await p.touchscreen.tap(360, 30); await sleep(1500); await shot(p, "0-options");
console.log("options:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1500));
const tapText = async (name) => { const xy = await p.evaluate((name) => { for (const e of document.querySelectorAll("button")) { const r = e.getBoundingClientRect(); if (r.width && e.innerText.replace(/\s+/g, " ").trim() === name) return [r.x + r.width / 2, r.y + r.height / 2]; } return null; }, name); console.log("tap", name, xy); if (xy) { await p.touchscreen.tap(...xy); } return xy; };
await tapText("Save offline");
for (let i = 0; i < 8; i++) { await sleep(3000); const st = (await p.evaluate(() => document.body.innerText)).match(/(Online|Offline|Saving|Saved)[^|\n]{0,80}/g); console.log(i, JSON.stringify(st)); }
await shot(p, "0b-saved");
console.log("sw now:", await p.evaluate(async () => JSON.stringify((await navigator.serviceWorker.getRegistrations()).map((r) => [r.scope, !!r.active]))));
await tapText("Done"); await sleep(1000);
await p.setOfflineMode(true); await p.reload({ waitUntil: "domcontentloaded" }).catch((e) => console.log("reload", e.message)); await sleep(8000); await shot(p, "1-offline");
console.log("offline:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 900));
await p.touchscreen.tap(360, 30); await sleep(1500); await shot(p, "2-offline-options");
console.log("offline options:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1200));
await b.close();
