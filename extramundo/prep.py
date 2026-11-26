"""storyboard.json + build/words.json  ->  build/timeline.json (+ video frame plates)

Resolves every shot to frame-exact times anchored on narration words, extracts the
needed trailer ranges as vertical 4K bands, builds caption cards with the colour code,
and lists the sound-effect events for the mixer.
"""
import json, os, re, subprocess, shutil, sys

FPS = 30
SB = json.load(open('storyboard.json'))
WD = json.load(open('build/words.json'))
LEAD = SB.get('lead', 0.0)
words = [dict(w, s=w['s'] + LEAD, e=w['e'] + LEAD) for w in WD['words']]
VO_DUR = WD['duration'] + LEAD
MEDIA = 'input/media'
VIDEOS = {'cira': f'{MEDIA}/cira_portrait.webm'}   # short names; others: input/media/videos/<name>.mp4
BAND_FRAC = 1700 / 2160               # vertical band kept from each frame (relative to height)
_probe = {}
def video_info(name):
    path = VIDEOS.get(name) or next((f'{MEDIA}/videos/{f}' for f in sorted(os.listdir(f'{MEDIA}/videos')) if os.path.splitext(f)[0] == name), f'{MEDIA}/videos/{name}.mp4')
    if path not in _probe:
        out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout
        w, h = map(int, out.strip().split(',')[:2]); _probe[path] = (path, w, h)
    return _probe[path]

def snap(t): return round(t * FPS) / FPS
def wstart(i): return snap(max(0.0, words[i]['s'] - 2 / FPS))

def img_size(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout
    w, h = out.strip().split(',')[:2]; return int(w), int(h)

shots = SB['shots']
END_T0 = snap(VO_DUR + 0.12)
TOTAL = snap(END_T0 + SB['end']['hold'])
timeline = {'fps': FPS, 'duration': TOTAL, 'voDuration': VO_DUR, 'shots': [], 'cards': [], 'sfx': []}

# ---------------- shots ----------------
os.makedirs('build/plates', exist_ok=True)
for k, s in enumerate(shots):
    t0 = (snap(LEAD) if LEAD else 0.0) if k == 0 else wstart(s['at'])
    t1 = wstart(shots[k + 1]['at']) if k + 1 < len(shots) else END_T0
    sh = {'t0': t0, 't1': t1, 'cam': s.get('cam', {'from': {'cx': .5, 'cy': .5, 'z': 1}, 'to': {'cx': .5, 'cy': .5, 'z': 1}}), 'trans': s.get('trans', 'cut'), 'overlays': [], 'fx': s.get('fx', []), 'filter': s.get('filter'), 'fit': s.get('fit'), 'bandY': s.get('bandY')}
    src = s['src']
    if src.startswith('img:') and '|' in src:      # alternatives: first one that exists
        for alt in src[4:].split('|'):
            sb_, k_ = (alt.rsplit('/', 1) if '/' in alt else ('', alt)); bdir = f'{MEDIA}/{sb_}'.rstrip('/')
            if any(os.path.splitext(f)[0] == k_ for f in os.listdir(bdir)): src = 'img:' + alt; break
        if src.startswith('img:') and src.endswith('|') is False and alt != src[4:]: pass
        if 'ov/' in src: s.setdefault('fit', 'blurfill'); sh['fit'] = s['fit']
    if src.startswith('img:'):
        sub, key = (src[4:].rsplit('/', 1) + [''])[:2] if '/' in src[4:] else ('', src[4:]); base = f'{MEDIA}/{sub}'.rstrip('/')
        path = next((f'{base}/{f}' for f in sorted(os.listdir(base)) if os.path.splitext(f)[0] == key), None)
        if not path: print('MISSING', src); raise SystemExit(1)
        w, h = img_size(path)
        sh['src'] = {'type': 'still', 'path': path, 'w': w, 'h': h}
    elif src.startswith('anim:'):
        sh['src'] = {'type': 'anim', 'name': src[5:], 'w': 1080, 'h': 1920}
        if 'map' in s: sh['src']['map'] = s['map']
        if 'marks' in s: sh['src']['marks'] = {k: (wstart(v) - t0) / (t1 - t0) for k, v in s['marks'].items()}
        if 'collapse_word' in s: sh['collapseAt'] = wstart(s['collapse_word'])
    elif src.startswith('compare:'):
        a, b = src[8:].split(','); pa, pb = [next((f'{MEDIA}/{f}' for f in sorted(os.listdir(MEDIA)) if os.path.splitext(f)[0] == k), f'{MEDIA}/night.jpg') for k in (a, b)]
        sh['src'] = {'type': 'compare', 'a': pa, 'b': pb, 'la': s.get('labels', ['', ''])[0], 'lb': s.get('labels', ['', ''])[1], 'w': 1080, 'h': 1920}
    else:  # video clip "name:seconds" -> vertical band of frames
        name, start = src.rsplit(':', 1); start = float(start); speed = s.get('speed', 1.0)
        vpath, SRC_W, SRC_H = video_info(name); BAND_W = SRC_W if s.get('fit') == 'blurfill' else min(SRC_W, int(SRC_H * BAND_FRAC) // 2 * 2)
        dur = (t1 - t0 + 0.25) * speed
        cxs = [s['cam']['from']['cx'], s['cam']['to']['cx']]
        bx0 = int(min(max(sum(cxs) / 2 * SRC_W - BAND_W / 2, 0), SRC_W - BAND_W)) // 2 * 2
        d = f'build/plates/shot{k:02d}'
        stamp = f'v3|{vpath}|{start}|{dur:.3f}|{bx0}|{speed}'
        if not (os.path.exists(d + '/.stamp') and open(d + '/.stamp').read() == stamp):
            shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{start}', '-t', f'{dur:.3f}', '-i', vpath,
                            '-vf', f'crop={BAND_W}:{SRC_H}:{bx0}:0' + (f',setpts=PTS/{speed},framerate=fps={FPS}' if speed < 1 else ''),
                            '-q:v', '3', '-start_number', '0', f'{d}/%04d.jpg'], check=True)
            open(d + '/.stamp', 'w').write(stamp)
        n = len([f for f in os.listdir(d) if f.endswith('.jpg')])
        sh['src'] = {'type': 'clip', 'dir': d, 'count': n, 'speed': 1.0, 'w': BAND_W, 'h': SRC_H, 'bx0': bx0, 'srcW': SRC_W}
    for o in s.get('overlays', []):
        o = dict(o)
        if 'until' in o: o['t1'] = wstart(o['until'])
        if 'word' in o: o['t'] = wstart(o['word']) + 2 / FPS
        else: o['t'] = snap(t0 + o.get('at', 0.0))
        sh['overlays'].append(o)
    timeline['shots'].append(sh)

    # sound effects for transitions / overlays
    tr = sh['trans']
    if tr == 'zoomblur': timeline['sfx'].append({'t': t0 - 0.18, 'kind': 'whoosh'})
    if tr == 'glitch': timeline['sfx'].append({'t': t0 - 0.05, 'kind': 'glitch'})
    if tr == 'dip': timeline['sfx'].append({'t': t0 - 0.1, 'kind': 'sub'})
    if tr == 'xfade': timeline['sfx'].append({'t': t0 - 0.25, 'kind': 'swell'})
    if s.get('cam') and s['cam']['from']['z'] > s['cam']['to']['z'] * 1.6: timeline['sfx'].append({'t': t0, 'kind': 'whooshlong'})
    for o in sh['overlays']:
        if o['type'] in ('arrow', 'ring'): timeline['sfx'].append({'t': o['t'], 'kind': 'tick'})
        if o['type'] in ('bigtag', 'pause', 'bigtext', 'pin'): timeline['sfx'].append({'t': o['t'], 'kind': 'impact' if o.get('style') == 'slam' else 'hit'})
        if o['type'] == 'loc': timeline['sfx'].append({'t': o['t'] + 0.05, 'kind': 'blip'})

# ---------------- headline + stamp ----------------
hl = SB['headline']
timeline['headline'] = {'lines': hl['lines'], 't0': snap(LEAD), 't1': snap(words[hl['until_word']]['e'] + 0.1)}
timeline['stamp'] = {'t': SB['stamp']['t']} if SB.get('stamp') else None
if SB.get('stamp'): timeline['sfx'].append({'t': SB['stamp']['t'], 'kind': 'stamp'})
timeline['lead'] = LEAD
timeline['music'] = [{'t': (wstart(m['word']) if 'word' in m else m['t']), 'level': m['level']} for m in SB.get('music', [])]
for e in SB.get('sfx', []): timeline['sfx'].append({'t': wstart(e['word']) if 'word' in e else e['t'], 'kind': e['kind'], **({'dur': e['dur']} if 'dur' in e else {})})
timeline['end'] = {'t0': END_T0, 'trans': SB['end']['trans'], 'fade': SB['end'].get('fade', 0)}
timeline['epic'] = wstart(SB['epic_word']) if 'epic_word' in SB else None
timeline['sfx'].append({'t': END_T0 - 0.05, 'kind': 'endhit'})

# ---------------- caption cards ----------------
KW = {c: set(v) for c, v in SB['keywords'].items()}
clean = lambda w: re.sub(r"[^\w'’-]|_", '', w.upper().replace('…', '')).replace('’', "'")
toks = []
i = 0
while i < len(words):
    w = words[i]; txt = clean(w['w'])
    end_sentence = bool(re.search(r'[.…!?:]$', w['w'])) or w['w'].endswith('…')
    comma = w['w'].endswith(',')
    if txt == 'VICE' and i + 1 < len(words) and clean(words[i + 1]['w']) == 'CITY':
        nxt = words[i + 1]
        toks.append({'text': 'VICE CITY', 's': w['s'], 'e': nxt['e'], 'stop': bool(re.search(r'[.…,:]$', nxt['w'])), 'color': 'cyan'}); i += 2; continue
    color = next((c for c, ks in KW.items() if txt in ks), None)
    toks.append({'text': txt, 's': w['s'], 'e': w['e'], 'stop': end_sentence or comma, 'color': color}); i += 1

cards = []
SHORT = {'O', 'E', 'DE', 'DO', 'DA', 'NO', 'NA', 'UM', 'UMA', 'QUE', 'SE', 'EM', 'HÁ', 'POR', 'AS', 'OS', 'À', 'AO', 'DOS', 'DAS', 'SUA', 'SUAS', 'MAS', 'ESSE', 'ESSES', 'MAIS', 'NOS', 'É', 'ONDE', 'COMO', 'PARA', 'A', 'THE', 'OF', 'TO', 'IS', 'ON', 'BY', 'AND', 'BUT', 'IT', 'ITS', "IT'S", 'SO', 'AT', 'YOU', 'SEE', 'JUST', 'THAT', 'THEIR', 'MUCH', 'WHAT', 'EVEN', 'WHEN', 'FEEL', 'SEEM'}
j = 0
while j < len(toks):
    t = toks[j]; grp = [t]
    if (t['text'] in SHORT and not t['stop'] and j + 1 < len(toks)
            and len(t['text']) + len(toks[j + 1]['text']) <= 14 and not (t['color'] and toks[j + 1]['color'])):
        grp.append(toks[j + 1])
    cards.append({'words': [{'text': g['text'], 'color': g['color']} for g in grp], 's': grp[0]['s'], 'e': grp[-1]['e'], 'stop': grp[-1]['stop']})
    j += len(grp)
for k, c in enumerate(cards):
    t0 = snap(max(0, c['s'] - 1 / FPS))
    nxt = snap(cards[k + 1]['s'] - 1 / FPS) if k + 1 < len(cards) else snap(c['e'] + 0.35)
    t1 = nxt if nxt - c['e'] < 0.45 else snap(c['e'] + 0.3)
    colored = any(w['color'] for w in c['words'])
    timeline['cards'].append({'t0': t0, 't1': min(t1, END_T0), 'words': c['words'], 'pop': colored})
    if colored: timeline['sfx'].append({'t': t0, 'kind': 'pop'})

json.dump(timeline, open('build/timeline.json', 'w'), indent=1)
print(f"shots {len(timeline['shots'])}  cards {len(timeline['cards'])}  sfx {len(timeline['sfx'])}  duration {TOTAL:.2f}s ({int(TOTAL*FPS)} frames)")
lens = [s['t1'] - s['t0'] for s in timeline['shots']]
print(f"shot length avg {sum(lens)/len(lens):.2f}s  min {min(lens):.2f}  max {max(lens):.2f}")
