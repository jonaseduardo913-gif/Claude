"""Procedural audio for the engineering channel: original music bed + mechanical SFX + mixing.

Everything is synthesized from scratch (no samples), so it is royalty-free and reproducible.
All functions work on float32 numpy arrays at SR (48 kHz).
"""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def t_(dur):
    return np.arange(int(dur * SR)) / SR


def env_ad(n, a=0.005, d=0.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def noise(n):
    return RNG.standard_normal(n).astype(np.float32)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def reverb(x, seconds=1.2, wet=0.25, damp=3000):
    n = int(seconds * SR)
    ir = noise(n) * np.exp(-np.arange(n) / SR * 5.5 / seconds)
    ir = lowpass(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    y = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - wet) + y * wet


def place(bus, clip, at, gain=1.0):
    i = int(at * SR)
    if i >= len(bus) or i + len(clip) <= 0:
        return
    if i < 0:
        clip, i = clip[-i:], 0
    j = min(len(bus), i + len(clip))
    bus[i:j] += clip[: j - i] * gain


def saw(freq, t):
    """band-limited-ish saw via polyBLEP-free additive approximation (8 harmonics)"""
    y = np.zeros_like(t)
    for k in range(1, 9):
        y += ((-1) ** (k + 1)) * np.sin(2 * np.pi * freq * k * t) / k
    return y * (2 / np.pi)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name, octave):
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)


# ------------------------------------------------------------------ music
CHORDS = {  # D minor documentary progression i - VI - III - VII
    "D": [("D", "F", "A"), ("A#", "D", "F"), ("F", "A", "C"), ("C", "E", "G")],
}


def music(total, energy_at, bpm=96, key="D"):
    """energy_at(t) -> 0..3. Returns stereo (n,2) music bed."""
    n = int(total * SR)
    t = np.arange(n) / SR
    beat = 60.0 / bpm
    bar = beat * 4
    prog = CHORDS.get(key, CHORDS["D"])
    E = np.array([energy_at(x) for x in np.arange(0, total, 0.05)])
    E = np.interp(t, np.arange(len(E)) * 0.05, E)
    E = lowpass(np.concatenate([E, E[-1:].repeat(SR)]), 1.5, 1)[:n]  # smooth transitions

    pad = np.zeros(n); bass = np.zeros(n); arp = np.zeros(n); drums = np.zeros(n)
    nbars = int(np.ceil(total / bar)) + 1
    for b in range(nbars):
        c = prog[b % len(prog)]
        s0 = b * bar
        seg_t = t_(bar + 0.6)
        # pad: detuned saws, slow attack, filtered
        voice = np.zeros_like(seg_t)
        for i, nm in enumerate(c):
            for det in (-0.12, 0.0, 0.11):
                f = hz(nm, 3 if i == 0 else 4) * 2 ** (det / 12)
                voice += saw(f, seg_t)
        voice += saw(hz(c[0], 2), seg_t) * 0.6
        a = np.minimum(1, seg_t / 0.6) * np.minimum(1, (bar + 0.6 - seg_t) / 0.6)
        place(pad, voice * a, s0)
        # bass pulses (8ths) with sidechain-like shape
        for k in range(8):
            st = s0 + k * beat / 2
            tt = t_(beat / 2)
            sh = (1 - np.exp(-tt * 40)) * np.exp(-tt * 3)
            place(bass, np.sin(2 * np.pi * hz(c[0], 2) * tt) * sh, st)
        # arpeggio (16ths) chord tones up two octaves
        pattern = [0, 1, 2, 1, 0, 2, 1, 2]
        for k in range(16):
            st = s0 + k * beat / 4
            tt = t_(0.35)
            nm = c[pattern[k % 8]]
            f = hz(nm, 5 if k % 4 else 4)
            tone = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * env_ad(len(tt), 0.002, 0.18, 6)
            place(arp, tone, st)
        # drums: kick on 1 & 3 (and all beats at energy 3), hats on 8ths
        for k in range(4):
            st = s0 + k * beat
            tt = t_(0.4)
            f = 45 + 90 * np.exp(-tt * 30)
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
            place(drums, kick * (1.0 if k % 2 == 0 else 0.0), st)
            place(drums, kick * 0.7 * (k % 2), st)  # off-beat kicks gated by energy below
        for k in range(8):
            st = s0 + k * beat / 2
            h = highpass(noise(int(0.05 * SR)), 7000) * env_ad(int(0.05 * SR), 0.001, 0.03, 5)
            place(drums, h * (0.25 if k % 2 else 0.12), st)

    pad = lowpass(pad, 1400) * 0.10
    arp = lowpass(arp, 5000) * 0.06
    bass = bass * 0.22
    drums = drums * 0.30
    g_pad = 0.7 + 0.3 * np.clip(E / 3, 0, 1)
    g_bass = np.clip(E - 1, 0, 1)
    g_arp = np.clip(E - 0.5, 0, 1)
    g_drm = np.clip(E - 2, 0, 1)
    mono = pad * g_pad + bass * g_bass + arp * g_arp + drums * g_drm
    # stereo: arp ping-pong via slight delay, pad widened
    left = mono + 0.35 * np.roll(arp * g_arp, int(0.011 * SR))
    right = mono + 0.35 * np.roll(pad * g_pad, int(0.017 * SR))
    st = np.stack([left, right], 1)
    st = np.stack([reverb(st[:, 0], 2.0, 0.22), reverb(st[:, 1], 2.0, 0.22)], 1)
    return st.astype(np.float32)


# ------------------------------------------------------------------ SFX library
def metal_click(pitch=1.0, dur=0.12):
    tt = t_(dur)
    x = (np.sin(2 * np.pi * 3200 * pitch * tt) * 0.6 + np.sin(2 * np.pi * 5150 * pitch * tt) * 0.4
         + np.sin(2 * np.pi * 1800 * pitch * tt) * 0.3) * env_ad(len(tt), 0.0005, 0.05, 6)
    x += highpass(noise(len(tt)), 2500) * env_ad(len(tt), 0.0003, 0.008, 6) * 0.8
    return x


def whoosh(dur=0.7, f0=300, f1=3000, reverse=False):
    n = int(dur * SR)
    x = noise(n)
    out = np.zeros(n)
    hop = 1024
    for i in range(0, n, hop):
        u = i / n
        fc = f0 * (f1 / f0) ** u
        seg_ = bandpass(x[max(0, i - 2048): i + hop], max(40, fc * 0.6), min(SR / 2 - 100, fc * 1.6))
        out[i: i + hop] = seg_[-len(out[i: i + hop]):]
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    out *= e
    return out[::-1] if reverse else out


def thud(f=70, dur=0.5):
    tt = t_(dur)
    fr = f + f * 1.5 * np.exp(-tt * 25)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 8)


def bell(f, dur=1.2):
    tt = t_(dur)
    x = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * d) for m, a, d in [(1, 1, 3), (2.76, 0.4, 5), (5.4, 0.2, 8)])
    return x * np.minimum(1, tt / 0.003)


def sfx(kind, ev, dur):
    """returns list of (offset_seconds, clip, gain)"""
    k = kind
    if k == "whoosh_in":
        return [(0, whoosh(0.8, 200, 4000), 0.5)]
    if k == "key_slide":
        n = int(1.4 * SR)
        x = bandpass(noise(n), 1800, 6500) * (0.5 + 0.5 * np.abs(np.sin(np.linspace(0, 30, n)))) * np.sin(np.pi * np.linspace(0, 1, n)) ** 0.5
        return [(0, x * 0.35, 1.0)]
    if k == "pin_clicks":
        cnt, spread = ev.get("count", 5), ev.get("spread", 0.4) * dur
        return [(spread * i / max(1, cnt - 1) + RNG.uniform(-0.03, 0.03), metal_click(RNG.uniform(0.85, 1.2)), 0.55) for i in range(cnt)]
    if k == "cut_reveal":
        tt = t_(1.2)
        sh = np.sin(2 * np.pi * (1200 + 2400 * tt) * tt) * np.exp(-tt * 2.5) * 0.25
        return [(0, whoosh(1.0, 600, 9000) + sh[: int(1.0 * SR)], 0.55)]
    if k == "ui_tick":
        tt = t_(0.09)
        return [(0, np.sin(2 * np.pi * 1650 * tt) * env_ad(len(tt), 0.001, 0.04, 5), 0.25)]
    if k == "spring":
        tt = t_(0.45)
        f = 520 + 60 * np.sin(2 * np.pi * 18 * tt) - 200 * tt
        return [(0, np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(tt), 0.003, 0.3, 4), 0.22)]
    if k == "blocked":
        out = [(0, thud(95, 0.35), 0.7), (0, metal_click(0.6, 0.15), 0.6)]
        out += [(0.06 * i, metal_click(0.7 + 0.1 * i, 0.08), 0.35) for i in range(1, 4)]
        return out
    if k == "laser_draw":
        tt = t_(0.8)
        f = 400 * (4 ** (tt / 0.8))
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.8) * 0.5 + highpass(noise(len(tt)), 6000) * 0.05
        return [(0, x, 0.35)]
    if k == "key_seat":
        return [(0, metal_click(0.7, 0.2), 0.8), (0, thud(110, 0.25), 0.6)]
    if k == "align_chime":
        cnt, spread = ev.get("count", 5), ev.get("spread", 0.5) * dur
        notes = [hz(n, 5) for n in ["D", "F", "A", "C", "D"]]
        notes[-1] *= 2
        return [(spread * i / max(1, cnt - 1), bell(notes[i % 5], 1.0), 0.22) for i in range(cnt)]
    if k == "turn":
        out = [(0.05 * i, metal_click(0.5 + 0.03 * i, 0.06), 0.35) for i in range(10)]
        out.append((0, lowpass(noise(int(0.6 * SR)), 300) * np.sin(np.pi * np.linspace(0, 1, int(0.6 * SR))), 0.4))
        return out
    if k == "clunk":
        return [(0, thud(65, 0.6), 1.0), (0, bandpass(noise(int(0.15 * SR)), 300, 1200) * env_ad(int(0.15 * SR), 0.001, 0.05, 5), 0.8), (0.01, metal_click(0.45, 0.25), 0.5)]
    if k == "error":
        tt = t_(0.22)
        a = signal.square(2 * np.pi * 180 * tt) * env_ad(len(tt), 0.005, 0.15, 3)
        return [(0, lowpass(a, 1500), 0.18), (0.25, lowpass(signal.square(2 * np.pi * 140 * tt) * env_ad(len(tt), 0.005, 0.15, 3), 1500), 0.18)]
    if k == "swarm":
        out = [(0, whoosh(1.2, 300, 6000), 0.35)]
        out += [(RNG.uniform(0, 1.3), metal_click(RNG.uniform(0.9, 1.5), 0.08), 0.18) for _ in range(28)]
        return out
    if k == "impact":
        tt = t_(1.6)
        sub = np.sin(2 * np.pi * (42 + 30 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 2.2)
        return [(0, sub, 0.9), (0, lowpass(noise(len(tt)), 900) * np.exp(-tt * 6), 0.5)]
    if k == "explode":
        return [(0, whoosh(1.2, 150, 5000), 0.5)] + [(0.05 * i, metal_click(RNG.uniform(0.7, 1.3), 0.1), 0.25) for i in range(8)]
    if k == "assemble":
        return [(0, whoosh(1.1, 5000, 200, reverse=False), 0.45), (1.0, metal_click(0.6, 0.2), 0.7), (1.0, thud(90, 0.3), 0.6)]
    if k == "outro":
        tt = t_(2.5)
        return [(0, np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 1.6), 0.6), (0, bell(hz("D", 5), 2.5), 0.15)]
    D = ev.get("dur", 2.0)
    if k == "motor_hum":
        tt = t_(D)
        x = sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(100, 1), (200, 0.5), (300, 0.25), (50, 0.6)])
        x = x * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * tt)) + lowpass(noise(len(tt)), 400) * 0.3
        e = np.minimum(1, tt / 0.4) * np.minimum(1, (D - tt) / 0.6)
        return [(0, x * e, 0.12)]
    if k == "wind":
        tt = t_(D)
        x = bandpass(noise(len(tt)), 250, 2200) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * tt + 1))
        return [(0, x * np.sin(np.pi * tt / D), 0.35)]
    if k == "rope_creak":
        tt = t_(0.9)
        f = 180 + 40 * np.sin(2 * np.pi * 3 * tt)
        x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (np.abs(np.sin(2 * np.pi * 9 * tt)) ** 3)
        return [(0, bandpass(x, 300, 2500) * np.sin(np.pi * tt / 0.9), 0.25)]
    if k == "shimmer":
        tt = t_(1.4)
        x = sum(np.sin(2 * np.pi * hz(n, 6) * tt) * np.exp(-tt * (2 + i)) for i, n in enumerate(["D", "A", "F#", "E"]))
        return [(0, x * np.minimum(1, tt / 0.02), 0.12)]
    if k == "governor_spin":
        tt = t_(D)
        f = 18 + 10 * tt / D
        x = (np.abs(np.sin(np.pi * np.cumsum(f) / SR)) ** 8) * bandpass(noise(len(tt)), 800, 4000)
        return [(0, x * np.minimum(1, tt / 0.3) * np.minimum(1, (D - tt) / 0.3), 0.5)]
    if k == "governor_trip":
        return [(0, metal_click(0.55, 0.3), 1.0), (0, thud(140, 0.3), 0.7), (0.05, metal_click(0.8, 0.12), 0.6)]
    if k == "wedge_grip":
        tt = t_(D)
        f = 900 - 500 * tt / D
        x = signal.sawtooth(2 * np.pi * np.cumsum(f + 40 * np.sin(2 * np.pi * 23 * tt)) / SR)
        x = bandpass(x, 600, 5000) * np.exp(-tt * 0.8) * np.minimum(1, tt / 0.03) + bandpass(noise(len(tt)), 2000, 8000) * np.exp(-tt * 2) * 0.4
        return [(0, x, 0.3), (0, thud(80, 0.5), 0.8)]
    if k == "buffer":
        return [(0, thud(90, 0.4), 0.7)] + sfx("spring", {}, 1)
    if k == "elevator_ding":
        return [(0, bell(hz("E", 5), 1.6), 0.25), (0.32, bell(hz("C", 5), 2.0), 0.25)]
    if k == "riser":
        tt = t_(D)
        x = bandpass(noise(len(tt)), 300, 6000) * (tt / D) ** 2
        tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2 * tt / D)) / SR) * (tt / D) ** 2
        return [(0, x * 0.6 + tone * 0.4, 0.4)]
    if k == "ocean":
        tt = t_(D)
        x = lowpass(noise(len(tt)), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.18 * tt) ** 2)
        return [(0, x * np.minimum(1, tt / 0.5) * np.minimum(1, (D - tt) / 0.8), 0.5)]
    if k == "underwater":
        tt = t_(D)
        x = lowpass(noise(len(tt)), 350) + 0.3 * np.sin(2 * np.pi * 60 * tt)
        bub = np.zeros(len(tt))
        for i in range(int(D * 6)):
            st = int(RNG.uniform(0, D - 0.1) * SR); n = int(0.06 * SR)
            bt = np.arange(n) / SR
            bub[st:st + n] += np.sin(2 * np.pi * (600 + 900 * bt / 0.06) * bt)[: len(bub[st:st + n])] * np.exp(-bt * 40)
        return [(0, (x * 0.8 + bub * 0.3) * np.minimum(1, tt / 0.3) * np.minimum(1, (D - tt) / 0.5), 0.5)]
    if k == "rumble":
        tt = t_(D)
        x = lowpass(noise(len(tt)), 160) * 1.5 + 0.4 * np.sin(2 * np.pi * 38 * tt) + bandpass(noise(len(tt)), 900, 3000) * (np.abs(np.sin(2 * np.pi * 7 * tt)) ** 6) * 0.5
        return [(0, x * np.minimum(1, tt / 0.4) * np.minimum(1, (D - tt) / 0.5), 0.5)]
    if k == "conveyor":
        tt = t_(D)
        x = bandpass(noise(len(tt)), 400, 1800) * (0.6 + 0.4 * (np.sin(2 * np.pi * 11 * tt) > 0.6)) + 0.2 * np.sin(2 * np.pi * 120 * tt)
        return [(0, x * np.minimum(1, tt / 0.3) * np.minimum(1, (D - tt) / 0.4), 0.3)]
    if k == "hydraulic":
        tt = t_(D)
        whine = np.sin(2 * np.pi * np.cumsum(300 + 200 * tt / D) / SR) * 0.4
        hiss = highpass(noise(len(tt)), 3000) * 0.3
        return [(0, (whine + hiss) * np.sin(np.pi * tt / D), 0.4)]
    if k == "rock_break":
        out = [(0, lowpass(noise(int(1.2 * SR)), 1200) * np.exp(-t_(1.2) * 3), 0.8), (0, thud(55, 0.9), 0.9)]
        out += [(RNG.uniform(0.05, 0.9), bandpass(noise(int(0.08 * SR)), 800, 4000) * env_ad(int(0.08 * SR), 0.001, 0.05, 5), 0.4) for _ in range(14)]
        return out
    if k == "train_pass":
        tt = t_(D)
        x = lowpass(noise(len(tt)), 700) * (0.4 + 0.6 * np.exp(-((tt - D / 2) / (D / 4)) ** 2))
        clack = np.zeros(len(tt))
        for i in range(int(D * 4)):
            st = int(i / 4 * SR); n = int(0.05 * SR)
            clack[st:st + n] += bandpass(noise(n), 300, 1500)[: len(clack[st:st + n])] * np.exp(-np.arange(n)[: len(clack[st:st + n])] / SR * 60)
        return [(0, (x + clack * 0.6) * np.minimum(1, tt / 0.5) * np.minimum(1, (D - tt) / 0.6), 0.5)]
    raise ValueError("unknown sfx " + kind)


# ------------------------------------------------------------------ mixing
def mix(total, narration_clips, sfx_events, energy_at, bpm=96, key="D"):
    """narration_clips: [(start, mono@SR)], sfx_events: [(time, kind, ev, scene_dur)]"""
    n = int(total * SR) + SR
    voice = np.zeros(n)
    for st, clip in narration_clips:
        place(voice, clip, st)
    fx = np.zeros(n)
    for tm, kind, ev, d in sfx_events:
        for off, clip, g in sfx(kind, ev, d):
            place(fx, clip.astype(np.float64), tm + off, g)
    fx = reverb(fx, 0.9, 0.18)
    mus = music(total + 1, energy_at, bpm, key)[:n]
    if len(mus) < n:
        mus = np.pad(mus, ((0, n - len(mus)), (0, 0)))
    # ---- gain staging (explicit targets, dBFS RMS)
    def rms(v):
        return np.sqrt(np.mean(v ** 2)) + 1e-9
    voiced = np.abs(voice) > 1e-4
    if voiced.any():
        voice = voice * (10 ** (-16 / 20) / rms(voice[voiced]))
    mus = mus * (10 ** (-25 / 20) / rms(mus))
    if np.any(fx):
        fx = fx / (np.max(np.abs(fx)) + 1e-9) * 10 ** (-5 / 20)
    # ducking: music drops ~9 dB under narration
    venv = lowpass(np.abs(voice), 5, 1)
    venv = np.clip(venv / (np.percentile(venv[voiced], 60) if voiced.any() else 1), 0, 1)
    duck = 1.0 - 0.65 * venv
    fade = np.ones(n)
    fi, fo = int(0.15 * SR), int(1.8 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    end = int(total * SR)
    fade[end - fo:end] = np.linspace(1, 0, fo)
    fade[end:] = 0
    mus = mus * (duck * fade)[:, None]
    out = np.stack([voice, voice], 1) + np.stack([fx, fx], 1) + mus
    out = out[:end]
    self_stats = {"voice_rms_db": 20 * np.log10(rms(voice[voiced[:len(voice)]])) if voiced.any() else None,
                  "music_rms_db_under_voice": 20 * np.log10(rms(mus[:end][voiced[:end]])) if voiced.any() else None}
    print("mix levels:", {k: round(v, 1) for k, v in self_stats.items() if v is not None})
    out = np.tanh(out / 0.95) * 0.95  # soft limiter
    return norm(out, 0.89).astype(np.float32)
