#!/usr/bin/env python3
"""trim_pauses.py: put the pauses back into a word-timing file, for captions.js.

DTW timings (whisper-cli) and many aligners end each word where the next one starts, so the gaps a speaker leaves
vanish, and captions.js can't break kinetic pages on pauses (a must at 150 ms or more). This reads a words file
({ "words": [{ "w", "start", "end" }] }, as video-sound's `sound.py words` writes it), finds the silences in the
voice with ffmpeg's silencedetect, and:
  - ends each word where the first silence inside it begins (at most 1.2 s after its start);
  - moves a start that falls inside a silence to that silence's end;
  - with --script, puts the script's spelling and punctuation back (punctuation drives the page breaks). The script
    must hold the same words in the same order; the check ignores case and punctuation.

  python3 trim_pauses.py words.json voice.wav -o words.trimmed.json [--script script.txt] [--noise -38] [--min 0.1]

Needs ffmpeg on the PATH. Standard library only. The specimen's words.json was made with the defaults.
"""
import argparse
import json
import re
import subprocess
import sys


def silences(audio, noise, dur):
    r = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', audio, '-af', f'silencedetect=noise={noise}dB:d={dur}',
                        '-f', 'null', '-'], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'trim_pauses: ffmpeg failed on {audio}:\n{r.stderr[-800:]}')
    st = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    if len(en) < len(st):   # a silence that runs to the end of the file has no end line
        en.append(float('inf'))
    return list(zip(st, en))


def bare(s):
    return re.sub(r'\W', '', s).lower()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('words', help='words JSON: { "words": [{ "w", "start", "end" }] } or a bare list')
    ap.add_argument('audio', help='the voice the timings came from (any format ffmpeg reads)')
    ap.add_argument('-o', '--out', required=True, help='output JSON')
    ap.add_argument('--script', help='a text file with the same words, spelt and punctuated as they should read')
    ap.add_argument('--noise', type=float, default=-38, help='silence threshold in dB (default -38)')
    ap.add_argument('--min', type=float, default=.1, help='shortest silence that counts, in s (default 0.1)')
    ap.add_argument('--longest', type=float, default=1.2, help='longest a word may last, in s (default 1.2)')
    a = ap.parse_args()

    data = json.load(open(a.words))
    words = data['words'] if isinstance(data, dict) else data
    toks = [x.get('w', x.get('word', x.get('text', ''))).strip() for x in words]
    if a.script:
        script = open(a.script).read().split()
        if len(script) != len(words):
            sys.exit(f'trim_pauses: the script has {len(script)} words, the timings {len(words)}.\n'
                     f'timings: {" ".join(toks)}\nFix the script or the timings so they match word for word.')
        for i, (w, s) in enumerate(zip(toks, script)):
            if bare(w) != bare(s):
                sys.exit(f'trim_pauses: word {i} is "{w}" in the timings but "{s}" in the script. Fix one of them '
                         f'(whisper misspells names; keep the script\'s spelling in the script).')
        toks = script

    sil = silences(a.audio, a.noise, a.min)
    res = []
    for i, (w, tok) in enumerate(zip(words, toks)):
        s = float(w['start'])
        for lo, hi in sil:                       # a start inside a silence moves to its end
            if lo <= s < hi:
                s = hi
        nxt = float(words[i + 1]['start']) if i + 1 < len(words) else s + a.longest
        e = min(nxt, s + a.longest)
        for lo, hi in sil:                       # the word ends where the next silence begins
            if s < lo < e:
                e = lo
                break
        res.append({'w': tok, 'start': round(s, 3), 'end': round(max(e, s + .05), 3)})
    for i in range(1, len(res)):                 # starts that moved past the previous end keep the order
        res[i - 1]['end'] = min(res[i - 1]['end'], res[i]['start'])

    src = data.get('source', '') if isinstance(data, dict) else ''
    out = {'source': (src + '; ' if src else '') + f'word ends trimmed at silences (trim_pauses.py, {a.noise:g} dB, {a.min:g} s)',
           'words': res}
    json.dump(out, open(a.out, 'w'), indent=1)
    gaps = [(res[i]['w'], res[i + 1]['start'] - res[i]['end']) for i in range(len(res) - 1)]
    print(f'{len(res)} words, {len(sil)} silences; pauses of 150 ms or more after: ' +
          (', '.join(f'"{w}" ({g:.2f} s)' for w, g in gaps if g >= .15) or 'none'))


if __name__ == '__main__':
    main()
