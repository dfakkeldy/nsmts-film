// The feed check: the specimen's words in the 9:16 clear zone (drawn as a faint outline), with the feed advice from
// looks/captions.md: subtitles at lineChars 30 (at 52 px the zone's 812 px row holds about 31 characters of Space Grotesk 600),
// kinetic pages in the lower part of the zone, keyword pages centred. At load it warns the widths it measured.
const VOICE = captions.load('specimens/captions/words.json', { offset: .5, keys: ['Bright', 'Warm', 'Dark'] });
const at = s => VOICE.words.find(w => w.bare === s).start - .06;
const FEED = { safe: 'feed' };
const plan = [[0, 'subtitle', { ...FEED, lineChars: 30 }], [at('say'), 'kinetic', FEED], [at('bright'), 'keyword', FEED]];
const Z = captions.feedRect();

shots([[0, t => {
  bg('#2B3245');
  CX.save(); CX.setLineDash([14, 10]); CX.strokeStyle = 'rgba(255,255,255,.18)'; CX.lineWidth = 2; CX.strokeRect(...Z); CX.restore();
  captions.draw(t, plan);
}]]);

captions.check(plan);
document.fonts.load('600 52px "Space Grotesk"').then(() => {
  const s = 'Meet Hesper, the reading lamp th', w = measure(s, { family: 'Space Grotesk', weight: 600, size: 52 });
  const room = Z[2] * .94;
  console.warn(`feed check: the zone is ${Z.map(Math.round).join(', ')}; a subtitle row may be ${room.toFixed(0)} px wide. ` +
    `32 characters of Space Grotesk 600 at 52 px measure ${w.toFixed(0)} px (${(w / 32).toFixed(1)} px a character), ` +
    `so about ${Math.floor(room / (w / 32))} characters fit at 52 px without shrinking`);
});
