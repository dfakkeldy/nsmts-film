// Exploration for R5 (not a recording): try viewpoints at named places on land and report each one's result line.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.goto("https://kinnokilabs.com/rhodena", { waitUntil: "domcontentloaded" });
await sleep(12000);
const find = (name) => p.evaluate((name) => { for (const e of document.querySelectorAll("button")) { const r = e.getBoundingClientRect(); if (r.width && (e.innerText.trim() === name)) return [r.x + r.width / 2, r.y + r.height / 2]; } return null; }, name);
await p.mouse.click(...(await find("Show turbine visibility"))); await sleep(9000);
const spots = { "Long Point": [928, 428], "Craigmore": [952, 606], "Centennial": [975, 388], "Low Point": [1018, 842], "Creignish Rear": [1125, 822], "Queensville": [1283, 786], "Kingsville": [1404, 550], "Glendale": [1375, 434], "Judique South": [895, 234], "Rear Judique South": [1127, 226] };
for (const [name, xy] of Object.entries(spots)) {
  const c = (await find("Choose a viewpoint")) ?? (await find("Check the view from a spot"));
  await p.mouse.click(...c); await sleep(1200); await p.mouse.click(...xy); await sleep(7000);
  const txt = await p.evaluate(() => { const h = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && /Turbines from this viewpoint/.test(e.textContent)); let el = h?.parentElement; return el ? el.innerText.replace(/\s+/g, " ").slice(0, 260) : "no panel"; });
  console.log(name, xy, "->", txt);
  await p.screenshot({ path: `capture/probe/r5b-${name.replace(/ /g, "_")}.png` });
}
await b.close();
