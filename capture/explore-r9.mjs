// Exploration for R9 (not a recording): Poker at phone size. Search 5471 Highway 19, look for the trace tool and the
// offline state. Screenshots each step and lists the controls.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `capture/probe/r9-${n}.png` });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const ctx = await b.createBrowserContext();
const p = await ctx.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
p.on("pageerror", (e) => console.log("pageerror", e.message));
const controls = async () => p.evaluate(() => [...document.querySelectorAll("button, [role=button], input, a, dialog[open]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.y < 844 && r.y > -1; })
  .map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.type || "").replace(/\s+/g, " ").slice(0, 50), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }));
await p.goto("https://kinnokilabs.com/poker", { waitUntil: "domcontentloaded" });
await sleep(10000); await shot(p, "0-load");
console.log("controls0:", JSON.stringify(await controls()));
console.log("text0:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1200));
const input = await p.$("input[type=search], input[type=text], input:not([type])");
if (input) { const bb = await input.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.keyboard.type("5471 Highway 19", { delay: 60 }); await sleep(2500); await shot(p, "1-typed");
  console.log("controls1:", JSON.stringify(await controls())); await p.keyboard.press("Enter"); await sleep(6000); await shot(p, "2-found");
  console.log("controls2:", JSON.stringify(await controls()));
  console.log("text2:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 1500)); }
// trace: house to the road, then Finish
const tap = async (x, y, n) => { await p.touchscreen.tap(x, y); await sleep(1200); if (n) await shot(p, n); };
await tap(195, 421); await tap(240, 423); await tap(282, 425, "3-trace");
console.log("text3:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 800));
const fin = await p.evaluate(() => { const e = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Finish"); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await tap(...fin, "4-finished");
console.log("text4:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 800));
console.log("controls4:", JSON.stringify(await controls()));
// aerial
await tap(352, 86, "5-aerial"); await sleep(3000); await shot(p, "5b-aerial");
console.log("controls5:", JSON.stringify(await controls()));
console.log("text5:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 900));
// offline: the service worker state, then reload offline
console.log("sw:", await p.evaluate(async () => { const r = await navigator.serviceWorker?.getRegistration(); return r ? (r.active ? "active " + r.active.scriptURL : "registered") : "none"; }));
await p.setOfflineMode(true); await p.reload({ waitUntil: "domcontentloaded" }).catch((e) => console.log("reload", e.message)); await sleep(8000); await shot(p, "6-offline");
console.log("text6:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 900));
await b.close();
