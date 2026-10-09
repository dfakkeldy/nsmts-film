// R9: Poker (kinnokilabs.com/poker) on the phone. Saved for offline use beforehand (Map options > Save offline), and
// the Province's aerial licence accepted beforehand. In the take: search 5471 Highway 19 (the Celtic Music
// Interpretive Centre, Judique: a public building), switch on the aerial, trace from the civic point to Highway 19
// ("Within 500 m"), then cut the network (the phone's airplane mode, emulated) and reload: Poker comes back from its
// offline copy with the address and trace, on the saved Atlas map ("Offline · Atlas"; the aerial is never offline).
// Record with: run-batch.sh record-steps.mjs r9-poker.mjs:r9-poker.mp4:--phone
export const options = { stepSettleMs: 120 };
export async function run(page, h) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tapName = async (name, s = .4) => { const xy = await h.find(name); if (!xy) throw new Error(`no button ${name}`); await h.click(xy[0], xy[1], s); };
  const textHas = (re) => page.evaluate((src) => new RegExp(src).test(document.body.innerText), re.source);
  await h.load("https://kinnokilabs.com/poker", 10000);
  // before recording: save the offline copy, accept the aerial licence (then switch the aerial off again)
  await tapName("Map options"); await sleep(1500);
  await tapName("Save offline");
  for (let i = 0; i < 20 && !(await textHas(/Saved for offline use/)); i++) await sleep(1000);
  await tapName("Done"); await sleep(1000);
  await tapName("Aerial"); await sleep(1500);
  await tapName("Accept and show aerial"); await sleep(4000);
  await tapName("Atlas"); await sleep(2500);                  // the toggle reads "Atlas" while the aerial is on
  await h.start();
  await h.wait(0.5);
  // find the address
  const box = await (await page.$('input[aria-label="Search civic address"]')).boundingBox();
  await h.click(box.x + box.width / 2, box.y + box.height / 2); await h.wait(0.2);
  await h.type("5471 Highway 19", 0.05); await h.wait(0.5);
  await tapName("5471 HIGHWAY 19, JUDIQUE, NS B0E 1P0"); await h.wait(2.0);
  // the aerial, then the driveway: from the civic point to the highway
  await tapName("Aerial"); await h.wait(1.6);
  await h.click(195, 421); await h.wait(0.3);
  await h.click(238, 423); await h.wait(0.3);
  await h.click(282, 425); await h.wait(0.5);
  await tapName("Finish"); await h.wait(1.6);
  // no signal: the network is cut (airplane mode) and the page reloads from its offline copy
  await page.setOfflineMode(true); await h.wait(0.4);
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(4000);
  await h.wait(1.4);
  await tapName("Map options"); await h.wait(2.2);
}
