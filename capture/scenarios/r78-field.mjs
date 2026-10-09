// R7 + R8, one phone session on the main map in the Mabou Highlands: a GeoPDF exported from the map (the Fletcher
// sheet over the western highlands, capture/export-geopdf.mjs) comes back in and its embedded coordinates place it;
// "Use my location" puts the dot on it. Then field logging: mark a point, add a geotagged photo
// (assets/photos/coal-mine-point.jpg, M. C. Rygel, CC BY-SA 3.0, taken at Coal Mine Point), record a short track, and
// the layer list with "Drawn on this device" and its export buttons. The location is emulated (the public road
// between Mabou Coal Mines and MacDonalds Glen), and so is the short walk north along it while the track records.
// The container's Chromium predates a method PDF.js 6 uses (see capture/shim-upsert.mjs).
// Record with: run-batch.sh record-steps.mjs r78-field.mjs:r78-field.mp4:--phone
import { shimUpsert } from "../shim-upsert.mjs";
const HERE = { latitude: 46.126422, longitude: -61.459306, accuracy: 6 };
export const options = {
  storage: { "ns-marks-the-spot:province-license:v1": "accepted" },
  geolocation: HERE,
  setup: (page) => shimUpsert(page),
  stepSettleMs: 120,
};
export async function run(page, h) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // a button by its text or label, scrolled into view first (the panel's lower buttons start off screen)
  const tapName = async (name, s = .4) => {
    await page.evaluate((name) => { for (const e of document.querySelectorAll("button, [role=button]")) { if (!e.getBoundingClientRect().width) continue;
      if ((e.innerText ?? "").replace(/\s+/g, " ").trim() === name || e.getAttribute("aria-label") === name) { const r = e.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 60) e.scrollIntoView({ block: "center" }); return; } } }, name);
    await sleep(250);
    const xy = await h.find(name); if (!xy) throw new Error(`no button ${name}`); await h.click(xy[0], xy[1], s);
  };
  await h.load("https://kinnokilabs.com/apps/nsmarksthespot/map/?basemap=day&taxSale=off&mode=current&layers=modern&position=46.15,-61.42,13", 12000);
  // before recording: open My Maps and load the GeoPDF, so the take opens on the frame chooser
  await tapName("⌕ Search & layers"); await sleep(1500);
  await page.evaluate(() => { for (const e of document.querySelectorAll("button")) if (e.innerText.replace(/\s+/g, " ").trim().startsWith("My Maps")) { e.scrollIntoView({ block: "center" }); e.click(); return; } });
  await sleep(1500);
  await (await page.$('input[aria-label="Add a map file"]')).uploadFile("capture/geopdf/nova-scotia-map-2026-10-09.pdf");   // made by capture/export-geopdf.mjs
  await sleep(12000);
  await h.start();
  // R7: choose the frame, place it, close the panel, find yourself on it
  await h.wait(0.6);
  const radio = await page.$("input[type=radio]"); const rb = await radio.boundingBox();
  await h.click(rb.x + rb.width / 2, rb.y + rb.height / 2); await h.wait(0.3);
  await tapName("Use this frame"); await h.wait(1.4);
  await tapName("×"); await h.wait(1.0);
  await page.setGeolocation(HERE);
  await tapName("Use my location"); await h.wait(2.8);
  // R8: a point, a photo, a track, and the layers that hold them
  await page.setGeolocation({ ...HERE, accuracy: 5 });
  await tapName("Mark my location"); await h.wait(2.2);
  await tapName("⌕ Search & layers"); await h.wait(0.5);
  await tapName("Add photos to map"); await h.wait(0.4);
  await (await page.$('input[type=file][aria-label="Choose photos to place"]')).uploadFile("assets/photos/coal-mine-point.jpg");
  await h.wait(1.2);
  await tapName("Create 1 point"); await h.wait(1.0);
  await tapName("Done"); await h.wait(0.3);
  await tapName("×"); await h.wait(1.2);
  await tapName("Record a track"); await h.wait(0.4);
  for (let i = 1; i <= 10; i++) {    // walking north along the road, toward MacDonalds Glen
    await page.setGeolocation({ latitude: HERE.latitude + i * 0.000416, longitude: HERE.longitude - i * 0.000026, accuracy: 5 });
    await h.wait(0.35);
  }
  await tapName("⌕ Search & layers"); await h.wait(0.6);
  // the layers that hold them: "Drawn on this device", "From your photos", and their export buttons
  await page.evaluate(() => { const e = [...document.querySelectorAll("input")].find((i) => i.getAttribute("aria-label") === "Field notes");
    e?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  await h.wait(2.8);
}
