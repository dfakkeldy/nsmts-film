// R6: Export map (PDF) over the Mabou Highlands with the Fletcher sheet on (sheet 14, clear of the gap at its join): frame the area, Continue, title it, Download PDF.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
// The Province licence is already accepted in this browser (as on Dan's own devices), so no dialog opens.
export const options = { storage: { "ns-marks-the-spot:province-license:v1": "accepted" } };
export async function run(page, h) {
  const dl = resolve("capture/downloads"); mkdirSync(dl, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=46.158,-61.36,13", 6000);
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
  await h.type("Mabou Highlands, 1884", 0.05);
  await h.wait(0.3);
  await h.click(1075, 733, 0.6);                   // Download PDF
  await h.wait(2.5);
}
