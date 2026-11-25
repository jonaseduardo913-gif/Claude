"""EXTRAMUNDO mix: narration + dark cinematic score (level keyframes) + SFX -> build/mix.wav at -14 LUFS."""
import json, subprocess, wave
import numpy as np

SR = 48000
TL = json.load(open('build/timeline.json'))
N = int(TL['duration'] * SR) + SR // 2
rng = np.random.default_rng(5)
LEAD = TL.get('lead', 0.0)

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
def saw(f, d, n=10):
    t = tt(d); return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, n + 1) if f * k < 12000) * 0.6
def put(buf, sig, t, g=1.0):
    i = int(t * SR)
    if i < 0: sig = sig[-i:]; i = 0
    if i >= len(buf): return
    s = sig[: len(buf) - i] * g; buf[i:i + len(s)] += s
def add(a, b):
    n = max(len(a), len(b)); o = np.zeros(n); o[:len(a)] += a; o[:len(b)] += b; return o
def sweep(d, f0, f1, chunk=0.025):
    n = int(d * SR); c = int(chunk * SR); src = rng.standard_normal(n + 2 * c); out = np.zeros(n)
    for k in range(0, n, c):
        fc = f0 * (f1 / f0) ** (k / n); seg = lp(src[k:k + 2 * c], fc)[: min(c, n - k)]; out[k:k + len(seg)] = seg
    return out / (np.abs(out).max() + 1e-9)
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

END = TL['end']['t0']
# ---------------- score: D minor drones + pulse, level-automated ----------------
BPM = 90; beat = 60 / BPM; bar = 4 * beat
drone = np.zeros(N); pulse = np.zeros(N); perc = np.zeros(N)
chords = [[38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [36, 48, 55, 60, 64], [33, 45, 52, 57, 61]]   # Dm Bb C A
nb = int(np.ceil(END / bar)) + 1
for b in range(nb):
    t0 = b * bar; ch = chords[b % 4]; d = bar + 0.6
    pad = sum(saw(NOTE(m) * (1 + dt), d, 6) for m in ch[1:] for dt in (-0.004, 0.004)) / 8
    pad = lp(pad, 900) * np.minimum(1, tt(d) / 0.6) * np.minimum(1, (d - tt(d)) / 0.6)
    put(drone, pad + lp(saw(NOTE(ch[0]), d, 6), 200) * 0.7 * np.minimum(1, tt(d) / 0.3) * np.minimum(1, (d - tt(d)) / 0.5), t0)
    for k in range(8):   # low 8th pulse
        put(pulse, lp(saw(NOTE(ch[0]), beat / 2 * 0.85, 8), 300) * env(beat / 2 * 0.85, 0.003, 7), t0 + k * beat / 2, 0.6)
    for k in range(4):   # taiko-ish hits on 1 and 3, ticks between
        tk = t0 + k * beat
        if k % 2 == 0:
            tq = tt(0.6); put(perc, np.sin(2 * np.pi * np.cumsum(55 + 70 * np.exp(-tq * 22)) / SR) * np.exp(-tq * 6) * 1.0, tk)
        put(perc, hp(rng.standard_normal(int(0.05 * SR)), 5000) * env(0.05, 0.001, 70) * 0.25, tk + beat / 2)
# level automation from storyboard keyframes (0..1): drone always, pulse/perc scale with level
keys = sorted(TL['music'], key=lambda m: m['t']) or [{'t': 0, 'level': 0.6}]
tl = np.arange(N) / SR
lvl = np.interp(tl, [k['t'] for k in keys], [k['level'] for k in keys])
music = drone * (0.55 + 0.45 * lvl) + pulse * np.clip(lvl * 1.4 - 0.3, 0, 1) + perc * np.clip(lvl * 1.6 - 0.6, 0, 1)
music[tl >= END] = 0
put(music, lp(sum(saw(NOTE(m), 4.0, 8) for m in [26, 38, 45, 50, 57, 62, 65]) / 7, 1800) * env(4.0, 0.02, 0.9), END, 1.2)   # final swell

# ---------------- voice + ducking ----------------
vo = load('build/narration.wav')
voice = np.zeros(N); i0 = int(LEAD * SR); voice[i0:i0 + len(vo)] = vo[: N - i0]
win = int(0.08 * SR)
ev = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode='same'))
act = np.convolve(np.clip(ev / (ev.max() * 0.25), 0, 1), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode='same')
music *= (1 - 0.4 * act)

# ---------------- SFX ----------------
sfx = np.zeros(N)
def impact(size=1.0):
    t = tt(1.4 * size); sub = np.sin(2 * np.pi * np.cumsum(36 + 90 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.5 / size)
    return np.tanh((sub + lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 8) * 0.5) * 1.8) * 0.85
def fire(d):
    base = lp(rng.standard_normal(int(d * SR)), 1200) * 0.5
    cr = np.zeros(int(d * SR))
    for _ in range(int(d * 22)):
        k = int(rng.uniform(0, d - 0.02) * SR); n = int(0.006 * SR); cr[k:k + n] += hp(rng.standard_normal(n), 2500) * rng.uniform(0.3, 1)
    e = np.minimum(1, tt(d) / 0.4) * np.minimum(1, (d - tt(d)) / 0.4)
    return (base + cr) * e * 0.5
def wind(d):
    s = sweep(d, 300, 900) * 0.5 + lp(rng.standard_normal(int(d * SR)), 500) * 0.6
    return s * np.sin(np.pi * tt(d) / d) ** 0.7 * 0.5
def rumble(d):
    t = tt(d); return np.tanh(lp(rng.standard_normal(len(t)), 140) * 3) * np.sin(np.pi * t / d) * 0.8 + add(np.zeros(1), lp(rng.standard_normal(len(t)), 900) * np.sin(np.pi * t / d) ** 2 * 0.25)
LIB = {
    'whoosh': lambda e: sweep(0.45, 400, 6000) * np.sin(np.pi * tt(0.45) / 0.45) ** 2 * 0.6,
    'whooshlong': lambda e: sweep(1.0, 250, 4500) * np.sin(np.pi * tt(1.0) / 1.0) ** 2 * 0.5,
    'swell': lambda e: sweep(0.5, 500, 6000) * (tt(0.5) / 0.5) ** 2 * 0.5,
    'glitch': lambda e: np.concatenate([np.sign(np.sin(2 * np.pi * rng.uniform(200, 2000) * tt(0.03))) * 0.25 for _ in range(6)]),
    'sub': lambda e: np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt(1.0) * 1.5)) / SR) * env(1.0, 0.01, 2.2) * 0.8,
    'tick': lambda e: lp(rng.standard_normal(int(0.03 * SR)), 5000) * env(0.03, 0.0005, 120) * 0.5,
    'blip': lambda e: np.sin(2 * np.pi * 990 * tt(0.12)) * env(0.12, 0.002, 30) * 0.2,
    'pop': lambda e: np.sin(2 * np.pi * np.cumsum(700 * np.exp(-tt(0.06) * 30) + 220) / SR) * env(0.06, 0.001, 50) * 0.18,
    'hit': lambda e: impact(0.6) * 0.6,
    'impact': lambda e: impact(1.2),
    'endhit': lambda e: add(impact(1.5), hp(rng.standard_normal(int(1.5 * SR)), 6000) * env(1.5, 0.01, 2.5) * 0.12),
    'wind': lambda e: wind(e.get('dur', 3.0)),
    'fire': lambda e: fire(e.get('dur', 4.0)),
    'rumble': lambda e: rumble(e.get('dur', 3.0)),
}
GAIN = {'pop': 0.45, 'tick': 0.6, 'blip': 0.5, 'fire': 0.55, 'wind': 0.8}
for e in TL['sfx']: put(sfx, LIB[e['kind']](e), e['t'], GAIN.get(e['kind'], 1.0))

# ---------------- master ----------------
db = lambda x: 10 ** (x / 20)
mix = voice + music * db(-17) + sfx * db(-9)
mix = np.tanh(mix * 1.15) / 1.15
mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
pre = 'build/mix_pre.wav'
with wave.open(pre, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix / np.abs(mix).max() * 0.9, -1, 1) * 32767).astype(np.int16).tobytes())
meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1:LRA=9:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rfind('{'):])
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', pre, '-af',
                f"loudnorm=I=-14:TP=-1:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
                '-ar', str(SR), '-ac', '2', 'build/mix.wav'], check=True)
print('mix done')
