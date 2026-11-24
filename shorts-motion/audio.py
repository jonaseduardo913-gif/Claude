"""Synthesizes a 24 s, 120 BPM soundtrack locked to the video timeline.
Every hit/riser/whoosh lines up with a cut or animation in src/main.js.
Usage: python3 audio.py out.wav
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 24.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
FX = np.zeros(N)  # send to reverb


def place(sig, t, gain=1.0, pan=0.0, send=0.0):
    i = int(t * SR)
    if i >= N: return
    s = sig[: N - i] * gain
    L[i:i + len(s)] += s * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(s)] += s * np.sqrt(0.5 * (1 + pan))
    if send: FX[i:i + len(s)] += s * send


def tt(d): return np.arange(int(d * SR)) / SR


def env(d, a=0.002, decay=8.0):
    t = tt(d); e = np.exp(-t * decay); na = max(1, int(a * SR)); e[:na] *= np.linspace(0, 1, na); return e


def lowpass(x, cutoff):
    """FFT brick-ish lowpass with soft knee."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x))


def highpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (cutoff / np.maximum(f, 1)) ** 4); return np.fft.irfft(X, len(x))


def sweep_noise(d, f0, f1, chunk=0.03):
    """Noise whose brightness sweeps from f0 to f1 (riser / whoosh)."""
    out = np.zeros(int(d * SR)); n = len(out); c = int(chunk * SR)
    src = rng.standard_normal(n + c)
    for k in range(0, n, c):
        p = k / n; fc = f0 * (f1 / f0) ** p
        seg = lowpass(src[k:k + 2 * c], fc)[: min(c, n - k)]
        out[k:k + len(seg)] = seg
    return out / (np.abs(out).max() + 1e-9)


# ---------------- instruments ----------------
def kick(d=0.45, punch=1.0):
    t = tt(d); f = 45 + 160 * np.exp(-t * 32) * punch
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7)
    click = rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.3
    return np.tanh((s + click) * 2.2) * 0.9


def clap():
    d = 0.35; t = tt(d); n = highpass(rng.standard_normal(len(t)), 900)
    e = np.zeros(len(t))
    for o in (0, 0.011, 0.022): e += np.exp(-np.maximum(t - o, 0) * 60) * (t >= o)
    e += 0.6 * np.exp(-t * 14)
    return lowpass(n * e, 7000) * 0.5


def hat(open_=False):
    d = 0.18 if open_ else 0.05; t = tt(d)
    return highpass(rng.standard_normal(len(t)), 8000) * np.exp(-t * (18 if open_ else 90)) * 0.22


def saw(f, d, harm=18):
    t = tt(d); s = np.zeros(len(t))
    for k in range(1, harm + 1):
        if f * k > 12000: break
        s += np.sin(2 * np.pi * f * k * t) / k
    return s * 0.6


def bass(f, d):
    t = tt(d); s = saw(f, d, 10) + 0.8 * np.sin(2 * np.pi * f / 2 * t)
    e = np.minimum(1, t * 200) * np.exp(-t * 2.5)
    return np.tanh(lowpass(s, 380) * 2.5 * e) * 0.55


def stab(freqs, d=0.35):
    t = tt(d); s = sum(saw(f, d, 14) for f in freqs) / len(freqs)
    return lowpass(s, 3500) * env(d, 0.003, 7) * 0.6


def impact(size=1.0):
    d = 1.4 * size; t = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.2 / size)
    nz = lowpass(rng.standard_normal(len(t)), 2200) * np.exp(-t * 6)
    return np.tanh((sub * 1.2 + nz * 0.5) * 1.6) * 0.8


def whoosh(d, up=True):
    s = sweep_noise(d, 300 if up else 6000, 6000 if up else 300)
    t = tt(d); e = np.sin(np.pi * t / d) ** 2
    return s * e * 0.45


def riser(d):
    t = tt(d); s = sweep_noise(d, 200, 9000) * (t / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(200 * 4 ** (t / d)) / SR) * (t / d) ** 2 * 0.25
    return (s * 0.5 + tone)


def blip(f, d=0.18):
    t = tt(d); return np.sign(np.sin(2 * np.pi * f * t)) * env(d, 0.001, 20) * 0.18 + np.sin(2 * np.pi * f * 2 * t) * env(d, 0.001, 25) * 0.15


def glitch_stutter(t0, n=6):
    for k in range(n):
        f = 300 + rng.random() * 1800
        place(blip(f, 0.03), t0 + k * 0.035, 0.9, pan=rng.uniform(-0.7, 0.7))


def bell(f, d=1.6):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    return s * env(d, 0.002, 2.5) * 0.25


def pad(freqs, d):
    t = tt(d); s = sum(saw(f * (1 + dt), d, 8) for f in freqs for dt in (-0.004, 0.004)) / (2 * len(freqs))
    e = np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.8)
    return lowpass(s, 1800) * e * 0.5


# ---------------- arrangement ----------------
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
prog_roots = [29, 25, 32, 27]  # F1 Db1 Ab1 Eb1  (F minor)
chords = [[65, 68, 72], [61, 65, 68], [68, 72, 75], [63, 67, 70]]

slowmo = (13.0, 13.6)
for b in range(int(19.0 / BEAT)):
    t = b * BEAT
    in_slow = slowmo[0] <= t < slowmo[1]
    if not in_slow:
        place(kick(punch=1.15 if t in (0.0, 2.0, 4.5, 7.0, 9.5, 12.0, 15.0) else 1.0), t, 1.0)
    if b % 2 == 1 and t > 1.9 and not in_slow: place(clap(), t, 0.9, send=0.35)
    if t >= 2.0 and not in_slow:
        for k in range(4):
            place(hat(open_=(k == 2)), t + k * BEAT / 4, 0.9 if k % 2 == 0 else 0.6, pan=0.3 if k % 2 else -0.3)
    # bass: 8th-note pump from 2.0
    if t >= 2.0 and not in_slow:
        root = prog_roots[int(t // 2) % 4]
        place(bass(NOTE(root + 12), 0.23), t + 0.25, 0.85)
        place(bass(NOTE(root + 12), 0.2), t, 0.6)

# hook (0–2): punchy stabs on each falling letter + ROLAR
for i in range(4): place(kick(0.25, 0.7), 0.13 + i * 0.07, 0.55)
place(stab([NOTE(m) for m in chords[0]]), 1.0, 1.0, send=0.4)
glitch_stutter(1.5)
place(riser(0.5), 1.5, 0.6)

# scene impacts
for t, s in [(2.0, 0.9), (4.5, 0.9), (7.0, 0.8), (9.5, 0.9), (12.0, 1.0), (15.0, 0.9)]:
    place(impact(s), t, 0.75, send=0.3)
    place(stab([NOTE(m) for m in chords[int(t // 2) % 4]]), t, 0.7, send=0.4)

place(whoosh(0.7), 2.55, 0.8, pan=-0.4)          # MOTION assembles
place(whoosh(0.75), 2.95, 1.0)                    # ring flies through camera
place(whoosh(0.45, False), 3.6, 0.6, pan=0.5)     # cubes zip
place(riser(0.6), 3.9, 0.7)
place(whoosh(0.5), 5.4, 0.7, pan=0.4)            # capsules
place(impact(0.7), 5.95, 0.8, send=0.4)          # ENERGIA explodes
glitch_stutter(5.95, 8)
place(whoosh(0.4, False), 6.3, 0.7)               # reassemble
place(riser(0.5), 6.5, 0.6)
for i, m in enumerate([72, 75, 79, 84]):          # shape morphs
    place(blip(NOTE(m), 0.25), 7.5 + i * 0.5, 1.0, send=0.5)
place(impact(0.6), 9.0, 0.6); glitch_stutter(9.0, 5)  # lightning
place(whoosh(0.7), 9.75, 1.1)                     # whip zoom out
for i in range(4): place(blip(NOTE(84 + i * 3), 0.12), 10.75 + i * 0.08, 0.6, pan=(-1) ** i * 0.5, send=0.4)
# tunnel tape-stop slow-mo
t = tt(0.6); place(np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 3)) / SR) * np.exp(-t * 2) * 0.4, 13.0, 1.0)
place(riser(0.9), 13.6, 0.9)
place(impact(0.8), 13.75, 0.6)
place(whoosh(0.5), 14.5, 1.0)
# rapid cuts: impact on each
for i in range(5):
    place(impact(0.5), 15.0 + i * 0.5, 0.55)
    place(stab([NOTE(m + (i % 2) * 2) for m in chords[i % 4]], 0.25), 15.0 + i * 0.5, 0.6, send=0.3)
glitch_stutter(17.0, 6)
# countdown
for i, f in enumerate([880, 880, 1320]):
    place(blip(f, 0.25), 17.5 + i * 0.5, 1.4, send=0.4)
place(riser(1.5), 17.5, 1.1)
# EXPLOSION
place(impact(2.2), 19.0, 1.4, send=0.6)
nz = lowpass(rng.standard_normal(int(1.8 * SR)), 9000) * env(1.8, 0.001, 2.6)
place(nz * 0.6, 19.0, 1.0, send=0.5)
t = tt(1.0); rev_swell = sweep_noise(1.0, 400, 5000) * (t / 1.0) ** 3 * 0.5
place(rev_swell, 19.0, 0.8)
# END CARD
place(impact(0.8), 20.0, 0.6, send=0.5)
place(pad([NOTE(m) for m in [53, 60, 63, 67, 72]], 4.0), 20.0, 0.9, send=0.5)
place(bell(NOTE(84)), 20.05, 0.9, send=0.6)
place(blip(1800, 0.05), 22.15, 0.8)               # click
place(bell(NOTE(91), 1.2), 22.4, 0.7, pan=0.4, send=0.6)  # notification bell
for b in range(int(20.5 / BEAT), int(23.5 / BEAT)):     # soft kick tail
    place(kick(0.3, 0.6), b * BEAT, 0.35)

# ---------------- reverb + master ----------------
ir_t = tt(1.6); ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2); ir = lowpass(ir, 6000); ir /= np.abs(ir).sum() / 30
n = N + len(ir)
wetL = np.fft.irfft(np.fft.rfft(FX, n) * np.fft.rfft(ir, n), n)[:N]
irR = np.roll(ir, 220)
wetR = np.fft.irfft(np.fft.rfft(FX, n) * np.fft.rfft(irR, n), n)[:N]
L += wetL * 0.25; R += wetR * 0.25

mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.4) / np.tanh(1.4)           # glue / soft clip
mix /= np.abs(mix).max() / 0.92
fade = int(0.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('wrote', out)
