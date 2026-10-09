// R5: the Rhodena page; turn on turbine visibility, then choose a viewpoint at Long Point, north-west of the turbines
// (2 of 6 tips potentially visible there, a mixed result):
// a sight line is drawn from eye level to each turbine's blade tip, solid while it clears bare earth. Recorded with
// record-steps.mjs: frame-controlled capture stalls on this page.
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/rhodena", 12000);
  const show = await h.find("Show turbine visibility");
  if (show) await h.during(page.mouse.click(...show));
  await h.settle(9000);
  let t1 = null;
  await h.during(page.evaluate(() => {
    const el = [...document.querySelectorAll("div, span")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "T1");
    if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
  }).then((v) => (t1 = v)));
  console.error("T1 at", t1);
  const vp = t1 ? [t1[0] - 112, t1[1] - 142] : [928, 428]; // on land at Long Point, at its label
  await h.start();
  await h.wait(0.5);
  const choose = (await h.find("Choose a viewpoint")) ?? (await h.find("Check the view from a spot"));
  await h.click(...choose, 0.8);
  await h.wait(0.6);
  await h.click(vp[0], vp[1], 0.9);
  await h.wait(3.0);
}
