// Exploration for R1 (not a recording): search 5471 Highway 19 on the main map, open its parcel sheet, and
// report the sheet's text and layout so the recording can be planned.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.goto("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,ns-aerial,nsprd&position=45.878,-61.492,16", { waitUntil: "domcontentloaded" });
await sleep(6000);
const acc = await p.$('::-p-aria([name="Accept and view map layers"][role="button"])');
if (acc) { await acc.click(); console.log("licence accepted"); }
await sleep(8000);
const box = await p.$('input[placeholder="PID or address"]');
const bb = await box.boundingBox(); console.log("search box", JSON.stringify(bb));
await box.click(); await p.keyboard.type("5471 Highway 19", { delay: 60 });
await sleep(3000);
await p.screenshot({ path: "capture/probe/r1-0-suggest.png" });
const opts = await p.evaluate(() => [...document.querySelectorAll('[role="option"]')].map((o) => { const r = o.getBoundingClientRect(); return [o.innerText.slice(0, 80), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }));
console.log("options", JSON.stringify(opts));
await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter");
await sleep(14000);
await p.screenshot({ path: "capture/probe/r1-1-sheet.png" });
const sheet = await p.evaluate(() => {
  const h = [...document.querySelectorAll("h1,h2,h3")].find((e) => /PID 5016/.test(e.innerText));
  let el = h; while (el && !(el.scrollHeight > el.clientHeight + 20 && getComputedStyle(el).overflowY !== "visible")) el = el.parentElement;
  if (!el) return { err: "no scroller", h: !!h };
  const r = el.getBoundingClientRect();
  const heads = [...el.querySelectorAll("h2,h3,h4,strong,dt")].slice(0, 60).map((e) => [e.innerText.slice(0, 50), Math.round(e.getBoundingClientRect().y - r.y + el.scrollTop)]);
  return { cls: el.className, x: r.x, y: r.y, w: r.width, h: r.height, sh: el.scrollHeight, heads, text: el.innerText.slice(0, 5000) };
});
console.log(JSON.stringify(sheet, null, 1));
await b.close();
