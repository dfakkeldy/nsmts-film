// R2 (record with capture/record-steps.mjs): the real georeferencer on Fletcher sheet 16 with the project's own
// control points (scaled to a 3000 px download): the per-point fit and the point that disagrees most, then the
// curved warp, then a live drag of one map pin, undone.
export const options = { stepSettleMs: 110 };
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?theme=georeferencing&position=46.07,-61.42,11", 10000);
  await (await page.$('input[aria-label="Add a map file"]')).uploadFile("assets/scans/Fletcher sheet 16, Mabou (1884).jpg");
  await h.settle(9000);
  await (await page.$('input[aria-label="Load a Fletcher points file"]')).uploadFile("assets/scans/Fletcher sheet 16 points.csv");
  await h.settle(8000);
  await h.start();
  await h.wait(0.6);
  await h.moveTo(640, 201, 0.9);        // row 4, the point that disagrees most
  await h.wait(1.6);
  await h.click(527, 859, 0.8);         // Curved warp (TPS)
  await h.wait(1.6);
  // Drag map pin 7: the drape re-warps and every number updates live; Undo restores the exact points.
  await h.drag(963, 663, 990, 648, 0.7);
  await h.wait(0.5);
  await h.click(533, 1037, 0.6);         // Undo
  await h.wait(1.3);
}
