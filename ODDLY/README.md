# ODDLY — A WORLD FULL OF SURPRISES.

Production repository for the ODDLY 2D animated series. No narration, no dialogue, no lyrics: music and sound effects only.

Start here: `SEASON_01_INDEX.md` (episodes, release order, production steps).

## Layout
- `LIBRARY/` — permanent, approved assets shared by all episodes
  - `style_bible.yaml` style prompt, negative prompt, formats, end card
  - `characters.yaml` character database (CHR_###), `backgrounds.yaml` (BG_###@VARIANT), `props_fx.yaml` (PRP_###, FX_###)
  - `reference_jobs.json` reference sheets and background plates to generate and approve first
  - `asset_reuse.json` which assets each episode uses
- `EPISODES_SRC/EP###.yaml` — authored episode source (edit these, then rebuild)
- `EP###/` — generated production package
  - `SCENES/` one self-contained JSON per scene + `script.md`
  - `CHARACTERS/`, `BACKGROUNDS/` assets used
  - `ANIMATION/animation_jobs.json` ordered image -> video jobs
  - `AUDIO/music_brief.json`, `AUDIO/sfx_cue_sheet.json` (absolute timecodes)
  - `EDIT/edit_decision_list.json` timeline, transitions, grade, mix
  - `THUMBNAIL/thumbnail.json`, `PUBLISHING/metadata.json` (en, pt-BR, es)
  - `QC/qc_report.json` automated + editorial QC
- `DEVELOPMENT/` concept registry and rankings
- `TOOLS/` build scripts

## Rebuild
    python3 TOOLS/build_episode.py --all   # expand sources + automated QC (non-zero exit on failure)
    python3 TOOLS/build_index.py           # reference jobs, reuse report, season index
    python3 TOOLS/rank_concepts.py DEVELOPMENT/CONCEPTS_001-050.json DEVELOPMENT 20
