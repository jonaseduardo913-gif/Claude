#!/usr/bin/env python3
"""Validate an episode before/after production.

  python3 tools/validate.py <episode_id>          # script checks (before rendering)
  python3 tools/validate.py <episode_id> --final  # also checks the rendered MP4

Exit code 1 if any ERROR.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
from produce import XFADE  # noqa: E402

SFX_TYPES = {"motor_hum", "wind", "rope_creak", "shimmer", "governor_spin", "governor_trip", "wedge_grip", "buffer", "elevator_ding",
             "riser", "ocean", "underwater", "rumble", "conveyor", "hydraulic", "rock_break", "train_pass", "whoosh_in", "key_slide", "pin_clicks", "cut_reveal", "ui_tick", "spring", "blocked", "laser_draw", "key_seat",
             "align_chime", "turn", "clunk", "error", "swarm", "impact", "explode", "assemble", "outro"}
WPS = 3.6  # approx narration speed (words / second) of the pt-BR voice (measured)


def main():
    ep_id = sys.argv[1]
    final = "--final" in sys.argv
    d = ROOT / "episodes" / ep_id
    errs, warns = [], []
    E = errs.append
    W = warns.append
    try:
        ep = json.loads((d / "episode.json").read_text())
    except Exception as e:
        print("ERROR episode.json:", e); sys.exit(1)
    if not (d / "scene.js").exists():
        E("scene.js missing")
    js = (d / "scene.js").read_text() if (d / "scene.js").exists() else ""

    for k in ["id", "title", "language", "format", "research", "scenes"]:
        if k not in ep: E(f"missing key '{k}'")
    if "voice" not in ep and "narration_audio" not in ep: E("need 'voice' (TTS) or 'narration_audio' (provided file)")
    r = ep.get("research", {})
    if len(r.get("sources", [])) < 2: E("research.sources needs at least 2 sources")
    if len(r.get("facts_checked", [])) < 3: E("research.facts_checked needs at least 3 verified facts")
    fmt = ep.get("format", {})
    dmin, dmax = fmt.get("duration_range", [45, 60])
    smin, smax = fmt.get("scene_seconds", [3, 7])
    external = bool(ep.get("narration_audio"))

    sc = ep.get("scenes", [])
    if not 8 <= len(sc) <= 16 and not ep.get("narration_audio"): W(f"{len(sc)} scenes (typical 9-14 for 45-60s)")
    est = 0
    ids = set()
    nar_f = ROOT / "output" / ep_id / "narration.json"
    nar = json.loads(nar_f.read_text()) if nar_f.exists() else {}
    for i, s in enumerate(sc):
        sid = s.get("id", f"#{i}")
        if sid in ids: E(f"duplicate scene id {sid}")
        ids.add(sid)
        for k in ["narration", "storyboard", "camera", "transition", "sfx", "music"]:
            if k not in s: E(f"{sid}: missing '{k}'")
        words = len(s.get("narration", "").split())
        spoken = nar[sid]["seconds"] if (sid in nar and isinstance(nar.get(sid), dict)) else words / WPS
        sec = max(s.get("min_seconds", 3), spoken + 0.6)
        est += sec
        if sec > smax and not external: E(f"{sid}: ~{sec:.1f}s of narration (> {smax}s): split the scene or shorten")
        if external and not s.get("starts_with"): E(f"{sid}: 'starts_with' required with external narration")
        if s.get("transition") not in XFADE: E(f"{sid}: unknown transition '{s.get('transition')}' (use {sorted(XFADE)})")
        for ev in s.get("sfx", []):
            if ev.get("type") not in SFX_TYPES: E(f"{sid}: unknown sfx '{ev.get('type')}'")
            if not 0 <= ev.get("u", -1) <= 1: E(f"{sid}: sfx u must be 0..1")
        if not re.search(rf"\b{re.escape(sid)}\s*\(", js): E(f"{sid}: no animation function in scene.js")
        if re.search(r"\d", s.get("narration", "")): W(f"{sid}: digits in narration - write numbers as words for the TTS")
    if sc and sc[0].get("min_seconds", 3) > 4.5: W("hook scene longer than 4.5s")
    if sc and sc[-1].get("transition") != "none": W("last scene should use transition 'none'")
    if not external and not dmin <= est <= dmax + 2: W(f"estimated runtime {est:.1f}s (target {dmin}-{dmax}s)")

    tl_f = ROOT / "output" / ep_id / "timeline.json"
    if tl_f.exists():
        tl = json.loads(tl_f.read_text())
        if not dmin <= tl["total_seconds"] <= dmax: E(f"timeline runtime {tl['total_seconds']}s outside {dmin}-{dmax}s")
        for s in tl["scenes"]:
            if not smin <= s["duration"] <= smax + 0.01: E(f"{s['id']}: duration {s['duration']}s outside {smin}-{smax}s")
        errs.extend(tl.get("warnings", []))

    if final:
        mp4 = ROOT / "output" / ep_id / f"{ep_id}.mp4"
        if not mp4.exists():
            E("final MP4 missing")
        else:
            info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height",
                                              "-of", "json", str(mp4)], capture_output=True, text=True).stdout)
            v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
            if (v["width"], v["height"]) != (1080, 1920): E(f"video is {v['width']}x{v['height']}, expected 1080x1920")
            if not any(s["codec_type"] == "audio" for s in info["streams"]): E("no audio stream")
            dur = float(info["format"]["duration"])
            if not dmin <= dur <= dmax + 0.5: E(f"final duration {dur:.2f}s outside {dmin}-{dmax}s")
            lufs = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(mp4), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
            m = re.findall(r"I:\s+(-?[\d\.]+) LUFS", lufs)
            if m and not -16 <= float(m[-1]) <= -12: W(f"loudness {m[-1]} LUFS (target -14)")
            print(f"final: {v['width']}x{v['height']} {dur:.2f}s {m[-1] if m else '?'} LUFS")

    for w in warns: print("WARN ", w)
    for e in errs: print("ERROR", e)
    print("OK" if not errs else f"{len(errs)} error(s)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
