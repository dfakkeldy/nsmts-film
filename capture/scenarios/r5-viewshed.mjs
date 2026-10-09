// R5: the Rhodena page; turn on turbine visibility, then choose a viewpoint in Creignish, south-west of the turbines:
// a sight line is drawn from eye level to each turbine's blade tip, solid while it clears bare earth.
export async function run(page, h) {
  await h.load("https://kinnokilabs.com/rhodena", 12000);
  const show = await h.aria("button", "Show turbine visibility");
  if (show) await h.during(show.click());
  await h.settle(9000);
  const t1 = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div, span")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "T1");
    if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
  });
  console.error("T1 at", t1);
  const vp = t1 ? [t1[0] - 42, t1[1] + 185] : [998, 755]; // on land in Creignish, below its label
  await h.start();
  await h.wait(0.5);
  const choose = (await h.aria("button", "Choose a viewpoint")) ?? (await h.aria("button", "Check the view from a spot"));
  await h.clickEl(choose, 0.8);
  await h.wait(0.6);
  await h.click(vp[0], vp[1], 0.9);
  await h.wait(3.0);
}
