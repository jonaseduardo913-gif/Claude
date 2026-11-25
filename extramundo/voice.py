"""Narration: script.txt -> build/narration.wav + build/words.json (word-level timing).
Each script line is synthesized separately (Piper TTS) and joined with tight gaps,
then Whisper word timestamps are aligned back onto the exact script words.
To use a recorded voiceover instead: python3 voice.py --audio my_vo.wav
"""
import argparse, json, re, subprocess, wave, difflib, io
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--model', help='Piper .onnx voice')
ap.add_argument('--audio', help='use an existing recorded narration instead of TTS')
ap.add_argument('--tighten', action='store_true', help='shorten pauses (style rule: no pause > 150 ms)')
ap.add_argument('--lang', default='en')
ap.add_argument('--speed', type=float, default=0.86, help='Piper length scale (<1 = faster)')
a = ap.parse_args()
SR = 22050
raw = [l.strip() for l in open('script.txt', encoding='utf-8') if l.strip()]
TITLE = next((l[6:].strip() for l in raw if l.startswith('TITLE:')), '')
SIGNOFF = next((l[8:].strip() for l in raw if l.startswith('SIGNOFF:')), '')
lines = [l for l in raw if not l.startswith(('TITLE:', 'SIGNOFF:'))]

def tts(text):
    text = text.replace('AUREN', 'Auren').replace('GTA 6', 'G T A six').replace('…', ',')
    if text.isupper(): text = text.capitalize().replace('vice city', 'Vice City').replace('g t a six', 'G T A six')
    out = subprocess.run(['python3', '-m', 'piper', '-m', a.model, '--length-scale', str(a.speed), '-f', '-'],
                         input=text.encode(), capture_output=True, check=True).stdout
    w = wave.open(io.BytesIO(out)); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    # trim leading/trailing silence
    idx = np.where(np.abs(x) > 0.01)[0]
    return x[max(0, idx[0] - 200): idx[-1] + 600] if len(idx) else x

line_spans = []
def load(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def save(p, y):
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())

def tighten(y, keep_comma=0.12, keep_stop=0.22, thresh_db=-38):
    """Remove silence inside pauses, keeping a short breath. Cuts only where the signal is quiet."""
    hop = int(0.01 * SR); n = len(y) // hop
    rms = np.sqrt(np.mean(y[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms) < thresh_db
    out, i, removed = [], 0, 0.0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            run = (j - i) * hop / SR
            # sentence end if the next loud bit follows a long pause
            keep = keep_stop if run > 0.45 else keep_comma
            if run > keep + 0.03 and i > 0 and j < n:
                k = int(keep * SR / hop); h = k // 2
                out.append(y[i * hop:(i + h) * hop]); out.append(y[(j - (k - h)) * hop: j * hop])
                # 5 ms crossfade-free cut is inside silence, so it is click-free
                removed += run - keep
            else:
                out.append(y[i * hop: j * hop])
            i = j
        else:
            j = i
            while j < n and not quiet[j]: j += 1
            out.append(y[i * hop: j * hop]); i = j
    out.append(y[n * hop:])
    print(f'tightened: removed {removed:.2f}s of silence')
    return np.concatenate(out)

if a.audio:
    y = load(a.audio)
    if a.tighten: y = tighten(y)
    save('build/narration.wav', y)
else:
    parts, t = [], 0.0
    for i, l in enumerate(lines):
        x = tts(l)
        gap = 0.32 if i == 0 else (0.42 if i == len(lines) - 2 else 0.16)
        line_spans.append([t, t + len(x) / SR]); parts += [x, np.zeros(int(gap * SR))]; t += len(x) / SR + gap
    y = np.concatenate(parts); y = y / np.abs(y).max() * 0.9
    with wave.open('build/narration.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())

# ---- align: whisper words -> script words ----
from faster_whisper import WhisperModel
w = wave.open('build/narration.wav'); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
x16 = np.interp(np.arange(0, len(x), SR / 16000), np.arange(len(x)), x).astype(np.float32)
m = WhisperModel('small', device='cpu', compute_type='int8')
segs, _ = m.transcribe(x16, language=a.lang, word_timestamps=True)
hyp = [(ww.start, ww.end, ww.word.strip()) for s in segs for ww in s.words]
norm = lambda s: re.sub(r"[^a-z0-9]", '', s.lower())
script = []
for li, l in enumerate(lines):
    for tok in l.replace('…', '… ').split():
        script.append({'w': tok, 'line': li})
sm = difflib.SequenceMatcher(a=[norm(t['w']) for t in script], b=[norm(h[2]) for h in hyp], autojunk=False)
for blk in sm.get_matching_blocks():
    for k in range(blk.size):
        h = hyp[blk.b + k]; script[blk.a + k].update(s=round(h[0], 3), e=round(h[1], 3))
# interpolate unmatched words (e.g. "GTA" spoken as letters)
for i, t in enumerate(script):
    if 's' not in t:
        prv = next((script[j] for j in range(i - 1, -1, -1) if 's' in script[j]), None)
        nxt = next((script[j] for j in range(i + 1, len(script)) if 's' in script[j]), None)
        s0 = prv['e'] if prv else 0.0; s1 = nxt['s'] if nxt else s0 + 0.4
        run = [j for j in range(i, len(script)) if 's' not in script[j]]
        run = run[:next((n for n, j in enumerate(run) if j != i + n), len(run))]
        for n, j in enumerate(run):
            script[j]['s'] = round(s0 + (s1 - s0) * n / len(run), 3); script[j]['e'] = round(s0 + (s1 - s0) * (n + 1) / len(run), 3)
dur = len(x) / SR
matched = sum(b.size for b in sm.get_matching_blocks())
json.dump({'duration': dur, 'title': TITLE, 'signoff': SIGNOFF, 'lines': lines, 'words': script}, open('build/words.json', 'w'), indent=0, ensure_ascii=False)
print(f'duration {dur:.2f}s  words {len(script)}  aligned {matched}/{len(script)}  wpm {len(script)/dur*60:.0f}')
