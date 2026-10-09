// Exploration (not a recording): the Fletcher layer around Judique at a few views, to find one with no sheet gap and
// with the sheets' orange and yellow units rather than the green stripes.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const views = process.argv.slice(2);
for (const v of views) {
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem("ns-marks-the-spot:province-license:v1", "accepted"); } catch {} });
  await p.goto(`https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=${v}`, { waitUntil: "domcontentloaded" });
  await sleep(16000);
  await p.screenshot({ path: `capture/probe/jq-${v.replace(/,/g, "_")}.png`, clip: { x: 320, y: 0, width: 1600, height: 1034 } });
  console.log("saved", v); await p.close();
}
await b.close();
