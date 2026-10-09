# Places the approved narration (sound/elevenlabs/narration-v1.2.wav) on the film's timeline: the take is cut at the
# four pauses named in sound/voice-layout.json (each cut in the quietest 20 ms within 0.25 s of the gap between the
# two words), each piece is moved by its segment's offset, and 8 ms fades sit on every cut. The layout's inserts are
# separate lines (the gold-mine line) placed whole at their own film times; an insert whose file is not there yet is
# left out. Also writes the film-time word timings for the subtitles.
#   python3 -I scripts/place-voice.py  ->  sound/voice-placed.wav (48 kHz, mono), sound/words/film-v2.json
import json, os, re, wave, numpy as np
SR = 48000
DUR = float(re.search(r'duration:\s*([0-9.]+)', open('src/config.js').read()).group(1))
def read(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
x = read('sound/elevenlabs/narration-v1.2.wav')
words = json.load(open('sound/words/narration-v1.2.json'))['words']
layout = json.load(open('sound/voice-layout.json'))
segs = layout['segments']
def quietest(t0, t1):
    a, b, n = int(t0 * SR), int(t1 * SR), int(.02 * SR)
    e = np.convolve(x[a:b] ** 2, np.ones(n), 'valid')
    return (a + int(np.argmin(e)) + n // 2) / SR
cuts = [0.0]
for s in segs[1:]:
    i = s['from_word']; mid = (words[i - 1]['end'] + words[i]['start']) / 2
    cuts.append(quietest(mid - .25, mid + .25))
cuts.append(len(x) / SR)
out = np.zeros(int(round(DUR * SR)), np.float32); fade = int(.008 * SR)
def place(piece, at):
    piece = piece.copy(); piece[:fade] *= np.linspace(0, 1, fade); piece[-fade:] *= np.linspace(1, 0, fade)
    a = int(round(at * SR)); out[a:a + len(piece)] += piece[:len(out) - a]
film_words = []
for k, s in enumerate(segs):
    place(x[int(cuts[k] * SR):int(cuts[k + 1] * SR)], cuts[k] + s['offset'])
    last = segs[k + 1]['from_word'] if k + 1 < len(segs) else len(words)
    film_words += [{'w': w['w'], 'start': round(w['start'] + s['offset'], 3), 'end': round(w['end'] + s['offset'], 3)} for w in words[s['from_word']:last]]
    print(f"segment {k}: take {cuts[k]:.3f}-{cuts[k + 1]:.3f} s -> film {cuts[k] + s['offset']:.3f} s")
for ins in layout.get('inserts', []):
    if not os.path.exists(ins['file']):
        print(f"insert {ins['file']}: not there yet, left out"); continue
    y = read(ins['file']) * 10 ** (ins.get('gain_db', 0) / 20)
    place(y, ins['at'])
    film_words += [{'w': w['w'], 'start': round(w['start'] + ins['at'], 3), 'end': round(w['end'] + ins['at'], 3)} for w in json.load(open(ins['words']))['words']]
    print(f"insert {ins['file']}: {len(y) / SR:.3f} s at film {ins['at']:.3f} s")
film_words.sort(key=lambda w: w['start'])
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
with wave.open('sound/voice-placed.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
json.dump({'source': 'narration-v1.2 and its inserts placed on the film timeline by scripts/place-voice.py (layout: sound/voice-layout.json)',
           'words': film_words}, open('sound/words/film-v2.json', 'w'), indent=1)
print('sound/voice-placed.wav', len(out) / SR, 's;', len(film_words), 'words -> sound/words/film-v2.json')
