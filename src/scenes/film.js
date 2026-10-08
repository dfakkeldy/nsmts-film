// film.js: the film. shots([[t0, fn], ...]) registers shots; fn(t, lt, dur) draws the WHOLE frame at video time t and
// must be a pure function of t. Read the chosen look's card (looks/<id>.md) and copy from its specimen
// (specimens/<id>/scene.js). Declare sound cues at load time with cue(t, kind, o), from the same times the picture uses.
shots([[0, (t) => {
  bg(PAL.bg);
  words('title', 'A new film', W / 2, H / 2, .2, t, { size: Math.round(H / 11), align: 'center', weight: 600 });
}]]);
