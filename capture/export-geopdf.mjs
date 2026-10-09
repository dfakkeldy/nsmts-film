// Exports a GeoPDF (and, as an exploration for R6, reports each step): Export map (PDF) over Mabou with Fletcher on; walk the frame step and the
// export dialog, screenshot each step, and keep the downloaded GeoPDF for an external check.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dl = resolve("capture/downloads"); mkdirSync(dl, { recursive: true });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
const cdp = await p.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl, eventsEnabled: true });
cdp.on("Browser.downloadProgress", (e) => { if (e.state !== "inProgress") console.log("download", e.state); });
await p.goto("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=46.163,-61.43,13", { waitUntil: "domcontentloaded" });
await sleep(6000);
const acc = await p.$('::-p-aria([name="Accept and view map layers"][role="button"])'); if (acc) await acc.click();
await sleep(8000);
const btn = await p.$('::-p-aria([name="Export map (PDF)"][role="button"])'); await btn.click();
await sleep(3000);
await p.screenshot({ path: "capture/probe/r6-0-frame.png" });
const buttons = async () => p.evaluate(() => [...document.querySelectorAll("button, input, [role=button], textarea")].filter((e) => e.getBoundingClientRect().width > 0)
  .map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.innerText || e.getAttribute("aria-label") || e.value || "").slice(0, 40), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; })
  .filter((x) => x[1]));
console.log("frame step:", JSON.stringify(await buttons()));
const handle = await p.evaluate(() => { const els = [...document.querySelectorAll("*")].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.cursor.includes("resize") && r.width > 0 && r.width < 40; });
  return els.map((e) => { const r = e.getBoundingClientRect(); return [e.className?.baseVal ?? e.className, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }); });
console.log("resize handles:", JSON.stringify(handle));
const cont = await p.$('::-p-aria([name="Continue"][role="button"])'); if (cont) { await cont.click(); await sleep(4000); }
await p.screenshot({ path: "capture/probe/r6-1-dialog.png" });
console.log("dialog step:", JSON.stringify(await buttons()));
const down = await p.$('::-p-aria([name="Download"][role="button"])') ?? await p.$('::-p-aria([name="Download PDF"][role="button"])');
console.log("download button:", !!down);
if (down) { await down.click(); for (let i = 0; i < 12; i++) { await sleep(5000); await p.screenshot({ path: `capture/probe/r6-2-after.png` }); } }
console.log("dialog after:", JSON.stringify(await buttons()));
await b.close();
