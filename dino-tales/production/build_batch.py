"""Builds the DINO CONTOS production package (Markdown) from structured episode data.
Usage: python3 production/build_batch.py   -> production/batch-01/*.md + narration/*.txt
The narration script (section B) is assembled from the per-scene passages, so the
scene plan always covers the full narration with nothing missing or repeated."""
import os, re, importlib, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bible import STYLE, NEG, ANIM_RULES, CHARS, NEW, ALL

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'batch-01')
EPS = ['ep01_moonflower', 'ep02_first_snow', 'ep03_waterfall', 'ep04_bico_flies', 'ep05_gift']
WPS = 2.1  # narrator pace (words per second: slow, warm storybook delivery with pauses)

def words(s): return len(re.findall(r"[A-Za-z']+", s))
def mmss(s): s = int(round(s)); return f"{s // 60}:{s % 60:02d}"
def scene_dur(sc): return round(words(sc['narr']) / WPS + sc.get('pad', 3.0))
def cast_full(keys): return ' '.join(f"{ALL[k]['full']}." for k in keys)

def image_prompt(sc):
    p = [STYLE + '.', f"Scene: {sc['img']}"]
    if sc['cast']: p.append('Characters (keep exactly this design): ' + cast_full(sc['cast']))
    p.append(f"Environment and lighting: {sc['light']}")
    p.append(f"Camera and framing: {sc['frame']}")
    p.append(NEG)
    return '\n'.join(p)

def anim_prompt(sc, prev, nxt):
    p = [f"Animate this image as a {scene_dur(sc)}-second shot of a 3D cinematic children's animated film.",
         f"Action: {sc['anim']}"]
    if sc['cast']: p.append('Characters on screen: ' + '; '.join(ALL[k]['short'] for k in sc['cast']) + '.')
    p.append(f"Environment motion: {sc['envmove']}")
    p.append(f"Camera: {sc['cammove']}")
    p.append(f"Pacing: {sc.get('speed', 'gentle, unhurried, smooth')}.")
    cont = []
    if prev: cont.append(f"continues directly from the previous shot ({prev['t']})")
    if nxt: cont.append(f"ends on a pose that leads into the next shot ({nxt['t']})")
    if cont: p.append('Continuity: ' + ' and '.join(cont) + f". Transition: {sc['trans']}")
    if scene_dur(sc) > 10: p.append(f"Long shot: if your video tool limits clip length, generate it as {-(-scene_dur(sc) // 8)} consecutive clips of about 8 seconds with this same prompt (each starting from the last frame of the previous one) and join them in the editor.")
    p.append(ANIM_RULES)
    return '\n'.join(p)

def sheet():
    L = ['# DINO CONTOS — Character Reference Sheet & Style Guide', '',
         'This sheet is permanent. Every prompt in every episode repeats these exact descriptions. Never change colors, clothing, proportions or facial features.', '',
         '## Global visual style', '', f'> {STYLE}.', '', f'Every image prompt ends with: *{NEG}*', '',
         'Animation rule used in every video prompt:', '', f'> {ANIM_RULES}', '',
         '## Size chart (relative to Tuca = 1.0)', '', '| Character | Height |', '|---|---|']
    for c in ALL.values(): L.append(f"| {c['name']} | {c['size']} |")
    for title, group in (('Main and recurring characters', CHARS), ('New characters introduced in this batch', NEW)):
        L += ['', f'## {title}']
        for c in group.values():
            L += ['', f"### {c['name']} — {c['role']}", '',
                  f"- **Physical appearance:** {c['appearance']}", f"- **Colors:** {c['colors']}", f"- **Proportions:** {c['proportions']}",
                  f"- **Clothing / accessories:** {c['clothing']}", f"- **Facial features:** {c['face']}", f"- **Personality:** {c['personality']}",
                  f"- **Size:** {c['size']}", '', '**Prompt description (copy exactly):**', '', '```', c['full'], '```']
    return '\n'.join(L) + '\n'

def episode(E):
    S = E['scenes']; total = sum(scene_dur(s) for s in S)
    narration = '\n\n'.join(s['narr'] for s in S)
    L = [f"# Episode {E['num']} — {E['title_en']}", f"*{E['title_pt']}*", '',
         '## A. Episode Information', '',
         f"- **Episode number:** {E['num']}", f"- **English title:** {E['title_en']}", f"- **Portuguese title:** {E['title_pt']}",
         f"- **Main theme:** {E['theme']}", f"- **Moral lesson:** {E['moral']}",
         f"- **Estimated duration:** {mmss(total)} ({len(S)} scenes, narration {words(narration)} words)",
         f"- **Setting:** {E['setting']}", f"- **Characters:** {', '.join(ALL[k]['name'] for k in E['cast'])}", '',
         f"**Synopsis:** {E['synopsis']}", '',
         '## B. Complete Story and Narration', '', '*(Single narrator. Ready for voice recording.)*', '', narration, '',
         '## C. Scene-by-Scene Production Plan', '']
    t = 0
    for i, s in enumerate(S, 1):
        d = scene_dur(s)
        L += [f"### Scene {i} — {s['t']}", '',
              f"**Duration:** ~{d} s ({mmss(t)}–{mmss(t + d)})", '',
              '**Narration:**', '', '> ' + s['narr'].replace('\n\n', '\n>\n> '), '',
              f"**Visual description:** {s['visual']}", '',
              f"**Character actions and expressions:** {s['action']}", '',
              f"**Camera:** {s['camera']}", '',
              f"**Environment and lighting:** {s['light']}", '',
              f"**Sound:** Music — {s['music']}. Ambience — {s['amb']}. SFX — {s['fx']}.", '',
              f"**Transition:** {s['trans']}", '']
        t += d
    L += ['## D. Image Generation Prompts', '']
    for i, s in enumerate(S, 1): L += [f"### Scene {i} — {s['t']}", '', '```', image_prompt(s), '```', '']
    L += ['## E. Video Animation Prompts', '']
    for i, s in enumerate(S, 1): L += [f"### Scene {i} — {s['t']}", '', '```', anim_prompt(s, S[i - 2] if i > 1 else None, S[i] if i < len(S) else None), '```', '']
    L += ['## F. Sound Design', '', '| Scene | Background music | Environmental sounds | Key sound effects | Silence / emphasis |', '|---|---|---|---|---|']
    for i, s in enumerate(S, 1): L.append(f"| {i}. {s['t']} | {s['music']} | {s['amb']} | {s['fx']} | {s['quiet']} |")
    Y = E['yt']
    L += ['', '## G. YouTube Publishing Package', '',
          f"**SEO title:** {Y['title']}", '', '**Description:**', '', Y['desc'], '',
          f"**Hashtags:** {Y['tags']}", '', f"**Thumbnail concept:** {Y['thumb']}", '', '**Thumbnail image prompt:**', '', '```',
          '\n'.join([STYLE + ', bold eye-catching YouTube thumbnail composition with strong contrast and a clear focal point.',
                     f"Scene: {Y['thumb_img']}", 'Characters (keep exactly this design): ' + cast_full(Y['thumb_cast']),
                     'Leave clean empty space on the left third for a title to be added later in an editor.', NEG]),
          '```', '', f"**Pinned comment:** {Y['pinned']}", '']
    return '\n'.join(L), narration, total

def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.join(OUT, 'narration'), exist_ok=True)
    open(os.path.join(OUT, '00-character-sheet.md'), 'w').write(sheet())
    idx = ['# DINO CONTOS — Production Batch 01', '', 'Five complete episodes. Start with the character sheet.', '',
           '- [Character Reference Sheet & Style Guide](00-character-sheet.md)', '', '## Episode concepts', '',
           '| # | Title | Setting | Central conflict | Lesson | Duration |', '|---|---|---|---|---|---|']
    rows = []
    for name in EPS:
        E = importlib.import_module(name).EP
        for sc in E['scenes']: sc['narr'] = re.sub(r'([.!?])([A-Z])', r'\1 \2', sc['narr'])
        md, narr, total = episode(E)
        slug = unicodedata.normalize('NFKD', E['title_en']).encode('ascii', 'ignore').decode().lower().replace("'s", 's')
        fn = f"{E['num']:02d}-{re.sub(r'[^a-z0-9]+', '-', slug).strip('-')}"
        open(os.path.join(OUT, fn + '.md'), 'w').write(md)
        open(os.path.join(OUT, 'narration', fn + '.txt'), 'w').write(f"{E['title_en']}\n\n{narr}\n")
        idx.append(f"| {E['num']} | [{E['title_en']}]({fn}.md) | {E['setting']} | {E['conflict']} | {E['moral']} | {mmss(total)} |")
        rows.append((E['num'], E['title_en'], words(narr), mmss(total), len(E['scenes'])))
    idx += ['', 'Narration-only scripts for voice recording are in `narration/`.']
    open(os.path.join(OUT, 'README.md'), 'w').write('\n'.join(idx) + '\n')
    for r in rows: print(*r)

if __name__ == '__main__':
    main()
