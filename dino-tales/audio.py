"""Dino Contos — procedural soundtrack.
Reads the cue list exported by the renderer (frames/sN/cues.json) and synthesizes
music, ambience, sound effects and "gibberish" character voices, all locked to
the animation timeline.   Usage: python3 audio.py frames/s1/cues.json out.wav
"""
import sys, json, wave
import numpy as np

SR = 44100
cfg = json.load(open(sys.argv[1]))
DUR = cfg['duration'] + 0.5
CUES = cfg['cues']
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N); FX = np.zeros(N); MUS_L = np.zeros(N); MUS_R = np.zeros(N)


def tt(d): return np.arange(int(max(d, 0.001) * SR)) / SR


def place(sig, t, gain=1.0, pan=0.0, send=0.15, bus='sfx'):
    i = int(t * SR)
    if i >= N or i < 0 and i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    s = sig[: N - i] * gain
    a, b = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    if bus == 'mus':
        MUS_L[i:i + len(s)] += s * a; MUS_R[i:i + len(s)] += s * b
    else:
        L[i:i + len(s)] += s * a; R[i:i + len(s)] += s * b
    if send: FX[i:i + len(s)] += s * send


def env(d, a=0.005, decay=6.0):
    t = tt(d); e = np.exp(-t * decay); na = max(1, int(a * SR)); e[:na] *= np.linspace(0, 1, na); return e


def fade(x, a=0.01, r=0.03):
    n = len(x); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: x[:na] *= np.linspace(0, 1, na)
    if nr: x[n - nr:] *= np.linspace(1, 0, nr)
    return x


def filt(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    if hi: X *= 1 / (1 + (f / hi) ** 4)
    if lo: X *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def mixs(*sigs):
    n = max(len(x) for x in sigs); o = np.zeros(n)
    for x in sigs: o[:len(x)] += x
    return o


def noise(d): return rng.standard_normal(len(tt(d)))
def sweep(f0, f1, d, curve='exp'):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d) if curve == 'exp' else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

# ------------------------------------------------------------- instruments
def marimba(f, d=0.6):
    t = tt(d); return (np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 25) + 0.15 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t * 60)) * env(d, 0.002, 0.5) * 0.5


def pluck(f, d=0.9, bright=1.0):
    t = tt(d); s = np.zeros(len(t))
    for k in range(1, 12):
        if f * k > 9000: break
        s += np.sin(2 * np.pi * f * k * t + k) / k ** (1.3 / bright) * np.exp(-t * (2.5 + k * 1.6))
    nz = filt(noise(0.012), 1500) * 0.05
    if len(t) > len(nz): s[:len(nz)] += nz
    return fade(s * 0.45, 0.002, 0.05)


def musicbox(f, d=1.4):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 4) + 0.2 * np.sin(2 * np.pi * f * 5.04 * t) * np.exp(-t * 9)) * env(d, 0.001, 2.6) * 0.32


def bell(f, d=1.8):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)) * env(d, 0.002, 2.4) * 0.25


def bass(f, d=0.5):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) + 0.12 * np.sin(2 * np.pi * f * 3 * t)
    return fade(s * env(d, 0.006, 3.5) * 0.55, 0.004, 0.06)


def pizz(f, d=0.35):
    t = tt(d); s = sum(np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (9 + 3 * k)) for k in range(1, 7))
    return fade(s * 0.5, 0.002, 0.03)


def pad(freqs, d):
    t = tt(d); s = np.zeros(len(t))
    for f in freqs:
        for dt in (-0.003, 0.003):
            for k in range(1, 6): s += np.sin(2 * np.pi * f * (1 + dt) * k * t + k) / k ** 1.5
    e = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.8)
    return filt(s, None, 1600) * e * 0.06 / max(1, len(freqs))


def shaker(d=0.06): return filt(noise(d), 5000) * env(d, 0.004, 60) * 0.12
def bongo(f=220, d=0.25):
    t = tt(d); return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t * 40))) / SR) * np.exp(-t * 18) * 0.5
def softkick(d=0.3):
    t = tt(d); return np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 9) * 0.6
def timp(f=65, d=1.2):
    t = tt(d); return (np.sin(2 * np.pi * np.cumsum(f * (1 + 0.25 * np.exp(-t * 12))) / SR) * np.exp(-t * 3) + filt(noise(d), None, 400) * np.exp(-t * 14) * 0.6) * 0.6

# ---------------------------------------------------------------- music
STYLES = {
    'jungle':  dict(bpm=104, root=60, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead=marimba, comp='arp', comp_inst=marimba, perc='shaker+bongo', bass=True, oct=12),
    'tension': dict(bpm=92, root=57, scale=[0, 2, 3, 7, 8], prog=[[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-5, -1, 2]], lead=pizz, comp='pulse', comp_inst=pizz, perc='timp', bass=True, oct=0, sparse=True),
    'happy':   dict(bpm=112, root=65, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead=bell, comp='arp', comp_inst=marimba, perc='shaker+bongo', bass=True, oct=12),
    'snow':    dict(bpm=80, root=62, scale=[0, 2, 3, 7, 9], prog=[[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], lead=musicbox, comp='slowarp', comp_inst=musicbox, perc='', bass=False, oct=12, padon=True),
    'comic':   dict(bpm=120, root=60, scale=[0, 2, 4, 5, 7, 9], prog=[[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead=pizz, comp='oompah', comp_inst=pizz, perc='', bass=True, oct=12),
    'warm':    dict(bpm=96, root=65, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], lead=bell, comp='strum', comp_inst=pluck, perc='shaker', bass=True, oct=12, padon=True),
    'beach':   dict(bpm=100, root=64, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead=marimba, comp='strum', comp_inst=pluck, perc='shaker+bongo', bass=True, oct=12),
    'chase':   dict(bpm=140, root=57, scale=[0, 2, 3, 5, 7, 8], prog=[[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], lead=pizz, comp='pulse', comp_inst=pizz, perc='timp+shaker', bass=True, oct=12),
    'magic':   dict(bpm=70, root=65, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [-3, 0, 4], [5, 9, 12], [-5, -1, 2]], lead=bell, comp='harp', comp_inst=pluck, perc='', bass=True, oct=12, padon=True, sparse=True),
    'tender':  dict(bpm=62, root=60, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [-7, -3, 0], [-3, 0, 4], [-5, -1, 2]], lead=musicbox, comp='slowarp', comp_inst=pluck, perc='', bass=True, oct=12, padon=True, sparse=True),
    'adventure': dict(bpm=104, root=62, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead=marimba, comp='strum', comp_inst=pluck, perc='shaker', bass=True, oct=12),
    'curious': dict(bpm=84, root=57, scale=[0, 2, 3, 7, 8], prog=[[0, 3, 7], [-4, 0, 3], [0, 3, 7], [-5, -1, 2]], lead=pizz, comp='pulse', comp_inst=pizz, perc='', bass=True, oct=12, sparse=True),
    'sunset':  dict(bpm=84, root=62, scale=[0, 2, 4, 7, 9], prog=[[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead=bell, comp='strum', comp_inst=pluck, perc='', bass=True, oct=12, padon=True),
}


def music(style, t0, t1, gain):
    S = STYLES[style]; beat = 60 / S['bpm']; bar = 4 * beat
    mr = np.random.default_rng(sum(map(ord, style)) * 7 + 3)
    root = S['root']; sc = S['scale']
    # 2-bar motif in scale steps, re-used every 2 bars (memorable hooks)
    rhythm = [0, 1, 1.5, 2, 3, 4, 5, 5.5, 6, 7] if not S.get('sparse') else [0, 1.5, 3, 4, 5.5, 7]
    steps = list(mr.integers(0, len(sc) * 2, len(rhythm)))
    nb = int(np.ceil((t1 - t0) / bar))
    out = []
    for b in range(nb):
        tb = t0 + b * bar; ch = S['prog'][b % len(S['prog'])]
        vol = 1.0
        # bass
        if S['bass']:
            for k, iv in ((0, 0), (2, 7 if style != 'tension' else 0)):
                out.append((bass(NOTE(root - 24 + ch[0] + iv), beat * 1.6), tb + k * beat, 0.9, 0.0, 0.05))
        # comp
        ci = S['comp_inst']; cm = S['comp']
        if cm == 'arp':
            for k in range(8): out.append((ci(NOTE(root + ch[k % 3] + (12 if k % 4 == 3 else 0)), 0.5), tb + k * beat / 2, 0.35, (-0.4, 0.4)[k % 2], 0.2))
        elif cm == 'slowarp':
            for k in range(4): out.append((ci(NOTE(root + ch[k % 3]), 1.6), tb + k * beat, 0.4, (-0.3, 0.3)[k % 2], 0.35))
        elif cm == 'pulse':
            for k in range(8): out.append((ci(NOTE(root - 12 + ch[0] + (0 if k % 2 == 0 else 12)), 0.25), tb + k * beat / 2, 0.55, 0, 0.1))
        elif cm == 'oompah':
            for k in range(4):
                if k % 2 == 0: out.append((ci(NOTE(root - 12 + ch[0]), 0.3), tb + k * beat, 0.7, 0, 0.1))
                else:
                    for n in ch: out.append((ci(NOTE(root + n), 0.25), tb + k * beat, 0.3, 0.2, 0.1))
        elif cm == 'harp':
            for k in range(8): out.append((ci(NOTE(root + ch[k % 3] + 12 * ((k // 3) % 2)), 1.4, 1.4), tb + k * beat / 2, 0.2, (-0.4, 0.4)[k % 2], 0.35))
        elif cm == 'strum':
            for k, pos in enumerate([0, 1.5, 2, 3, 3.5]):
                for j, n in enumerate(ch + [ch[0] + 12]):
                    out.append((ci(NOTE(root + n), 0.9), tb + pos * beat + j * 0.014, 0.22 if k else 0.3, -0.25 + j * 0.15, 0.2))
        if S.get('padon'): out.append((pad([NOTE(root + n) for n in ch], bar + 0.6), tb, 1.0, 0, 0.4))
        # lead motif (rest every 4th bar half for breath)
        half = b % 2
        for r, st in zip(rhythm, steps):
            if r // 4 != half: continue
            if b % 4 == 3 and r % 4 >= 2: continue
            deg = int(st) + (2 if b % 4 == 2 else 0)
            m = root + S['oct'] + sc[deg % len(sc)] + 12 * (deg // len(sc)) + (ch[0] if abs(ch[0]) < 6 else 0) * 0
            out.append((S['lead'](NOTE(m), 0.9), tb + (r % 4) * beat, 0.42, 0.1, 0.3))
        # percussion
        p = S['perc']
        if 'shaker' in p:
            for k in range(8): out.append((shaker(), tb + k * beat / 2, 0.8 if k % 2 else 0.5, 0.3, 0))
        if 'bongo' in p:
            for k, f in ((1.5, 330), (2.5, 250), (3.5, 330), (3.75, 250)): out.append((bongo(f), tb + k * beat, 0.35, -0.3, 0.05))
        if 'timp' in p and b % 2 == 0: out.append((timp(NOTE(root - 24 + ch[0])), tb, 0.8, 0, 0.2))
        if style in ('jungle', 'happy', 'beach', 'comic', 'chase'):
            for k in (0, 2): out.append((softkick(), tb + k * beat, 0.45, 0, 0))
    for sig, t, g, pan, send in out:
        if t >= t1 - 0.05: continue
        # fade in/out envelope
        k = min(1, (t - t0) / 0.6 + 0.2) * min(1, (t1 - t) / 1.2)
        place(sig, t, g * gain * max(0, k), pan, send, bus='mus')


def sting(t, gain=1.0):
    for i, m in enumerate([72, 76, 79, 84]): place(bell(NOTE(m), 1.5), t + i * 0.09, 0.6 * gain, (-0.3, 0.3)[i % 2], 0.4)
    place(pad([NOTE(60), NOTE(64), NOTE(67), NOTE(72)], 2.6) * 3, t + 0.36, 0.7 * gain, 0, 0.5)
    place(timp(65, 1.6), t, 0.6 * gain, 0, 0.3)

# ------------------------------------------------------------ ambience
def amb(kind, t0, t1, gain):
    d = t1 - t0; n = int(d * SR)
    if kind == 'forest': kind = 'jungle'; gain *= 0.8
    if kind == 'stream':
        x = filt(rng.standard_normal(n), 400, 3500); m = filt(np.abs(rng.standard_normal(n)), None, 18)
        place(x * (0.02 + 0.05 * m / (m.max() + 1e-9)), t0, gain, -0.2, 0.15)
        for _ in range(int(d * 6)): place(sweep(500 + rng.random() * 900, 900 + rng.random() * 1400, 0.04) * env(0.04, 0.002, 60) * 0.05, t0 + rng.random() * d, gain, rng.uniform(-0.6, 0.6), 0.3)
        return
    if kind == 'falls':
        x = filt(rng.standard_normal(n), 60, 4000) * 0.09 + filt(rng.standard_normal(n), 30, 200) * 0.06
        e = np.minimum(1, np.arange(n) / SR / 1.0) * np.minimum(1, (d - np.arange(n) / SR) / 1.0)
        place(x * e, t0, gain, 0, 0.1); return
    if kind == 'jungle':
        base = filt(rng.standard_normal(n), 300, 1800) * 0.012
        ins = filt(rng.standard_normal(n), 5500, 8000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * np.arange(n) / SR)) * 0.006
        place(base + ins, t0, gain, 0, 0)
        t = t0 + 0.4
        while t < t1 - 0.5:   # birds
            f = 1800 + rng.random() * 2200; k = rng.integers(2, 5)
            for j in range(k):
                c = sweep(f, f * (1.3 if rng.random() < 0.5 else 0.75), 0.07) * env(0.07, 0.005, 25)
                place(c, t + j * 0.1, 0.05 * gain, rng.uniform(-0.8, 0.8), 0.4)
            t += 0.8 + rng.random() * 2.2
    elif kind == 'wind':
        x = rng.standard_normal(n); out = np.zeros(n); c = int(0.25 * SR)
        for i in range(0, n, c):
            fc = 400 + 500 * (0.5 + 0.5 * np.sin(i / SR * 0.7) * np.sin(i / SR * 0.23 + 1))
            seg = filt(x[i:i + 2 * c], 150, fc)[:min(c, n - i)]; out[i:i + len(seg)] = seg
        lfo = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(n) / SR * 0.17)
        place(out * lfo * 0.05, t0, gain, 0, 0.1)
    elif kind == 'waves':
        x = filt(rng.standard_normal(n), 120, 2500)
        tt_ = np.arange(n) / SR; sw = np.clip(np.sin(2 * np.pi * tt_ / 6.5) * 0.5 + 0.55, 0, 1) ** 2
        sw2 = np.clip(np.sin(2 * np.pi * tt_ / 9.1 + 2) * 0.5 + 0.5, 0, 1) ** 3
        place(x * (0.025 + 0.06 * sw), t0, gain, -0.3, 0.1); place(np.roll(x, 9000) * (0.02 + 0.05 * sw2), t0, gain, 0.3, 0.1)
        t = t0 + 1
        while t < t1 - 1:  # gulls
            place(sweep(1400, 900, 0.35, 'lin') * env(0.35, 0.03, 4) * 0.5 + sweep(2800, 1800, 0.35, 'lin') * env(0.35, 0.03, 4) * 0.15, t, 0.05 * gain, rng.uniform(-0.6, 0.6), 0.4)
            t += 4 + rng.random() * 5
    elif kind == 'fire':
        x = filt(rng.standard_normal(n), 80, 600) * 0.03
        place(x, t0, gain, 0, 0)
        cnt = int(d * 14)
        for _ in range(cnt):
            c = filt(rng.standard_normal(int(0.012 * SR)), 1500, None) * env(0.012, 0.0005, 300)
            place(c, t0 + rng.random() * d, (0.05 + rng.random() * 0.12) * gain, rng.uniform(-0.3, 0.3), 0.1)
    elif kind == 'night':
        tt_ = np.arange(n) / SR
        cr = np.sin(2 * np.pi * 4300 * tt_) * (np.sin(2 * np.pi * 30 * tt_) > 0.6) * (np.sin(2 * np.pi * 0.8 * tt_) > 0) * 0.004
        place(cr, t0, gain, 0.4, 0.2); place(np.roll(cr, 13000) * 0.8, t0, gain, -0.4, 0.2)

# ------------------------------------------------------------ SFX bank
def sfx(c):
    k, t, g, pan = c['type'], c['t'], c.get('gain', 1.0), c.get('pan', 0)
    if k == 'step':
        s = filt(noise(0.07), 60, 900) * env(0.07, 0.002, 60) + np.sin(2 * np.pi * 90 * tt(0.07)) * env(0.07, 0.001, 50) * 0.4
        place(s * 0.35, t, g, pan, 0.05)
    elif k == 'hop':
        place(sweep(500, 900, 0.07) * env(0.07, 0.003, 30) * 0.12, t, g, pan, 0.1)
    elif k == 'thud':
        d = 0.9; tt_ = tt(d)
        s = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-tt_ * 10)) / SR) * np.exp(-tt_ * 5) + filt(noise(d), None, 300) * np.exp(-tt_ * 9) * 0.6
        place(np.tanh(s * 1.5) * 0.7, t, g, pan, 0.25)
    elif k == 'whoosh':
        d = 0.45; s = filt(noise(d), 400, 3000) * np.sin(np.pi * tt(d) / d) ** 2
        place(s * 0.3, t, g, pan, 0.2)
    elif k == 'bonk':
        d = 0.35; tt_ = tt(d); s = np.sin(2 * np.pi * np.cumsum(420 * (1 - 0.3 * tt_ / d)) / SR) * np.exp(-tt_ * 14) + filt(noise(d), 200, 2000) * np.exp(-tt_ * 40) * 0.5
        place(s * 0.6, t, g, pan, 0.2); place(filt(noise(0.2), 50, 400) * env(0.2, 0.001, 20) * 0.6, t, g, pan, 0.1)
    elif k == 'tweet':
        for j in range(6): place(sweep(2600, 1900, 0.09) * env(0.09, 0.005, 20) * 0.12, t + 0.15 + j * 0.16, g, np.sin(j * 1.7) * 0.6, 0.4)
    elif k == 'knock':
        d = 0.12; tt_ = tt(d); s = np.sin(2 * np.pi * 950 * tt_) * np.exp(-tt_ * 45) + filt(noise(d), 1000, 5000) * np.exp(-tt_ * 90) * 0.4
        place(s * 0.45, t, g, pan, 0.15)
    elif k == 'wobble':
        for j in range(9): place(filt(noise(0.03), 800, 4000) * env(0.03, 0.001, 120) * 0.25, t + j * 0.045, g, (j % 2 - 0.5) * 0.4, 0.1)
    elif k == 'crack':
        for j in range(5): place(filt(noise(0.025), 1500, 9000) * env(0.025, 0.0005, 200) * 0.6, t + j * 0.03 + rng.random() * 0.01, g, 0, 0.2)
    elif k == 'pop':
        d = 0.25; place(mixs(sweep(900, 250, d) * env(d, 0.001, 14) * 0.5, filt(noise(0.04), 500, 6000) * env(0.04, 0.0005, 80) * 0.6), t, g, pan, 0.3)
        for j, m in enumerate([79, 84, 88, 91]): place(bell(NOTE(m), 0.8), t + 0.05 + j * 0.06, 0.25 * g, (-0.4, 0.4)[j % 2], 0.4)
    elif k == 'boing':
        d = 0.5; tt_ = tt(d); f = 180 * (1 + 0.8 * tt_ / d) * (1 + 0.12 * np.sin(2 * np.pi * 18 * tt_))
        place(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt_ * 6) * 0.35, t, g, pan, 0.2)
    elif k == 'heart':
        for j, m in enumerate([84, 88, 91, 96]): place(bell(NOTE(m), 1.0), t + j * 0.07, 0.22 * g, (-0.3, 0.3)[j % 2], 0.5)
    elif k == 'freeze':
        place(sweep(300, 1400, 0.25) * env(0.25, 0.01, 3) * 0.12, t, g, 0, 0.2)
        place(np.sin(2 * np.pi * 1200 * tt(0.05)) * env(0.05, 0.001, 60) * 0.2, t + 0.28, g, 0, 0.2)
    elif k == 'leaves':
        d = 0.9; s = filt(noise(d), 2000, 8000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * tt(d)))) * np.sin(np.pi * tt(d) / d)
        place(s * 0.12, t, g, pan, 0.2)
    elif k == 'roar':
        d = 1.4; tt_ = tt(d); f0 = 95 + 25 * np.sin(np.pi * tt_ / d) + 6 * np.sin(2 * np.pi * 7 * tt_)
        s = np.zeros(len(tt_))
        for h in range(1, 14): s += np.sin(2 * np.pi * np.cumsum(f0 * h) / SR) / h ** 0.8
        s = filt(s, 60, 1600) * 0.3 + filt(noise(d), 200, 1400) * 0.35
        e = np.minimum(1, tt_ / 0.12) * np.minimum(1, (d - tt_) / 0.4)
        out_ = np.tanh(s * e * 2.2) * 0.8
        if c.get('soft'): out_ = filt(out_, None, 700) * 1.4
        place(out_, t, g, 0, 0.6 if c.get('soft') else 0.45)
    elif k == 'gasp':
        place(sweep(400, 900, 0.18) * env(0.18, 0.01, 8) * 0.12, t, g, pan, 0.2)
    elif k == 'sneeze':
        for j, f in enumerate([300, 360]): place(voice(f, 0.18, 'a', 'sq'), t + j * 0.28, 0.6 * g, pan, 0.2)
        d = 0.35; place(mixs(filt(noise(d), 800, 7000) * env(d, 0.003, 9) * 0.6, voice(450, 0.22, 'u', 'sq') * 0.5), t + 0.62, g, pan, 0.3)
    elif k == 'spark':
        for j in range(14): place(filt(noise(0.015), 3000, None) * env(0.015, 0.0005, 300) * (0.3 + rng.random() * 0.4), t + j * 0.025 + rng.random() * 0.03, g, rng.uniform(-0.5, 0.5), 0.3)
        place(np.sin(2 * np.pi * 2200 * tt(0.1)) * env(0.1, 0.001, 40) * 0.15, t, g, 0, 0.3)
    elif k == 'ignite':
        d = 1.4; tt_ = tt(d); out = np.zeros(len(tt_)); x = rng.standard_normal(len(tt_)); c = int(0.05 * SR)
        for i in range(0, len(tt_), c):
            fc = 150 + 2500 * min(1, i / SR / 0.4) * np.exp(-max(0, i / SR - 0.4) * 1.5)
            seg = filt(x[i:i + 2 * c], 40, fc)[:min(c, len(tt_) - i)]; out[i:i + len(seg)] = seg
        place(out * np.minimum(1, tt_ / 0.1) * np.exp(-tt_ * 1.5) * 0.8, t, g, 0, 0.4)
        for j, m in enumerate([67, 72, 76, 79, 84]): place(bell(NOTE(m), 1.6), t + 0.3 + j * 0.08, 0.25 * g, (-0.3, 0.3)[j % 2], 0.5)
    elif k == 'flap':
        d = 0.16; place(filt(noise(d), 100, 900) * np.sin(np.pi * tt(d) / d) ** 2 * 0.35, t, g, pan, 0.1)
    elif k == 'splash':
        d = 0.7; place(filt(noise(d), 300, 6000) * env(d, 0.002, 6) * 0.35, t, g, pan, 0.3)
        for j in range(8): place(sweep(800 + rng.random() * 800, 1600 + rng.random() * 1000, 0.05) * env(0.05, 0.002, 50) * 0.06, t + 0.05 + rng.random() * 0.4, g, rng.uniform(-0.5, 0.5), 0.3)
    elif k == 'bigsplash':
        d = 1.6; tt_ = tt(d); place(filt(noise(d), 80, 5000) * np.minimum(1, tt_ / 0.05) * np.exp(-tt_ * 2.2) * 0.6, t, g, pan, 0.4)
        place(np.sin(2 * np.pi * np.cumsum(60 + 40 * np.exp(-tt_ * 6)) / SR) * np.exp(-tt_ * 4) * 0.5, t, g, pan, 0.2)
    elif k == 'reel':
        d = c.get('d', 1.0); n = int(d / 0.035)
        for j in range(n): place(filt(noise(0.008), 2500, None) * env(0.008, 0.0005, 400) * 0.25, t + j * 0.035, g, 0.2, 0.05)
    elif k == 'tug':
        place(sweep(160, 120, 0.25) * env(0.25, 0.01, 6) * 0.3 + pizz(NOTE(45), 0.25) * 0.3, t, g, pan, 0.1)
    elif k == 'gulp':
        place(sweep(500, 180, 0.18) * env(0.18, 0.005, 10) * 0.35, t, g, pan, 0.15); place(sweep(300, 600, 0.06) * env(0.06, 0.002, 30) * 0.15, t + 0.2, g, pan, 0.2)
    elif k == 'cast':
        d = 0.5; place(filt(noise(d), 1500, 7000) * np.sin(np.pi * tt(d) / d) ** 3 * 0.2, t, g, pan, 0.2); place(sweep(1800, 600, 0.4) * env(0.4, 0.01, 4) * 0.05, t, g, pan, 0.2)
    elif k == 'plop':
        place(sweep(700, 1500, 0.08) * env(0.08, 0.002, 30) * 0.3, t, g, pan, 0.3)
    elif k == 'rub':
        d = c.get('d', 1.0); tt_ = tt(d); place(filt(noise(d), 800, 3500) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * tt_)) * 0.12, t, g, pan, 0.1)
    elif k == 'clack':
        place(filt(noise(0.05), 600, 6000) * env(0.05, 0.0005, 70) * 0.7 + np.sin(2 * np.pi * 1300 * tt(0.05)) * env(0.05, 0.0005, 60) * 0.3, t, g, pan, 0.25)
    elif k == 'fizzle':
        d = 0.6; place(filt(noise(d), 2000, 9000) * env(d, 0.01, 6) * 0.15, t, g, pan, 0.2); place(sweep(500, 150, 0.5) * env(0.5, 0.01, 5) * 0.12, t + 0.1, g, pan, 0.3)
    elif k == 'snowfall':
        d = 0.6; place(filt(noise(d), 100, 1500) * env(d, 0.002, 6) * 0.6, t, g, pan, 0.2)
    elif k == 'yawn':
        place(voice(140, 0.9, 'a', 'saw', glide=-0.4) * 0.8, t, g, pan, 0.3)
    elif k == 'laugh':
        for j in range(c.get('n', 4)): place(voice(c.get('f', 300) * (1 - j * 0.04), 0.12, 'a', c.get('wave', 'sq')), t + j * 0.16, 0.7 * g, pan, 0.2)
    elif k == 'chomp':
        place(filt(noise(0.06), 300, 3000) * env(0.06, 0.001, 50) * 0.5, t, g, pan, 0.1)
    elif k == 'twinkle':
        for j, m in enumerate([88, 91, 95, 100]): place(bell(NOTE(m), 0.7), t + j * 0.05, 0.15 * g, (-0.4, 0.4)[j % 2], 0.6)
    elif k == 'rustle':
        d = c.get('d', 1.0); tt_ = tt(d); m = np.abs(np.sin(2 * np.pi * 11 * tt_)) * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * tt_))
        place(filt(noise(d), 1200, 7000) * m * np.sin(np.pi * tt_ / d) * 0.35, t, g, pan, 0.2)
    elif k == 'shimmer':
        for j, m in enumerate([79, 83, 86, 91, 95, 98]): place(bell(NOTE(m), 1.4), t + j * 0.07, 0.14 * g, (-0.5, 0.5)[j % 2], 0.6)
    elif k == 'plank':
        d = 0.14; tt_ = tt(d); place((np.sin(2 * np.pi * 180 * tt_) * np.exp(-tt_ * 35) + filt(noise(d), 200, 1500) * np.exp(-tt_ * 50) * 0.5) * 0.4, t, g, pan, 0.1)
    elif k == 'boop':
        place(sweep(400, 900, 0.12) * env(0.12, 0.005, 18) * 0.25, t, g, pan, 0.3)
        for j, m in enumerate([84, 88, 91]): place(bell(NOTE(m), 0.9), t + 0.05 + j * 0.06, 0.15 * g, 0, 0.5)
    elif k == 'squeak':
        for j in range(2):
            d = 0.16; tt_ = tt(d); f = (1300 + 700 * tt_ / d) * (1 + 0.03 * np.sin(2 * np.pi * 30 * tt_)) * (1.15 if j else 1)
            place(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.01, 10) * 0.18, t + j * 0.2, g, pan, 0.3)
    elif k == 'drop':
        place(sweep(1200, 300, 0.5) * env(0.5, 0.01, 3) * 0.12, t, g, pan, 0.2)

# --------------------------------------------------------------- voices
VOW = {'a': (800, 1200), 'e': (450, 2000), 'i': (300, 2400), 'o': (500, 850), 'u': (330, 750)}
def voice(f0, d, v='a', wave_='sq', glide=-0.08):
    t = tt(d); f = f0 * (1 + glide * t / d) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    F1, F2 = VOW[v]; s = np.zeros(len(t))
    nh = {'sq': 18, 'tri': 8, 'saw': 26}[wave_]
    for h in range(1, nh + 1):
        fh = f0 * h
        if fh > 7000: break
        a = np.exp(-((fh - F1) / 260) ** 2) + 0.7 * np.exp(-((fh - F2) / 380) ** 2) + 0.25 / h
        if wave_ == 'tri' and h % 2 == 0: a *= 0.4
        s += np.sin(ph * h) * a
    e = np.minimum(1, t / 0.012) * np.minimum(1, (d - t) / 0.035)
    return s * np.clip(e, 0, 1) / (np.abs(s).max() + 1e-9) * 0.3


def blip(c):
    v = 'aeiou'[int(c['pitch'] * 7) % 5]
    place(voice(c['pitch'], max(0.05, c['d']), v, c.get('wave', 'sq')), c['t'], 0.85 * c.get('gain', 1), c.get('pan', 0), 0.12)

# ---------------------------------------------------------------- narration
VOX = np.zeros(N)
def narr(c):
    import os
    path = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), '..', '..', c['file'])
    with wave.open(path) as w:
        sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
        if w.getnchannels() == 2: a = a.reshape(-1, 2).mean(1)
    a = np.interp(np.arange(int(len(a) * SR / sr)) * sr / SR, np.arange(len(a)), a)
    a = a + 0.35 * filt(a, None, 260)            # warmth
    i = int(c['t'] * SR); n = min(len(a), N - i)
    VOX[i:i + n] += a[:n] * c.get('gain', 1.0)
    FX[i:i + n] += a[:n] * 0.06

# ---------------------------------------------------------------- render
speech = [c for c in CUES if c['type'] == 'blip'] + [dict(t=c['t'], d=c.get('d', 0) or 0) for c in CUES if c['type'] == 'voice']
for c in CUES:
    k = c['type']
    if k == 'blip': blip(c)
    elif k == 'voice': narr(c); c['d'] = 0
    elif k == 'music': music(c['style'], c['t'], c['t1'], c.get('gain', 0.5))
    elif k == 'amb': amb(c['kind'], c['t'], c['t1'], c.get('gain', 0.5))
    elif k == 'sting': sting(c['t'], c.get('gain', 1))
    else: sfx(c)

# duck music under dialogue
duck = np.ones(N)
for c in speech:
    a, b = int((c['t'] - 0.15) * SR), int((c['t'] + c['d'] + 0.3) * SR)
    duck[max(0, a):min(N, b)] = 0.55
k = int(0.12 * SR); ker = np.ones(k) / k; duck = np.convolve(duck, ker, mode='same')
if VOX.any():
    env_ = np.convolve(np.abs(VOX), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode='same')
    duck = np.minimum(duck, 1 - 0.5 * np.clip(env_ / (env_.max() * 0.25 + 1e-9), 0, 1))
    duck = np.convolve(duck, ker, mode='same')
    vr = np.sqrt(np.mean(VOX[VOX != 0] ** 2)); VOX *= 0.16 / (vr + 1e-9)
    L += VOX; R += VOX
L += MUS_L * duck * 1.3; R += MUS_R * duck * 1.3
FX += (MUS_L + MUS_R) * 0.5 * duck * 0.25

# reverb (FFT convolution with decaying filtered noise)
ir_t = tt(1.8); ir = filt(rng.standard_normal(len(ir_t)), 200, 5000) * np.exp(-ir_t * 3.2)
ir /= np.sqrt((ir ** 2).sum())
nfft = 1 << int(np.ceil(np.log2(N + len(ir))))
wet = np.fft.irfft(np.fft.rfft(FX, nfft) * np.fft.rfft(ir, nfft), nfft)[:N] * 0.35
wetR = np.fft.irfft(np.fft.rfft(FX, nfft) * np.fft.rfft(np.roll(ir, 331), nfft), nfft)[:N] * 0.35
L += wet; R += wetR

# master: gentle compression + limiter, fades
mx = np.stack([L, R])
mx = filt(mx[0], 25, None), filt(mx[1], 25, None)
mx = np.stack(mx)
peak = np.abs(mx).max(); mx = mx / (peak + 1e-9) * 1.25
mx = np.tanh(mx * 1.1) / np.tanh(1.1 * 1.25) * 0.93
fo = int(0.8 * SR); mx[:, -fo:] *= np.linspace(1, 0, fo)
out = (np.clip(mx.T, -1, 1) * 32767).astype(np.int16)
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', sys.argv[2], f'{DUR:.1f}s, cues={len(CUES)}')
