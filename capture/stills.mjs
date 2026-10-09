// Map-only stills from the live site at 2x, for drawn plates (the cold open's then/now pair and the georeferencing
// figure's modern map). Each is cropped to the map, clear of the app's controls.
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = "https://kinnokilabs.com/apps/nsmarksthespot/map/";
const SHOTS = [
  ["mabou-1884", `${B}?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=46.07,-61.39,13`],
  ["mabou-today", `${B}?basemap=day&taxSale=off&mode=current&layers=modern&position=46.07,-61.39,13`],
  ["sheet16-today", `${B}?basemap=day&taxSale=off&mode=current&layers=modern&position=46.035,-61.42,11`],
];
const CROP = { x: 400, y: 70, width: 1400, height: 788 };   // CSS px: the map, clear of controls and readouts
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
for (const [name, url] of SHOTS) {
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem("ns-marks-the-spot:province-license:v1", "accepted"); } catch {} });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(25000);
  await p.screenshot({ path: `assets/stills/${name}.png`, clip: CROP });
  console.log("saved", name);
  await p.close();
}
await b.close();
