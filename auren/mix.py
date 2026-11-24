"""Audio: narration + synthwave bed (ducked) + SFX from build/timeline.json -> build/mix.wav at -14 LUFS."""
import json, subprocess, wave
import numpy as np

SR = 48000
TL = json.load(open('build/timeline.json'))
N = int(TL['duration'] * SR) + SR // 2
rng = np.random.default_rng(11)

def load(p):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def hp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (fc / np.maximum(f, 1)) ** 4); return np.fft.irfft(X, len(x))
def env(d, a=0.004, dec=6.0):
    t = tt(d); e = np.exp(-t * dec); na = max(1, int(a * SR)); e[:na] *= np.linspace(0, 1, na); return e
def saw(f, d, n=12):
    t = tt(d); return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, n + 1) if f * k < 14000) * 0.6
def put(buf, sig, t, g=1.0):
    i = int(t * SR)
    if i < 0: sig = sig[-i:]; i = 0
    if i >= len(buf): return
    s = sig[: len(buf) - i] * g; buf[i:i + len(s)] += s
def sweep(d, f0, f1, chunk=0.025):
    n = int(d * SR); c = int(chunk * SR); src = rng.standard_normal(n + 2 * c); out = np.zeros(n)
    for k in range(0, n, c):
        fc = f0 * (f1 / f0) ** (k / n); seg = lp(src[k:k + 2 * c], fc)[: min(c, n - k)]; out[k:k + len(seg)] = seg
    return out / (np.abs(out).max() + 1e-9)
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---------------- music: synthwave bed, 100 BPM, Am-F-C-G ----------------
music = np.zeros(N)
BPM = 100; beat = 60 / BPM; bar = 4 * beat
END = TL['end']['t0']
prog_ = [(57, [69, 72, 76]), (53, [65, 69, 72]), (48, [64, 67, 72]), (55, [62, 67, 71])]
nbars = int(np.ceil(END / bar))
for b in range(nbars):
    t0 = b * bar; root, ch = prog_[b % 4]
    put(music, lp(sum(saw(NOTE(m) * (1 + dt), bar + 0.3, 8) for m in ch for dt in (-0.003, 0.003)) / 6, 1400) * np.minimum(1, tt(bar + 0.3) / 0.3) * np.minimum(1, (bar + 0.3 - tt(bar + 0.3)) / 0.3), t0, 0.32)
    for k in range(8):   # driving 8th-note bass
        put(music, lp(saw(NOTE(root - 24), beat / 2 * 0.9, 8), 420) * env(beat / 2 * 0.9, 0.003, 5), t0 + k * beat / 2, 0.55)
    for k in range(16):  # arpeggio
        m = (ch + [ch[0] + 12])[k % 4] + 12
        put(music, lp(np.sign(np.sin(2 * np.pi * NOTE(m) * tt(0.12))), 2800) * env(0.12, 0.002, 22), t0 + k * beat / 4, 0.08)
    for k in range(4):   # drums
        tk = t0 + k * beat; t = tt(0.35)
        kick = np.sin(2 * np.pi * np.cumsum(48 + 110 * np.exp(-t * 30)) / SR) * np.exp(-t * 9)
        put(music, np.tanh(kick * 2) * 0.8, tk, 0.7)
        if k % 2: put(music, lp(hp(rng.standard_normal(int(0.25 * SR)), 1200), 6000) * env(0.25, 0.001, 18), tk, 0.35)
        for h in range(2): put(music, hp(rng.standard_normal(int(0.04 * SR)), 8000) * env(0.04, 0.001, 80), tk + h * beat / 2, 0.12)
# end-card sting: big chord swell on A minor add9
put(music, lp(sum(saw(NOTE(m), 3.0, 10) for m in [45, 57, 64, 69, 71, 72]) / 6, 2400) * env(3.0, 0.01, 1.1), END, 0.7)
music[int((END - 0.05) * SR):int(END * SR)] *= np.linspace(1, 0.2, int(0.05 * SR))

# ---------------- voice + ducking ----------------
vo = load('build/narration.wav')
voice = np.zeros(N); voice[:len(vo)] = vo[:N]
win = int(0.08 * SR)
envv = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode='same'))
act = np.clip(envv / (envv.max() * 0.25), 0, 1)
act = np.convolve(act, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode='same')
music *= (1 - 0.45 * act)

# ---------------- SFX ----------------
sfx = np.zeros(N)
def impact(size=1.0):
    t = tt(1.2 * size); sub = np.sin(2 * np.pi * np.cumsum(40 + 80 * np.exp(-t * 10)) / SR) * np.exp(-t * 3 / size)
    return np.tanh((sub + lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 9) * 0.5) * 1.8) * 0.8
def add(a, b):
    n = max(len(a), len(b)); o = np.zeros(n); o[:len(a)] += a; o[:len(b)] += b; return o
LIB = {
    'whoosh': lambda: sweep(0.45, 400, 7000) * np.sin(np.pi * tt(0.45) / 0.45) ** 2 * 0.6,
    'whooshlong': lambda: sweep(1.1, 300, 5000) * np.sin(np.pi * tt(1.1) / 1.1) ** 2 * 0.45,
    'swell': lambda: sweep(0.5, 500, 6000) * (tt(0.5) / 0.5) ** 2 * 0.5,
    'glitch': lambda: np.concatenate([np.sign(np.sin(2 * np.pi * rng.uniform(200, 2000) * tt(0.03))) * 0.25 for _ in range(6)]),
    'sub': lambda: np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt(1.0) * 1.5)) / SR) * env(1.0, 0.01, 2.2) * 0.8,
    'tick': lambda: lp(rng.standard_normal(int(0.03 * SR)), 5000) * env(0.03, 0.0005, 120) * 0.5,
    'blip': lambda: np.sin(2 * np.pi * 1320 * tt(0.12)) * env(0.12, 0.002, 30) * 0.25,
    'pop': lambda: np.sin(2 * np.pi * np.cumsum(900 * np.exp(-tt(0.06) * 30) + 300) / SR) * env(0.06, 0.001, 50) * 0.22,
    'hit': lambda: impact(0.6) * 0.6,
    'stamp': lambda: add(impact(0.7), lp(rng.standard_normal(int(0.05 * SR)), 4000) * env(0.05, 0.0005, 60) * 0.6),
    'endhit': lambda: add(impact(1.4), hp(rng.standard_normal(int(1.5 * SR)), 6000) * env(1.5, 0.01, 2.5) * 0.15),
}
GAIN = {'pop': 0.5, 'tick': 0.7, 'blip': 0.6}
for e in TL['sfx']: put(sfx, LIB[e['kind']](), e['t'], GAIN.get(e['kind'], 1.0))

# ---------------- mix + loudness ----------------
db = lambda x: 10 ** (x / 20)
mix = voice * db(0) + music * db(-19) + sfx * db(-8)
mix = np.tanh(mix * 1.2) / 1.2
mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
pre = 'build/mix_pre.wav'
with wave.open(pre, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix / np.abs(mix).max() * 0.9, -1, 1) * 32767).astype(np.int16).tobytes())
meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1:LRA=9:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rfind('{'):])
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', pre, '-af',
                f"loudnorm=I=-14:TP=-1:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
                '-ar', str(SR), '-ac', '2', 'build/mix.wav'], check=True)
print('mix ->', subprocess.run(['ffmpeg', '-hide_banner', '-i', 'build/mix.wav', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr.split('Summary:')[-1].split('\n')[3].strip())
