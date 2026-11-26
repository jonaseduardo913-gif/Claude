#!/usr/bin/env python3
"""Build LIBRARY/reference_jobs.json, LIBRARY/asset_reuse.json and SEASON_01_INDEX.{json,md}."""
import json
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "LIBRARY"
style = yaml.safe_load((LIB / "style_bible.yaml").read_text())
chars = yaml.safe_load((LIB / "characters.yaml").read_text())
bgs = yaml.safe_load((LIB / "backgrounds.yaml").read_text())

episodes = [json.loads(p.read_text()) for p in sorted(ROOT.glob("EP*/episode.json"))]

# --- what each episode actually uses (from built scene files) ---------------
char_use, bg_use = defaultdict(set), defaultdict(set)
for ep in episodes:
    for sp in sorted((ROOT / ep["id"] / "SCENES").glob("*_SC*.json")):
        s = json.loads(sp.read_text())
        for c in s["character_references"]:
            char_use[c["id"].split(":")[0]].add(ep["id"])
        bg_use[s["background_reference"]["id"].split("@")[0]].add(ep["id"])

# --- reference generation jobs ------------------------------------------------
jobs = []
for cid, c in chars.items():
    refs = [(f"{cid}_sheet.png", c["prompt"])]
    for v, desc in c.get("variants", {}).items():
        refs.append((f"{cid}_{v}_sheet.png", f"{c['prompt']}; VARIANT {v}: {desc}"))
    for fname, desc in refs:
        jobs.append({"file": f"LIBRARY/REFS/{fname}", "type": "character_sheet", "id": cid,
                     "prompt": f"{style['image_style_prefix']} Character model sheet on a plain warm-white background: "
                               f"turnaround (front, three-quarter, side, back) plus an expression row ({', '.join(c['expressions'])}). "
                               f"{desc}. Color swatches of {json.dumps(c['palette'])} along the bottom edge as plain color chips. "
                               f"Proportions: {c['proportions']}",
                     "negative_prompt": style["image_negative_prompt"],
                     "requirements": c["reference_requirements"],
                     "approval": "Art director approves before any scene using it is generated; then the sheet is locked."})
for bid, b in bgs.items():
    for v, desc in b["variants"].items():
        jobs.append({"file": f"LIBRARY/REFS/{bid}_{v}.png", "type": "background_plate", "id": f"{bid}@{v}",
                     "prompt": f"{style['image_style_prefix']} Empty background plate, no characters, vertical 9:16 1080x1920 "
                               f"with extra painted margin on all sides for camera moves. {b['prompt']}; {desc}.",
                     "negative_prompt": style["image_negative_prompt"],
                     "used_by": sorted(bg_use.get(bid, []))})
(LIB / "reference_jobs.json").write_text(json.dumps(
    {"note": "Generate and approve these BEFORE any scene keyframe. Scene files reference these paths.",
     "count": len(jobs), "jobs": jobs}, indent=2, ensure_ascii=False) + "\n")

# --- reuse report ----------------------------------------------------------------
reuse = {
    "characters": {cid: {"name": chars[cid]["name"], "episodes": sorted(e)} for cid, e in sorted(char_use.items())},
    "backgrounds": {bid: {"name": bgs[bid]["name"], "episodes": sorted(e)} for bid, e in sorted(bg_use.items())},
}
reuse["summary"] = {
    "characters_used_in_2plus_episodes": [k for k, v in reuse["characters"].items() if len(v["episodes"]) > 1],
    "backgrounds_used_in_2plus_episodes": [k for k, v in reuse["backgrounds"].items() if len(v["episodes"]) > 1],
    "scene_keyframes": sum(ep["scene_count"] for ep in episodes),
    "unique_reference_assets": len(jobs),
}
(LIB / "asset_reuse.json").write_text(json.dumps(reuse, indent=2, ensure_ascii=False) + "\n")

# --- season index -----------------------------------------------------------------
# Release order spaces out similar twists (star endings EP004/EP008, scale reveals EP001/EP009)
# and alternates THISTLEDOWN / BRASSPORT and comedy / emotion.
release = ["EP003", "EP001", "EP006", "EP010", "EP004", "EP002", "EP007", "EP005", "EP009", "EP008"]
by_id = {e["id"]: e for e in episodes}
rows = []
for i, eid in enumerate(release, 1):
    e = by_id[eid]
    pub = json.loads((ROOT / eid / "PUBLISHING" / "metadata.json").read_text())
    rows.append({"release_slot": i, "id": eid, "title": e["title"], "category": e["category"],
                 "runtime_seconds": e["runtime_seconds"], "scenes": e["scene_count"],
                 "qc_status": e["qc_status"], "title_en": pub["title_en"]})
(ROOT / "SEASON_01_INDEX.json").write_text(json.dumps({"season": 1, "format": "SHORT", "episodes": rows,
    "release_order_rationale": "Opens with the most sound-driven gag (EP003); keeps the two star endings (EP004, EP008) "
                               "five slots apart and the two scale reveals (EP001, EP009) seven slots apart; alternates "
                               "comedy and emotion."}, indent=2, ensure_ascii=False) + "\n")
md = ["# ODDLY — Season 1 Shorts", "",
      f"{len(rows)} episodes · {sum(r['scenes'] for r in rows)} scenes · "
      f"{sum(r['runtime_seconds'] for r in rows):.1f}s total · {len(jobs)} reference assets to generate first", "",
      "| Slot | ID | Title | Category | Runtime | Scenes | QC |", "|---|---|---|---|---|---|---|"]
md += [f"| {r['release_slot']} | {r['id']} | {r['title']} | {r['category']} | {r['runtime_seconds']}s | {r['scenes']} | {r['qc_status']} |" for r in rows]
md += ["", "## Production order", "",
       "1. Generate and approve every file in `LIBRARY/reference_jobs.json` (character sheets, background plates).",
       "2. For each episode, run `ANIMATION/animation_jobs.json` in order: keyframe from `image_generation.prompt` + reference images, approve, then animate with `animation.prompt`.",
       "3. Score from `AUDIO/music_brief.json`; place SFX from `AUDIO/sfx_cue_sheet.json` (absolute timecodes).",
       "4. Conform with `EDIT/edit_decision_list.json`, append `ENDCARD_STD`, mix to -14 LUFS.",
       "5. Thumbnail from `THUMBNAIL/thumbnail.json`; upload with `PUBLISHING/metadata.json`.",
       "", "Readable scripts: `EP###/SCENES/script.md`."]
(ROOT / "SEASON_01_INDEX.md").write_text("\n".join(md) + "\n")
print(json.dumps(reuse["summary"], indent=1))
