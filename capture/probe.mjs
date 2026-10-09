// node capture/probe.mjs <url> <out.png> [waitMs] [--phone] : one screenshot, plus the page text, for planning a take.
import puppeteer from "puppeteer-core";
const [url, out, wait = "15000", ...flags] = process.argv.slice(2);
const phone = flags.includes("--phone");
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1920, height: 1080 });
await p.goto(url, { waitUntil: "domcontentloaded" });
await new Promise(r => setTimeout(r, 5000));
const acc = await p.$('::-p-aria([name="Accept and view map layers"][role="button"])');
if (acc) await acc.click();
await new Promise(r => setTimeout(r, Number(wait)));
await p.screenshot({ path: out });
console.log((await p.evaluate(() => document.body.innerText)).slice(0, 600));
await b.close();
