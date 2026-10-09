// footage.js: draw a recorded take (footage/frames/<name>/f00001.jpg...) inside the film, one frame per film frame.
// drawAt awaits each shot, so a shot can `await footage(...)`: the frame is decoded on demand and a few are cached,
// instead of preloading thousands of frames before the first one.
const _FOOT = new Map();
function _footSrc(name, i) { return `footage/frames/${name}/f${String(i + 1).padStart(5, '0')}.jpg`; }
async function _footImg(name, i) {
  const key = name + ':' + i;
  if (_FOOT.has(key)) return _FOOT.get(key);
  const im = new Image(); im.src = _footSrc(name, i);
  await im.decode().catch(e => { throw new Error(`footage ${key} failed: ${e}`); });
  _FOOT.set(key, im);
  if (_FOOT.size > 24) _FOOT.delete(_FOOT.keys().next().value);
  return im;
}
// footage(name, tl, box, o): draw take `name` at its own time tl (seconds; clamped to the take) into box [x, y, w, h].
// o.crop: [sx, sy, sw, sh] in the take's pixels (a push-in), default the whole frame; o.alpha.
async function footage(name, tl, box, o = {}) {
  const meta = FOOTAGE[name]; if (!meta) throw new Error(`no take ${name}`);
  const i = Math.max(0, Math.min(meta.frames - 1, Math.round(tl * FPS)));
  const im = await _footImg(name, i), [x, y, w, h] = box, [sx, sy, sw, sh] = o.crop || [0, 0, meta.w, meta.h];
  CX.save(); CX.globalAlpha *= o.alpha ?? 1; CX.imageSmoothingQuality = 'high';
  CX.drawImage(im, sx, sy, sw, sh, x, y, w, h); CX.restore();
}
// The take's length in seconds.
const takeLen = name => FOOTAGE[name].frames / FPS;
