#!/usr/bin/env python3
"""Episode production pipeline.

  python3 tools/produce.py <episode_id> [--steps tts,timeline,render,video,audio,captions,final,storyboard]
                                        [--workers 2] [--only S03,S04]

Inputs:  episodes/<id>/episode.json  (script, storyboard, transitions, sfx)
         episodes/<id>/scene.js      (3D models + per-scene animation)
Outputs: output/<id>/  narration/, clips/, timeline.json, video_raw.mp4, mix.wav,
         captions.ass, captions.srt, <id>.mp4 (FINAL), storyboard.jpg, storyboard.md
"""
import argparse
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
import audio  # noqa: E402

VOICES = Path("/opt/tools/voices")
TAIL = 0.45            # transition overlap seconds
LEAD_IN = 0.18         # narration starts this long after the scene starts
MIN_SCENE, MAX_SCENE = 3.0, 7.0
XFADE = {"fade": "fade", "zoomin": "zoomin", "smoothup": "smoothup", "wipeleft": "wipeleft",
         "fadeblack": "fadeblack", "slideup": "slideup", "circleopen": "circleopen", "smoothleft": "smoothleft",
         "dissolve": "dissolve", "none": None}


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd)[:220])
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def load(ep_id):
    ep = json.loads((ROOT / "episodes" / ep_id / "episode.json").read_text())
    out = ROOT / "output" / ep_id
    out.mkdir(parents=True, exist_ok=True)
    return ep, out


# ------------------------------------------------------------------ 1. narration
def words_of(text):
    return re.findall(r"[\wÀ-ÿ\-\.,:;!?…'’]+", text)


def norm_word(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def external_narration(ep, out):
    """Use a provided narration file + word alignment (faster-whisper) instead of TTS."""
    na = ep["narration_audio"]
    tempo = na.get("tempo", 1.0)
    src = ROOT / "episodes" / ep["id"] / na["file"]
    nd = out / "narration"; nd.mkdir(exist_ok=True)
    dst = nd / "full.wav"
    words = json.loads((ROOT / "episodes" / ep["id"] / na.get("alignment", "alignment.json")).read_text())
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.float32).copy()
    mp = na.get("max_pause")
    if mp:  # shorten long pauses between words (keeps the voice untouched)
        keep, removed, cursor, xf = [], 0.0, 0, int(0.012 * 48000)
        shift = [0.0] * len(words)
        for i in range(len(words) - 1):
            shift[i] = removed
            g0, g1 = words[i]["end"], words[i + 1]["start"]
            if g1 - g0 > mp:
                c0, c1 = int((g0 + mp / 2) * 48000), int((g1 - mp / 2) * 48000)
                keep.append(a[cursor:c0]); cursor = c1; removed += (c1 - c0) / 48000
        shift[-1] = removed
        keep.append(a[cursor:])
        out_a = keep[0]
        for k in keep[1:]:
            if len(out_a) > xf and len(k) > xf:
                ramp = np.linspace(0, 1, xf, dtype=np.float32)
                out_a = np.concatenate([out_a[:-xf], out_a[-xf:] * (1 - ramp) + k[:xf] * ramp, k[xf:]])
            else:
                out_a = np.concatenate([out_a, k])
        words = [{"w": w["w"], "start": w["start"] - shift[i], "end": w["end"] - shift[i]} for i, w in enumerate(words)]
        print(f"pauses shortened: removed {removed:.2f}s")
        a = out_a
    tmp = nd / "trimmed.wav"
    with wave.open(str(tmp), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(48000)
        wf.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
    af = f"atempo={tempo}" if abs(tempo - 1) > 1e-6 else "anull"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", af, "-ac", "1", "-ar", "48000", dst])
    words = [{"w": w["w"], "start": round(w["start"] / tempo, 3), "end": round(w["end"] / tempo, 3)} for w in words]
    with wave.open(str(dst)) as wf:
        secs = wf.getnframes() / wf.getframerate()
    (out / "narration.json").write_text(json.dumps({"mode": "external", "file": str(dst.relative_to(ROOT)), "seconds": round(secs, 3),
                                                    "tempo": tempo, "words": words}, indent=1, ensure_ascii=False))
    print(f"narration: external {secs:.2f}s (tempo {tempo}), {len(words)} words")


def tts(ep, out):
    if ep.get("narration_audio"):
        return external_narration(ep, out)
    from piper import PiperVoice, SynthesisConfig
    v = ep["voice"]
    voice = PiperVoice.load(str(VOICES / f"{v['model']}.onnx"))
    cfg = SynthesisConfig(length_scale=v.get("length_scale", 1.0), noise_scale=0.6, noise_w_scale=0.75)
    nd = out / "narration"; nd.mkdir(exist_ok=True)
    meta = {}
    for sc in ep["scenes"]:
        pieces, words, cursor = [], [], 0.0
        for ch in voice.synthesize(sc["narration"], syn_config=cfg):
            a = ch.audio_float_array.astype(np.float32)
            sr = ch.sample_rate
            # trim silence
            thr = 0.02 * np.max(np.abs(a))
            idx = np.where(np.abs(a) > thr)[0]
            s0, s1 = (idx[0], idx[-1]) if len(idx) else (0, len(a))
            a = a[max(0, s0 - int(0.02 * sr)): s1 + int(0.06 * sr)]
            dur = len(a) / sr
            # word timing from phoneme counts (punctuation adds a small pause weight)
            ph_words = "".join(ch.phonemes).split(" ")
            tw = words_of(" ".join(ph_words))  # not used for text, only count check
            text_words = None
            pieces.append((a, sr))
            meta.setdefault("_chunks", []).append((sc["id"], cursor, dur, ph_words))
            cursor += dur + 0.16
        # stitch sentences with short gaps, resample to 48k
        sr = pieces[0][1]
        gap = np.zeros(int(0.16 * sr), np.float32)
        full = np.concatenate([np.concatenate([p, gap]) for p, _ in pieces])[: -len(gap)]
        x48 = np.interp(np.arange(int(len(full) * 48000 / sr)) / 48000, np.arange(len(full)) / sr, full).astype(np.float32)
        # words: align text words to sentence chunks
        sentences = re.split(r"(?<=[\.\?\!:])\s+", sc["narration"].strip())
        chunks = [c for c in meta["_chunks"] if c[0] == sc["id"]]
        if len(sentences) != len(chunks):  # fall back to one block
            sentences = [sc["narration"]]
            chunks = [(sc["id"], 0.0, len(full) / sr, sum((c[3] for c in chunks), []))]
        for sent, (_, c0, cdur, phw) in zip(sentences, chunks):
            tws = sent.split()
            weights = []
            for i, w in enumerate(tws):
                base = len(phw[i]) if len(phw) == len(tws) else len(re.sub(r"\W", "", w)) * 1.1
                pause = 2.5 if re.search(r"[,:;]$", w) else 0
                weights.append(max(1.5, base) + pause)
            tot = sum(weights)
            tcur = c0
            for w, wt in zip(tws, weights):
                d = cdur * wt / tot
                words.append({"w": w, "start": round(tcur, 3), "end": round(tcur + d, 3)})
                tcur += d
        f = nd / f"{sc['id']}.wav"
        with wave.open(str(f), "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(48000)
            wf.writeframes((np.clip(x48, -1, 1) * 32767).astype(np.int16).tobytes())
        meta[sc["id"]] = {"file": str(f.relative_to(ROOT)), "seconds": round(len(x48) / 48000, 3), "words": words}
        print(f"tts {sc['id']}: {meta[sc['id']]['seconds']:.2f}s  {sc['narration']}")
    meta.pop("_chunks", None)
    (out / "narration.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


# ------------------------------------------------------------------ 2. timeline
def scene_starts_external(ep, nar):
    ws = [norm_word(w["w"]) for w in nar["words"]]
    starts = []
    for i, sc in enumerate(ep["scenes"]):
        key = [norm_word(x) for x in sc["starts_with"].split()]
        lo = 0 if not starts else starts[-1][1] + 1
        idx = next((j for j in range(lo, len(ws)) if ws[j:j + len(key)] == key), None)
        if idx is None:
            raise SystemExit(f"{sc['id']}: starts_with '{sc['starts_with']}' not found in alignment")
        t = 0.0 if i == 0 else max(0.0, nar["words"][idx]["start"] - 0.12)
        starts.append((t, idx))
    return [t for t, _ in starts]


def timeline(ep, out):
    nar = json.loads((out / "narration.json").read_text())
    f = ep["format"]
    if nar.get("mode") == "external":
        st = scene_starts_external(ep, nar)
        end = max(nar["seconds"], nar["words"][-1]["end"]) + ep.get("outro_seconds", 1.0)
        scenes, frames = [], 0
        for i, sc in enumerate(ep["scenes"]):
            t0 = round(st[i] * f["fps"]) / f["fps"]
            t1 = round((st[i + 1] if i + 1 < len(st) else end) * f["fps"]) / f["fps"]
            dur = round(t1 - t0, 4)
            last = i == len(ep["scenes"]) - 1
            tail = 0 if last or XFADE.get(sc.get("transition", "fade")) is None else TAIL
            scenes.append({"id": sc["id"], "start": t0, "duration": dur, "tail": tail, "clip_seconds": round(dur + tail, 3),
                           "frame_offset": frames, "transition": sc.get("transition", "fade")})
            frames += round((dur + tail) * f["fps"])
        total = scenes[-1]["start"] + scenes[-1]["duration"]
        tl = {"episode": ep["id"], "fps": f["fps"], "width": f["width"], "height": f["height"], "total_seconds": round(total, 3),
              "scenes": scenes, "warnings": []}
        (out / "timeline.json").write_text(json.dumps(tl, indent=1))
        print(f"timeline: {len(scenes)} scenes, {total:.2f}s  " + " ".join(f"{x['id']}={x['duration']:.1f}" for x in scenes))
        return tl
    t, frames, scenes, warn = 0.0, 0, [], []
    for i, sc in enumerate(ep["scenes"]):
        need = nar[sc["id"]]["seconds"] + LEAD_IN + 0.42
        dur = max(sc.get("min_seconds", MIN_SCENE), need, MIN_SCENE)
        if dur > MAX_SCENE:
            warn.append(f"{sc['id']} needs {dur:.2f}s (> {MAX_SCENE}s): shorten narration or split scene")
        dur = round(dur * f["fps"]) / f["fps"]
        last = i == len(ep["scenes"]) - 1
        tail = 0 if last or XFADE.get(sc.get("transition", "fade")) is None else TAIL
        scenes.append({"id": sc["id"], "start": round(t, 3), "duration": dur, "tail": tail,
                       "clip_seconds": round(dur + tail, 3), "frame_offset": frames,
                       "transition": sc.get("transition", "fade")})
        t += dur
        frames += round((dur + tail) * f["fps"])
    tl = {"episode": ep["id"], "fps": f["fps"], "width": f["width"], "height": f["height"],
          "total_seconds": round(t, 3), "scenes": scenes, "warnings": warn}
    (out / "timeline.json").write_text(json.dumps(tl, indent=1))
    print(f"timeline: {len(scenes)} scenes, {t:.2f}s")
    for w in warn:
        print("WARNING:", w)
    return tl


# ------------------------------------------------------------------ 3. render (3D frames -> clips)
def render(ep, out, workers, only=None):
    cmd = ["node", ROOT / "tools/render.cjs", "--ep", ep["id"], "--timeline", out / "timeline.json", "--workers", workers]
    if only:
        cmd += ["--only", only]
    run(cmd)


# ------------------------------------------------------------------ 4. video assembly with transitions
def video(ep, out):
    tl = json.loads((out / "timeline.json").read_text())
    sc = tl["scenes"]
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for s in sc:
        cmd += ["-i", out / "clips" / f"{s['id']}.mp4"]
    parts, last = [], "[0:v]"
    for i in range(1, len(sc)):
        kind = XFADE.get(sc[i - 1]["transition"]) or "fade"
        dur = sc[i - 1]["tail"] or 1 / tl["fps"]
        lbl = f"[v{i}]"
        parts.append(f"{last}[{i}:v]xfade=transition={kind}:duration={dur}:offset={sc[i]['start']:.4f}{lbl}")
        last = lbl
    fc = ";".join(parts) + f";{last}format=yuv420p[vout]"
    cmd += ["-filter_complex", fc, "-map", "[vout]", "-c:v", "libx264", "-crf", "15", "-preset", "medium",
            "-r", tl["fps"], "-t", f"{tl['total_seconds']:.3f}", out / "video_raw.mp4"]
    run(cmd)


# ------------------------------------------------------------------ 5. audio
def build_audio(ep, out):
    tl = json.loads((out / "timeline.json").read_text())
    nar = json.loads((out / "narration.json").read_text())
    by_id = {s["id"]: s for s in ep["scenes"]}
    clips, events, energy = [], [], []
    external = nar.get("mode") == "external"
    if external:
        with wave.open(str(ROOT / nar["file"])) as wf:
            clips.append((0.0, np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32767))
    for s in tl["scenes"]:
        if not external:
            with wave.open(str(ROOT / nar[s["id"]]["file"])) as wf:
                x = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32767
            clips.append((s["start"] + LEAD_IN, x))
        for ev in by_id[s["id"]].get("sfx", []):
            events.append((s["start"] + ev["u"] * s["duration"], ev["type"], ev, s["duration"]))
        energy.append((s["start"], s["start"] + s["duration"], by_id[s["id"]].get("music", 1)))

    def energy_at(t):
        for a, b, e in energy:
            if a <= t < b:
                return e
        return energy[-1][2]

    m = ep.get("music", {})
    mixd = audio.mix(tl["total_seconds"], clips, events, energy_at, m.get("bpm", 96), m.get("key", "D"))
    with wave.open(str(out / "mix.wav"), "wb") as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(audio.SR)
        wf.writeframes((mixd * 32767).astype(np.int16).tobytes())
    print("audio: mix.wav", f"{len(mixd) / audio.SR:.2f}s")


# ------------------------------------------------------------------ 6. captions
def ts_ass(t):
    cs = int(round(t * 100)); return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ts_srt(t):
    ms = int(round(t * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def captions(ep, out):
    tl = json.loads((out / "timeline.json").read_text())
    nar = json.loads((out / "narration.json").read_text())
    W, H = tl["width"], tl["height"]
    hdr = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter ExtraBold,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,7,3,2,90,90,330,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    style = ep.get("captions", {}).get("style", "karaoke")
    if style == "pop":
        hdr = hdr.replace("Style: Cap,Inter ExtraBold,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,7,3,2,90,90,330,1",
                          "Style: Cap,Inter ExtraBold,96,&H00FFFFFF,&H00FFFFFF,&H00202020,&H96000000,0,0,0,0,100,100,0,0,1,4,5,2,80,80,640,1")
    ev, srt, n = [], [], 0
    groups = ([[dict(w) for w in nar["words"]]] if nar.get("mode") == "external" else
              [[dict(w, start=w["start"] + s["start"] + LEAD_IN, end=w["end"] + s["start"] + LEAD_IN) for w in nar[s["id"]]["words"]] for s in tl["scenes"]])
    for words in groups:
        # group into chunks: max 3 words / 18 chars, break after punctuation
        chunks, cur = [], []
        maxw, maxc = (2, 14) if style == "pop" else (3, 18)
        for w in words:
            if cur and w["start"] - cur[-1]["end"] > 0.45:   # pause in speech -> new caption
                chunks.append(cur); cur = []
            cur.append(w)
            text = " ".join(x["w"] for x in cur)
            if len(cur) >= maxw or len(text) >= maxc or re.search(r"[\.,:;\?!]$", w["w"]):
                chunks.append(cur); cur = []
        if cur:
            chunks.append(cur)
        for ci, ch in enumerate(chunks):
            nxt = chunks[ci + 1][0]["start"] if ci + 1 < len(chunks) else 1e9
            end_hold = min(nxt, ch[-1]["end"] + 0.6)
            if style == "pop":
                txt = " ".join(re.sub(r"[\.,;:]+$", "", x["w"]) for x in ch)
                ev.append(f"Dialogue: 0,{ts_ass(ch[0]['start'])},{ts_ass(end_hold)},Cap,,0,0,0,,"
                          + r"{\fscx80\fscy80\t(0,90,\fscx104\fscy104)\t(90,160,\fscx100\fscy100)}" + txt)
                n += 1
                srt.append(f"{n}\n{ts_srt(ch[0]['start'])} --> {ts_srt(end_hold)}\n{txt}\n")
                continue
            clean = [re.sub(r"[\.,;:]+$", "", x["w"]).upper() for x in ch]
            for wi, w in enumerate(ch):
                t0 = w["start"]
                t1 = ch[wi + 1]["start"] if wi + 1 < len(ch) else end_hold
                txt = " ".join((r"{\c&H3DD9FF&\fscx106\fscy106}" + c + r"{\c&HFFFFFF&\fscx100\fscy100}") if j == wi else c
                               for j, c in enumerate(clean))
                pop = r"{\fad(40,0)}" if wi == 0 else ""
                ev.append(f"Dialogue: 0,{ts_ass(t0)},{ts_ass(t1)},Cap,,0,0,0,,{pop}{txt}")
            n += 1
            srt.append(f"{n}\n{ts_srt(ch[0]['start'])} --> {ts_srt(end_hold)}\n{' '.join(x['w'] for x in ch)}\n")
    (out / "captions.ass").write_text(hdr + "\n".join(ev) + "\n")
    (out / "captions.srt").write_text("\n".join(srt))
    print(f"captions: {n} chunks")


# ------------------------------------------------------------------ 7. final
def final(ep, out):
    dst = out / f"{ep['id']}.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", out / "video_raw.mp4", "-i", out / "mix.wav",
         "-vf", f"ass={out / 'captions.ass'}:fontsdir=/usr/share/fonts/opentype/inter",
         "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
         "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-shortest", dst])
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate",
                            "-of", "json", dst], capture_output=True, text=True).stdout
    print("final:", dst, json.dumps(json.loads(probe)))


# ------------------------------------------------------------------ 8. storyboard
def storyboard(ep, out):
    from PIL import Image, ImageDraw, ImageFont
    tl = json.loads((out / "timeline.json").read_text())
    by_id = {s["id"]: s for s in ep["scenes"]}
    thumbs = []
    sb = out / "storyboard"; sb.mkdir(exist_ok=True)
    for s in tl["scenes"]:
        f = sb / f"{s['id']}.jpg"
        run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{s['start'] + s['duration'] * 0.6:.3f}", "-i", out / f"{ep['id']}.mp4",
             "-frames:v", "1", "-vf", "scale=270:480", f])
        thumbs.append((s, Image.open(f)))
    cols = 6
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 290 + 20, rows * 540 + 20), (12, 15, 20))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Bold.otf", 18)
    for i, (s, im) in enumerate(thumbs):
        x, y = 20 + (i % cols) * 290, 20 + (i // cols) * 540
        sheet.paste(im, (x, y))
        d.text((x, y + 486), f"{s['id']} · {s['duration']:.1f}s · {s['transition']}", fill=(220, 230, 240), font=font)
    sheet.save(out / "storyboard.jpg", quality=90)
    nar = json.loads((out / "narration.json").read_text())
    md = [f"# Storyboard — {ep['title']}", "", f"Duração total: {tl['total_seconds']:.1f}s · {len(tl['scenes'])} cenas", "",
          "![storyboard](storyboard.jpg)", ""]
    for s in tl["scenes"]:
        e = by_id[s["id"]]
        md += [f"## {s['id']} — {s['start']:.1f}s → {s['start'] + s['duration']:.1f}s ({s['duration']:.1f}s)", "",
               f"![{s['id']}](storyboard/{s['id']}.jpg)", "",
               f"**Narração:** {e['narration']}", "", f"**Visual:** {e['storyboard']}", "", f"**Câmera:** {e['camera']}", "",
               f"**Efeitos sonoros:** " + ", ".join(f"{x['type']} @ {x['u'] * s['duration']:.1f}s" for x in e.get("sfx", [])), "",
               f"**Transição:** {s['transition']}", ""]
    (out / "storyboard.md").write_text("\n".join(md))
    print("storyboard:", out / "storyboard.jpg")


STEPS = ["tts", "timeline", "render", "video", "audio", "captions", "final", "storyboard"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--steps", default=",".join(STEPS))
    ap.add_argument("--workers", default="2")
    ap.add_argument("--only")
    a = ap.parse_args()
    ep, out = load(a.episode)
    for st in a.steps.split(","):
        {"tts": lambda: tts(ep, out), "timeline": lambda: timeline(ep, out),
         "render": lambda: render(ep, out, a.workers, a.only), "video": lambda: video(ep, out),
         "audio": lambda: build_audio(ep, out), "captions": lambda: captions(ep, out),
         "final": lambda: final(ep, out), "storyboard": lambda: storyboard(ep, out)}[st]()


if __name__ == "__main__":
    main()
