// R4: micro-hydro screening reaches; zoom once on a Margaree reach and open its popup.
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern,inverness-hydro-potential", 16000);
  await h.start();
  await h.wait(0.5);
  await h.moveTo(1146, 508, 0.8);
  await h.wait(0.2);
  await h.wheel(-120, 1); await h.wait(1.0);
  const hit = await h.nearest(1146, 508);
  console.log("reach at", hit);
  if (hit) await h.click(hit[0], hit[1], 0.35);
  await h.wait(3.0);
}
