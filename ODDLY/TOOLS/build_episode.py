#!/usr/bin/env python3
"""Build ODDLY episode production packages from compact YAML sources.

Usage:
  python3 TOOLS/build_episode.py EPISODES_SRC/EP001.yaml [more.yaml ...]
  python3 TOOLS/build_episode.py --all

Reads LIBRARY/*.yaml, expands every scene into a self-contained JSON record
(full image prompt, animation prompt, sound cues, transition), and writes:

  EP###/episode.json                       manifest + QC result
  EP###/CHARACTERS/characters.json         approved character sheets used
  EP###/BACKGROUNDS/backgrounds.json       backgrounds + variants used
  EP###/SCENES/EP###_SC##.json             one independent file per scene
  EP###/SCENES/script.md                   human-readable scene-by-scene script
  EP###/ANIMATION/animation_jobs.json      ordered image->video jobs
  EP###/AUDIO/music_brief.json             score brief with hit points
  EP###/AUDIO/sfx_cue_sheet.json           every SFX on the absolute timeline
  EP###/EDIT/edit_decision_list.json       timeline, transitions, grade, mix
  EP###/THUMBNAIL/thumbnail.json           thumbnail prompt + overlay
  EP###/PUBLISHING/metadata.json           titles, descriptions, tags (en, pt-BR, es)
  EP###/QC/qc_report.json                  automated + editorial QC

Exits non-zero if any automated QC check fails.
"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "LIBRARY"
TRANSITIONS = {"CUT", "SMASH CUT", "MATCH CUT", "WHIP PAN", "DISSOLVE", "IRIS OUT",
               "FADE TO BLACK", "WIPE", "ZOOM THROUGH", "CUT TO END CARD"}


def load(name):
    return yaml.safe_load((LIB / name).read_text())


STYLE = load("style_bible.yaml")
CHARS = load("characters.yaml")
BGS = load("backgrounds.yaml")
PFX = load("props_fx.yaml")
PROPS, FX = PFX["props"], PFX["fx"]


def tc(seconds):
    """Seconds -> HH:MM:SS:FF at 24 fps."""
    frames = round(seconds * 24)
    f = frames % 24
    s = frames // 24
    return f"00:{s // 60:02d}:{s % 60:02d}:{f:02d}"


def split_char(ref):
    """'CHR_001:PAJAMAS' -> ('CHR_001', 'PAJAMAS')."""
    cid, _, var = ref.partition(":")
    return cid, (var or None)


def char_prompt(ref):
    cid, var = split_char(ref)
    c = CHARS[cid]
    p = c["prompt"]
    if var:
        p += f"; VARIANT {var}: {c['variants'][var]}"
    return p


def bg_parts(ref):
    bid, _, var = ref.partition("@")
    return bid, var, BGS[bid]


EXPR_LINE = re.compile(r"^(\s*expressions:\s*)\{(.+)\}\s*$", re.M)


def _quote_expressions(m):
    """Allow commas inside expression text: split only before a CHR_### key."""
    parts = re.split(r",\s*(?=CHR_\d{3}:)", m.group(2).strip())
    items = []
    for p in parts:
        k, _, v = p.partition(":")
        items.append(f"{k.strip()}: {json.dumps(v.strip())}")
    return m.group(1) + "{" + ", ".join(items) + "}"


def load_episode(path):
    return yaml.safe_load(EXPR_LINE.sub(_quote_expressions, Path(path).read_text()))


def build(src_path, errors):
    ep = load_episode(src_path)
    eid, fmt = ep["id"], ep["format"]
    spec = STYLE["formats"][fmt]
    out = ROOT / eid
    for d in ["CHARACTERS", "BACKGROUNDS", "SCENES", "ANIMATION", "AUDIO", "EDIT",
              "THUMBNAIL", "PUBLISHING", "QC"]:
        (out / d).mkdir(parents=True, exist_ok=True)

    def err(msg):
        errors.append(f"{eid}: {msg}")

    scenes, t = [], 0.0
    sfx_sheet, jobs, script = [], [], []
    used_chars, used_bgs = {}, {}

    for i, s in enumerate(ep["scenes"], 1):
        sid = f"{eid}_SC{i:02d}"
        if s.get("n") != i:
            err(f"scene numbering broken at {sid} (n={s.get('n')})")
        dur = float(s["dur"])
        bid, var, bg = bg_parts(s["bg"])
        if var and var not in bg["variants"]:
            err(f"{sid}: unknown background variant {s['bg']}")
        used_bgs.setdefault(bid, set()).add(var)

        char_refs = s.get("chars", [])
        for ref in char_refs:
            cid, cvar = split_char(ref)
            if cid not in CHARS:
                err(f"{sid}: unknown character {cid}")
                continue
            if cvar and cvar not in CHARS[cid].get("variants", {}):
                err(f"{sid}: unknown variant {ref}")
            used_chars.setdefault(cid, set()).add(cvar)
            if eid not in CHARS[cid].get("episodes", []):
                err(f"{sid}: {cid} not registered for {eid} in characters.yaml")
        for k in s.get("expressions", {}):
            if k not in [split_char(r)[0] for r in char_refs]:
                err(f"{sid}: expression given for {k} which is not in scene")
        for p in s.get("props", []):
            if p not in PROPS:
                err(f"{sid}: unknown prop {p}")
        for f in s.get("fx", []):
            if f not in FX:
                err(f"{sid}: unknown fx {f}")
        if s["transition"].split(" (")[0] not in TRANSITIONS:
            err(f"{sid}: unknown transition '{s['transition']}'")
        for at, _ in s.get("sfx", []):
            if not 0 <= float(at) < dur:
                err(f"{sid}: sfx at {at}s outside scene duration {dur}s")
        if not s.get("sfx"):
            err(f"{sid}: no sound effects")
        if re.search(r"\b(says|said|speaks|talks|narrat|voice-over|dialogue)\b",
                     s["action"] + s["key"], re.I):
            err(f"{sid}: wording implies speech")

        # ---- composed prompts -------------------------------------------------
        cast_txt = " ".join(f"[{r}] {char_prompt(r)}." for r in char_refs) or "No characters in frame."
        props_txt = " ".join(PROPS[p]["prompt"] + "." for p in s.get("props", []))
        fx_txt = " ".join(FX[f]["prompt"] + "." for f in s.get("fx", []))
        image_prompt = " ".join(x for x in [
            STYLE["image_style_prefix"],
            f"Vertical {spec['aspect_ratio']} frame, {spec['resolution']}." if fmt == "SHORT"
            else f"Horizontal {spec['aspect_ratio']} frame, {spec['resolution']}.",
            f"SHOT: {s['shot']}.",
            f"KEYFRAME: {s['key']}",
            f"CHARACTERS (match approved reference sheets exactly): {cast_txt}",
            f"SETTING [{s['bg']}]: {bg['prompt']}; {bg['variants'][var] if var else ''}.",
            f"PROPS: {props_txt}" if props_txt else "",
            f"EFFECTS: {fx_txt}" if fx_txt else "",
            f"LIGHTING & MOOD: {s['lighting']}.",
            f"EPISODE PALETTE: dominant {ep['palette']['dominant']}, accent {ep['palette']['accent']}.",
            "Keep key action inside the vertical safe area." if fmt == "SHORT" else "",
        ] if x)
        locks = "; ".join(CHARS[split_char(r)[0]]["anim_lock"] for r in char_refs)
        expr_txt = "; ".join(f"{CHARS[k]['name']}: {v}" for k, v in s.get("expressions", {}).items())
        animation_prompt = " ".join(x for x in [
            f"Animate keyframe {sid}_KEY.png into a {dur:.1f}-second shot.",
            f"MOTION: {s['motion']}",
            f"CAMERA: {s['camera']}.",
            f"FACIAL ACTING: {expr_txt}." if expr_txt else "",
            f"ON-MODEL LOCK: {locks}." if locks else "",
            STYLE["animation_style_suffix"],
        ] if x)

        sfx = [{"at_scene": float(a), "at_episode": round(t + float(a), 2),
                "timecode": tc(t + float(a)), "sound": d} for a, d in s.get("sfx", [])]
        for x in sfx:
            sfx_sheet.append({"scene_id": sid, **x})

        rec = {
            "scene_id": sid,
            "episode_id": eid,
            "scene_number": i,
            "beat": s.get("beat", ""),
            "duration_seconds": dur,
            "timecode_in": tc(t),
            "timecode_out": tc(t + dur),
            "format": {"aspect_ratio": spec["aspect_ratio"], "resolution": spec["resolution"], "fps": spec["fps"]},
            "story_action": s["action"],
            "character_references": [
                {"id": r, "name": CHARS[split_char(r)[0]]["name"],
                 "reference_sheet": f"LIBRARY/REFS/{split_char(r)[0]}{'_' + split_char(r)[1] if split_char(r)[1] else ''}_sheet.png"}
                for r in char_refs],
            "background_reference": {"id": s["bg"], "name": bg["name"],
                                     "plate": f"LIBRARY/REFS/{bid}_{var or 'BASE'}.png"},
            "props": s.get("props", []),
            "effects": s.get("fx", []),
            "image_generation": {
                "output_file": f"{sid}_KEY.png",
                "prompt": image_prompt,
                "negative_prompt": STYLE["image_negative_prompt"],
                "reference_images": [f"LIBRARY/REFS/{split_char(r)[0]}{'_' + split_char(r)[1] if split_char(r)[1] else ''}_sheet.png" for r in char_refs]
                + [f"LIBRARY/REFS/{bid}_{var or 'BASE'}.png"],
            },
            "animation": {
                "input_file": f"{sid}_KEY.png",
                "output_file": f"{sid}_ANIM.mp4",
                "duration_seconds": dur,
                "prompt": animation_prompt,
            },
            "camera_movement": s["camera"],
            "facial_expressions": s.get("expressions", {}),
            "sound_effects": sfx,
            "music": s.get("music", ""),
            "transition_out": s["transition"],
        }
        (out / "SCENES" / f"{sid}.json").write_text(json.dumps(rec, indent=2, ensure_ascii=False) + "\n")
        scenes.append(rec)
        jobs.append({"order": i, "scene_id": sid, "step_1_image": rec["image_generation"]["output_file"],
                     "step_2_video": rec["animation"]["output_file"], "duration_seconds": dur,
                     "depends_on": [c["reference_sheet"] for c in rec["character_references"]]
                     + [rec["background_reference"]["plate"]]})
        script.append(
            f"### {sid} — {s.get('beat', '')} ({dur:.1f}s, {tc(t)}–{tc(t + dur)})\n\n"
            f"**Action:** {s['action']}\n\n**Shot:** {s['shot']} · **Camera:** {s['camera']}\n\n"
            f"**Expressions:** {expr_txt or '—'}\n\n"
            f"**Sound:** " + "; ".join(f"{a}s {d}" for a, d in s.get('sfx', [])) +
            f"\n\n**Music:** {s.get('music', '')}\n\n**Transition:** {s['transition']}\n")
        t += dur

    end = STYLE["end_card"]
    runtime = round(t + end["duration"], 2)
    lo, hi = spec["runtime_seconds"]
    if not lo <= runtime <= hi:
        err(f"runtime {runtime}s outside {lo}-{hi}s")
    smin, smax = spec["scene_count"]
    if not smin <= len(scenes) <= smax:
        err(f"scene count {len(scenes)} outside {smin}-{smax}")
    if scenes[0]["duration_seconds"] > 3.5:
        err("hook scene longer than 3.5s")
    if ep["scenes"][-1]["transition"] != "CUT TO END CARD":
        err("last scene must use CUT TO END CARD")

    # ---- library extracts ----------------------------------------------------
    (out / "CHARACTERS" / "characters.json").write_text(json.dumps(
        {cid: {**CHARS[cid], "variants_used": sorted(v for v in vs if v)} for cid, vs in used_chars.items()},
        indent=2, ensure_ascii=False) + "\n")
    (out / "BACKGROUNDS" / "backgrounds.json").write_text(json.dumps(
        {bid: {**BGS[bid], "variants_used": sorted(v for v in vs if v)} for bid, vs in used_bgs.items()},
        indent=2, ensure_ascii=False) + "\n")
    (out / "ANIMATION" / "animation_jobs.json").write_text(json.dumps(
        {"episode_id": eid, "pipeline": "1) generate keyframe from image prompt + reference images, "
         "2) approve keyframe against reference sheets, 3) animate keyframe with animation prompt, "
         "4) conform to exact duration", "jobs": jobs}, indent=2) + "\n")

    # ---- audio -----------------------------------------------------------------
    music = dict(ep["music"])
    music["hit_points"] = [{"scene_id": r["scene_id"], "timecode": r["timecode_in"],
                            "at_episode": round(sum(x["duration_seconds"] for x in scenes[:r["scene_number"] - 1]), 2),
                            "cue": r["music"]} for r in scenes if r["music"]]
    music["end_card"] = {"timecode": tc(t), "cue": "Music resolves on the final chord exactly at the cut; ODDLY sting plays over 2.0s end card."}
    music["rules"] = "Original instrumental only. No vocals, no lyrics, no spoken word."
    (out / "AUDIO" / "music_brief.json").write_text(json.dumps(music, indent=2, ensure_ascii=False) + "\n")
    sfx_sheet.append({"scene_id": "ENDCARD", "at_episode": round(t, 2), "timecode": tc(t), "sound": end["sound"]})
    (out / "AUDIO" / "sfx_cue_sheet.json").write_text(json.dumps(
        {"episode_id": eid, "cues": sfx_sheet}, indent=2, ensure_ascii=False) + "\n")

    # ---- edit --------------------------------------------------------------------
    edl = {
        "episode_id": eid,
        "timeline": {"resolution": spec["resolution"], "fps": spec["fps"], "aspect_ratio": spec["aspect_ratio"],
                     "runtime_seconds": runtime},
        "events": [{"event": r["scene_number"], "clip": r["animation"]["output_file"],
                    "record_in": r["timecode_in"], "record_out": r["timecode_out"],
                    "duration_seconds": r["duration_seconds"], "transition_out": r["transition_out"]}
                   for r in scenes]
        + [{"event": len(scenes) + 1, "clip": "ENDCARD_STD.mov", "record_in": tc(t), "record_out": tc(runtime),
            "duration_seconds": end["duration"], "transition_out": "END"}],
        "transition_rules": {
            "CUT": "hard cut on the frame", "SMASH CUT": "hard cut, preceding audio cut dead 2 frames early",
            "MATCH CUT": "align matching shapes to the same screen position", "WHIP PAN": "6-frame motion-blur whip, cut hidden at blur peak",
            "DISSOLVE": "12-frame cross-dissolve centered on the cut", "IRIS OUT": "10-frame circular iris closing on subject",
            "FADE TO BLACK": "12-frame fade", "WIPE": "8-frame wipe driven by on-screen motion",
            "ZOOM THROUGH": "push into an object and cut inside it at maximum scale, 8 frames",
            "CUT TO END CARD": "hard cut on the music's final downbeat"},
        "conform": "Trim or time-stretch (max ±8%) each animated clip to its exact duration; never change scene order.",
        "color_grade": ep["edit"]["grade"],
        "mix": {
            "loudness_target": "-14 LUFS integrated, -1 dBTP true peak",
            "music_bed": "Music sits at about -20 LUFS short-term under busy SFX, rises to -14 in music-led moments.",
            "sfx_priority": "Story SFX always on top; duck music 4-6 dB for 300 ms around each key SFX hit.",
            "notes": ep["edit"].get("mix_notes", ""),
        },
        "editor_notes": ep["edit"]["notes"],
        "captions": "None. Do not add subtitles or text overlays (no dialogue exists).",
    }
    (out / "EDIT" / "edit_decision_list.json").write_text(json.dumps(edl, indent=2, ensure_ascii=False) + "\n")

    # ---- thumbnail & publishing ---------------------------------------------------
    th = ep["thumbnail"]
    th_prompt = " ".join([STYLE["image_style_prefix"], f"Vertical 9:16 thumbnail, 1080x1920. {th['prompt']}",
                          "CHARACTERS: " + " ".join(f"[{r}] {char_prompt(r)}." for r in th["chars"]),
                          f"SETTING: {BGS[th['bg'].split('@')[0]]['prompt']}.",
                          "Bold readable silhouette, high contrast, single clear focal point, leave the upper third uncluttered for an optional overlay."])
    (out / "THUMBNAIL" / "thumbnail.json").write_text(json.dumps({
        "episode_id": eid, "cover_frame": th["cover_frame"], "image_prompt": th_prompt,
        "negative_prompt": STYLE["image_negative_prompt"], "text_overlay": th["overlay"],
        "overlay_style": "Rounded hand-drawn cream lettering (#FFF3D6) with 6px dark-brown outline, added in editing, not generated.",
        "horizontal_variant": "Re-frame the same composition to 16:9 1920x1080 for feed/community posts."},
        indent=2, ensure_ascii=False) + "\n")
    pub = dict(ep["publishing"])
    pub.update({"episode_id": eid, "format": fmt, "runtime_seconds": runtime,
                "aspect_ratio": spec["aspect_ratio"], "video_file": f"ODDLY_{eid}_{fmt}.mp4",
                "category": "Film & Animation", "language": "zxx (no linguistic content)",
                "made_for_kids_note": "Content is family-friendly. The 'made for kids' declaration is a legal channel decision for the owner.",
                "end_screen": "ODDLY end card; subscribe element over last 2s on platforms that support it."})
    (out / "PUBLISHING" / "metadata.json").write_text(json.dumps(pub, indent=2, ensure_ascii=False) + "\n")

    # ---- QC ------------------------------------------------------------------
    ep_errors = [e for e in errors if e.startswith(eid + ":")]
    qc = {"episode_id": eid,
          "automated_checks": {"passed": not ep_errors, "errors": ep_errors,
                               "checked": ["scene numbering", "runtime window", "scene-count window", "hook <= 3.5s",
                                           "all character/background/prop/fx IDs exist in library",
                                           "characters registered for episode", "SFX inside scene bounds",
                                           "every scene has SFX", "valid transitions", "no speech wording",
                                           "final cut to end card"]},
          "editorial_review": ep["qc"],
          "status": "APPROVED_FOR_PRODUCTION" if not ep_errors else "BLOCKED"}
    (out / "QC" / "qc_report.json").write_text(json.dumps(qc, indent=2, ensure_ascii=False) + "\n")

    manifest = {k: ep[k] for k in ["id", "concept", "title", "format", "category", "logline", "palette"]}
    manifest.update({"runtime_seconds": runtime, "scene_count": len(scenes),
                     "characters": sorted(used_chars), "backgrounds": sorted(used_bgs),
                     "files": sorted(str(p.relative_to(out)) for p in out.rglob("*") if p.is_file()),
                     "qc_status": qc["status"]})
    (out / "episode.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    hdr = (f"# {eid} — {ep['title']}\n\n*{ep['logline']}*\n\n"
           f"Format: {fmt} {spec['aspect_ratio']} · Runtime {runtime}s ({len(scenes)} scenes + 2.0s end card) · "
           f"Category: {ep['category']} · Music: {ep['music']['title']}\n\n")
    (out / "SCENES" / "script.md").write_text(hdr + "\n".join(script) +
                                              f"\n### ENDCARD ({end['duration']}s)\n\n{end['description']}\n")
    return eid, runtime, len(scenes), qc["status"]


def main():
    args = sys.argv[1:]
    paths = sorted((ROOT / "EPISODES_SRC").glob("EP*.yaml")) if args == ["--all"] else [Path(a) for a in args]
    errors = []
    for p in paths:
        eid, runtime, n, status = build(p, errors)
        print(f"{eid}: {n} scenes, {runtime:.1f}s -> {status}")
    if errors:
        print("\nQC ERRORS:")
        for e in errors:
            print(" -", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
