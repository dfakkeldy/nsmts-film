// RG: Fletcher sheet 19 (1884), the "Gold Mine" beside Glendale Brook (reviewed feature F19-JUD-094). A zoom from 14
// to 15 on the mark, where the app's feature labels appear, then a click for its popup: the original scan excerpt,
// "Approximate historical location", and its sheet and ID. Framed with the mark right of centre, so the popup fits
// without panning and little of the green-striped unit to the south-east is in view.
export const options = { storage: { "ns-marks-the-spot:province-license:v1": "accepted" } };
const MINE = [1250, 600];
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=fletcher&taxSale=off&mode=current&layers=modern,fletcher&position=45.8389,-61.3567,14", 16000);
  console.log("mark at zoom 14:", await h.nearest(...MINE, ".fletcher-feature-marker, .fletcher-feature-marker *", 40));
  await h.moveTo(1560, 860, 0.04);
  await h.start();
  await h.wait(0.6);
  await h.moveTo(...MINE, 0.9);
  await h.wait(0.3);
  await h.wheel(-60, 1);
  await h.wait(1.1);
  const hit = await h.nearest(...MINE, ".fletcher-feature-marker, .fletcher-feature-marker *", 40);
  console.log("mark after zoom:", hit);
  if (!hit) throw new Error("no Fletcher mark near the pointer after the zoom");
  await h.click(hit[0], hit[1], 0.3);
  await h.wait(4.5);
}
