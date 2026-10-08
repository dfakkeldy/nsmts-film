// A check, not a film: the specimen's voice captioned in a 9:16 feed's clear zone, one mode a sentence, so --inspect
// and stills test the 'feed' safe area and the feed sizes. safeRect is captions.feedRect() at 1080 x 1920 (config.js
// loads before the engine, so the numbers are written out).
//   node render.mjs --project=specimens/captions/feed --inspect --every=0.1
//   node render.mjs --project=specimens/captions/feed --stills=2.4,4.7,9.5 --out=out/captions/feed
const PROJECT = { width: 1080, height: 1920, fps: 30, duration: 10, mode: 'canvas', bg: '#2B3245', safeRect: [65, 230, 864, 1152] };
