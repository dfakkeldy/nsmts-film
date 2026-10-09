# Places the approved narration (sound/elevenlabs/narration-v1.2.wav) on the film's timeline: the take is cut at the
# four pauses named in sound/voice-layout.json (each cut in the quietest 20 ms within 0.25 s of the gap between the
# two words), each piece is moved by its segment's offset, and 8 ms fades sit on every cut.
#   python3 -I scripts/place-voice.py  ->  sound/voice-placed.wav (96 s, 48 kHz, mono, float)
import json, wave, numpy as np
SR, DUR = 48000, 96.0
with wave.open('sound/elevenlabs/narration-v1.2.wav') as w:
    assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
words = json.load(open('sound/words/narration-v1.2.json'))['words']
segs = json.load(open('sound/voice-layout.json'))['segments']
def quietest(t0, t1):
    a, b, n = int(t0 * SR), int(t1 * SR), int(.02 * SR)
    e = np.convolve(x[a:b] ** 2, np.ones(n), 'valid')
    return (a + int(np.argmin(e)) + n // 2) / SR
cuts = [0.0]
for s in segs[1:]:
    i = s['from_word']; mid = (words[i - 1]['end'] + words[i]['start']) / 2
    cuts.append(quietest(mid - .25, mid + .25))
cuts.append(len(x) / SR)
out = np.zeros(int(DUR * SR), np.float32); fade = int(.008 * SR)
for k, s in enumerate(segs):
    a, b = int(cuts[k] * SR), int(cuts[k + 1] * SR); piece = x[a:b].copy()
    piece[:fade] *= np.linspace(0, 1, fade); piece[-fade:] *= np.linspace(1, 0, fade)
    at = int(round((cuts[k] + s['offset']) * SR)); out[at:at + len(piece)] += piece[:len(out) - at]
    print(f"segment {k}: take {cuts[k]:.3f}-{cuts[k + 1]:.3f} s -> film {cuts[k] + s['offset']:.3f} s")
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
with wave.open('sound/voice-placed.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('sound/voice-placed.wav', len(out) / SR, 's')
