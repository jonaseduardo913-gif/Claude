"""storyboard.json + build/words.json  ->  build/timeline.json (+ video frame plates)

Resolves every shot to frame-exact times anchored on narration words, extracts the
needed trailer ranges as vertical 4K bands, builds caption cards with the colour code,
and lists the sound-effect events for the mixer.
"""
import json, os, re, subprocess, shutil, sys

FPS = 30
SB = json.load(open('storyboard.json'))
WD = json.load(open('build/words.json'))
words = WD['words']
VO_DUR = WD['duration']
MEDIA = 'input/media'
VIDEOS = {'tr': f'{MEDIA}/trailer.mp4', 'ext': f'{MEDIA}/extended.mp4'}   # short names; others: input/media/videos/<name>.mp4
BAND_FRAC = 1700 / 2160               # vertical band kept from each frame (relative to height)
_probe = {}
def video_info(name):
    path = VIDEOS.get(name, f'{MEDIA}/videos/{name}.mp4')
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
    t0 = 0.0 if k == 0 else wstart(s['at'])
    t1 = wstart(shots[k + 1]['at']) if k + 1 < len(shots) else END_T0
    sh = {'t0': t0, 't1': t1, 'cam': s['cam'], 'trans': s.get('trans', 'cut'), 'overlays': []}
    src = s['src']
    if src.startswith('ss:') or src == 'map':
        path = f"{MEDIA}/ss/{src[3:]}.jpg" if src != 'map' else f"{MEDIA}/map.jpg"
        w, h = img_size(path)
        sh['src'] = {'type': 'still', 'path': path, 'w': w, 'h': h}
    else:  # video clip "name:seconds" -> vertical band of frames
        name, start = src.rsplit(':', 1); start = float(start); speed = s.get('speed', 1.0)
        vpath, SRC_W, SRC_H = video_info(name); BAND_W = min(SRC_W, int(SRC_H * BAND_FRAC) // 2 * 2)
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
    if src == 'map' and s['cam']['from']['z'] > s['cam']['to']['z']: timeline['sfx'].append({'t': t0, 'kind': 'whooshlong'})
    for o in sh['overlays']:
        if o['type'] in ('arrow', 'ring'): timeline['sfx'].append({'t': o['t'], 'kind': 'tick'})
        if o['type'] in ('bigtag', 'pause'): timeline['sfx'].append({'t': o['t'], 'kind': 'hit'})
        if o['type'] == 'loc': timeline['sfx'].append({'t': o['t'] + 0.05, 'kind': 'blip'})

# ---------------- headline + stamp ----------------
hl = SB['headline']
timeline['headline'] = {'lines': hl['lines'], 't0': 0.0, 't1': snap(words[hl['until_word']]['e'] + 0.1)}
timeline['stamp'] = {'t': SB['stamp']['t']}
timeline['sfx'].append({'t': SB['stamp']['t'], 'kind': 'stamp'})
timeline['end'] = {'t0': END_T0, 'trans': SB['end']['trans']}
timeline['sfx'].append({'t': END_T0 - 0.05, 'kind': 'endhit'})

# ---------------- caption cards ----------------
KW = {c: set(v) for c, v in SB['keywords'].items()}
clean = lambda w: re.sub(r"[^A-Z0-9'’-]", '', w.upper().replace('…', '')).replace('’', "'")
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
SHORT = {'A', 'THE', 'OF', 'TO', 'IS', 'ON', 'BY', 'AND', 'BUT', 'IT', 'ITS', "IT'S", 'SO', 'AT', 'YOU', 'SEE', 'JUST', 'THAT', 'THEIR', 'MUCH', 'WHAT', 'EVEN', 'WHEN', 'FEEL', 'SEEM'}
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
