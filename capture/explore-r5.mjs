// Exploration for R5 (not a recording): the Rhodena page; turn on turbine visibility, choose a viewpoint west of the
// turbines, and screenshot each step so the recording can be planned.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, n) => p.screenshot({ path: `capture/probe/r5-${n}.png` });
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto("https://kinnokilabs.com/rhodena", { waitUntil: "domcontentloaded" });
await sleep(12000);
await shot(p, "0-load");
const buttons = async () => p.evaluate(() => [...document.querySelectorAll("button, [role=button], dialog[open]")].filter((e) => e.getBoundingClientRect().width > 0)
  .map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.innerText || e.getAttribute("aria-label") || "").slice(0, 50), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }));
console.log("buttons:", JSON.stringify(await buttons()));
const show = await p.$('::-p-aria([name="Show turbine visibility"][role="button"])');
console.log("show:", !!show);
if (show) { await show.click(); await sleep(9000); await shot(p, "1-vis"); console.log("after show:", JSON.stringify(await buttons())); }
const t1 = await p.evaluate(() => { const el = [...document.querySelectorAll("div, span")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "T1");
  if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; });
console.log("T1", t1);
const choose = (await p.$('::-p-aria([name="Choose a viewpoint"][role="button"])')) ?? (await p.$('::-p-aria([name="Check the view from a spot"][role="button"])'));
console.log("choose:", !!choose);
if (choose && t1) { await choose.click(); await sleep(1500); await p.mouse.click(t1[0] - 190, t1[1] + 120); await sleep(8000); await shot(p, "2-view"); }
console.log((await p.evaluate(() => document.body.innerText)).slice(0, 2500));
await b.close();
