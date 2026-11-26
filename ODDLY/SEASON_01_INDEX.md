# ODDLY — Season 1 Shorts

10 episodes · 110 scenes · 502.5s total · 63 reference assets to generate first

| Slot | ID | Title | Category | Runtime | Scenes | QC |
|---|---|---|---|---|---|---|
| 1 | EP003 | The Bee Who Lost Its Buzz | Funny situations | 50.5s | 11 | APPROVED_FOR_PRODUCTION |
| 2 | EP001 | The Giant's Contact Lens | Unexpected encounters | 50.5s | 11 | APPROVED_FOR_PRODUCTION |
| 3 | EP006 | Sock Migration | Funny situations | 51.0s | 11 | APPROVED_FOR_PRODUCTION |
| 4 | EP010 | The Tidy Monster | Strange creatures | 49.5s | 11 | APPROVED_FOR_PRODUCTION |
| 5 | EP004 | The Night Baker | Magical worlds | 50.5s | 11 | APPROVED_FOR_PRODUCTION |
| 6 | EP002 | The Uphill Boulder | Strange creatures | 51.0s | 11 | APPROVED_FOR_PRODUCTION |
| 7 | EP007 | Canned Weather | Impossible experiments | 49.5s | 11 | APPROVED_FOR_PRODUCTION |
| 8 | EP005 | The Moon's Missing Button | Fantasy adventures | 50.5s | 11 | APPROVED_FOR_PRODUCTION |
| 9 | EP009 | Ocean in a Jar | Impossible experiments | 49.5s | 11 | APPROVED_FOR_PRODUCTION |
| 10 | EP008 | The Dimmest Firefly | Emotional adventures | 50.0s | 11 | APPROVED_FOR_PRODUCTION |

## Production order

1. Generate and approve every file in `LIBRARY/reference_jobs.json` (character sheets, background plates).
2. For each episode, run `ANIMATION/animation_jobs.json` in order: keyframe from `image_generation.prompt` + reference images, approve, then animate with `animation.prompt`.
3. Score from `AUDIO/music_brief.json`; place SFX from `AUDIO/sfx_cue_sheet.json` (absolute timecodes).
4. Conform with `EDIT/edit_decision_list.json`, append `ENDCARD_STD`, mix to -14 LUFS.
5. Thumbnail from `THUMBNAIL/thumbnail.json`; upload with `PUBLISHING/metadata.json`.

Readable scripts: `EP###/SCENES/script.md`.
