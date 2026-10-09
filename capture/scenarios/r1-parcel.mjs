// R1: pick a public parcel (5471 Highway 19, Judique: the interpretive centre) by civic address search; the
// parcel sheet fills in, then scrolls through buildings, assessment, civic address, roads, water and flood, where
// sources that returned nothing say so.
// The Province licence is already accepted in this browser (as on Dan's own devices), so no dialog opens.
export const options = { storage: { "ns-marks-the-spot:province-license:v1": "accepted" } };
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,ns-aerial,nsprd&position=45.878,-61.492,16", 6000);
  await h.settle(10000);
  await h.start();
  await h.wait(0.5);
  await h.click(130, 109, 0.8);                  // search field
  await h.type("5471 Highway 19", 0.06);
  await h.wait(1.4);                              // suggestions arrive
  await h.press("ArrowDown");
  await h.wait(0.25);
  await h.press("Enter");
  await h.wait(2.6);                              // parcel selected, sheet fills in
  await h.moveTo(1710, 620, 0.6);
  // Scroll the sheet smoothly from the top to the roads, water and flood sections.
  const k = 150;
  for (let i = 1; i <= k; i++) {
    const e = i / k, y = Math.round(1150 * (e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2));
    await h.during(page.evaluate((y) => { const s = document.querySelector(".parcel-inspector"); if (s) s.scrollTop = y; }, y));
    await h.frame();
  }
  await h.wait(1.5);
}
