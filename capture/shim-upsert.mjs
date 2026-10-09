// The container's Chromium (141) predates Map.prototype.getOrInsertComputed, which PDF.js 6 (the app's GeoPDF import)
// calls; current browsers ship it. shimUpsert(page) prepends the standard behaviour to the app's own scripts (page
// and workers alike) as they load, so a take shows what a current browser does. Nothing else in the app changes.
const POLY = "for(const C of [Map,WeakMap]){if(!C.prototype.getOrInsertComputed)C.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k)};if(!C.prototype.getOrInsert)C.prototype.getOrInsert=function(k,v){if(!this.has(k))this.set(k,v);return this.get(k)}}\n";
export async function shimUpsert(page, log = () => {}) {
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const url = req.url();
    if (!/^https:\/\/kinnokilabs\.com\/.*\.m?js(\?|$)/.test(url)) return req.continue();
    try {
      const res = await fetch(url); const body = await res.text();
      log("shimmed", url.split("/").pop());
      await req.respond({ status: res.status, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: POLY + body });
    } catch (e) { log("shim failed", url, e.message); req.continue(); }
  });
}
