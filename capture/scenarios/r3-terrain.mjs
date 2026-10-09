// R3: the Fletcher sheets over the Mabou Highlands (sheet 14, 1884; zoom 14 on the orange core, clear of the sheets'
// joins), switched to 3D terrain, then a slow turn (ctrl-drag) across the draped sheets.
// Recorded with record-steps.mjs: the 3D view stalls frame-controlled capture.
export const options = {
  storage: { "ns-marks-the-spot:province-license:v1": "accepted" },
  noCache: true,
};
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,fletcher&position=46.168,-61.405,14", 8000);
  const btn = await h.find("3D terrain");
  if (!btn) throw new Error("no 3D terrain button");
  await h.during(page.mouse.click(...btn));
  await h.settle(25000);
  const retry = await h.find("Retry 3D");
  if (retry) console.error("3D reported a failed source; retrying"), await h.during(page.mouse.click(...retry)), await h.settle(20000);
  await h.start();
  await h.wait(0.4);
  // Ctrl-drag right to left turns the view west, toward Cape Mabou and the sea, away from the sheets' joins to the
  // south (about 46.09 N) and east (about 61.225 W); no vertical movement, so the pitch holds.
  const x0 = 1300, y0 = 640, dx = -300, k = 105;
  await h.moveTo(x0, y0, 0.4);
  await h.during(page.keyboard.down("Control")); await h.during(page.mouse.down());
  for (let i = 1; i <= k; i++) {
    const e = i / k, x = x0 + dx * (e * e * (3 - 2 * e));
    await h.during(page.mouse.move(x, y0)); await h.during(page.evaluate((x, y) => window.__recPointer?.(x, y, 1), x, y0)); await h.frame();
  }
  await h.during(page.mouse.up()); await h.during(page.keyboard.up("Control"));
  await h.wait(0.8);
}
