// R6: Export map (PDF) over Mabou with the Fletcher sheet on: frame the area, Continue, title it, Download PDF.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
export async function run(page, h) {
  const dl = resolve("capture/downloads"); mkdirSync(dl, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=46.07,-61.39,13", 6000);
  const acc = await h.aria("button", "Accept and view map layers");
  if (acc) await h.during(acc.click());
  await h.settle(10000);
  await h.start();
  await h.wait(0.4);
  await h.click(160, 290, 0.8);                    // Export map (PDF)
  await h.wait(0.9);
  await h.drag(1732, 877, 1660, 836, 0.8);         // resize the frame; the scale readout follows
  await h.wait(0.5);
  await h.click(533, 994, 0.7);                    // Continue
  await h.wait(0.9);
  await h.click(960, 449, 0.5);                    // Title
  await h.press("End");
  for (let i = 0; i < 15; i++) await h.press("Backspace");
  await h.type("Mabou, 1884 sheet", 0.05);
  await h.wait(0.3);
  await h.click(1075, 733, 0.6);                   // Download PDF
  await h.wait(2.5);
}
