"""Scene library: split a source video into shots and build browsable contact sheets.

  python3 library.py scan ext            # detect scenes -> library/ext/scenes.json + sheets
  python3 library.py find beach night    # list tagged scenes matching all words

Each scene is addressable in storyboard.json as "<name>:<start seconds>".
Tags live in library/tags.json  {"ext:123.4": "beach day crowd wide", ...}.
"""
import json, os, subprocess, sys

MEDIA = 'input/media'
VIDEOS = {'tr': f'{MEDIA}/trailer.mp4', 'ext': f'{MEDIA}/extended.mp4'}
LIB = 'library'

def scan(name, thresh=0.28, min_len=0.7):
    path = VIDEOS.get(name, f'{MEDIA}/videos/{name}.mp4')
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-threads', '0', '-i', path, '-an', '-vf', f"scale=320:-2,select='gt(scene,{thresh})',metadata=print:file=-", '-f', 'null', '-'],
                         capture_output=True, text=True).stdout
    cuts = [0.0] + [float(l.split('pts_time:')[1]) for l in out.splitlines() if 'pts_time:' in l] + [dur]
    scenes = []
    for a, b in zip(cuts, cuts[1:]):
        if b - a < min_len and scenes: scenes[-1]['end'] = round(b, 2); continue
        scenes.append({'id': f'{name}:{round(a + 0.1, 2)}', 'start': round(a, 2), 'end': round(b, 2)})
    d = f'{LIB}/{name}'; os.makedirs(f'{d}/thumbs', exist_ok=True)
    for s in scenes:
        s['dur'] = round(s['end'] - s['start'], 2)
        mid = s['start'] + s['dur'] * 0.45
        t = f"{d}/thumbs/{s['start']:08.2f}.jpg"
        if not os.path.exists(t):
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{mid:.2f}', '-i', path, '-frames:v', '1', '-vf', 'scale=384:216', '-q:v', '4', t], check=True)
        s['thumb'] = t
    json.dump(scenes, open(f'{d}/scenes.json', 'w'), indent=0)
    # contact sheets: 6x6 per page, labelled with the storyboard id and duration
    per = 36
    for p in range(0, len(scenes), per):
        chunk = scenes[p:p + per]; args = []; fl = []
        for k, s in enumerate(chunk):
            args += ['-i', s['thumb']]
            lbl = s['id'].replace(':', '\\:')
            fl.append(f"[{k}]drawtext=text='{lbl}  {s['dur']:.1f}s':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.75[v{k}]")
        lay = '|'.join(f'{(k % 6) * 384}_{(k // 6) * 216}' for k in range(len(chunk)))
        fc = ';'.join(fl) + ';' + ''.join(f'[v{k}]' for k in range(len(chunk))) + (f'xstack=inputs={len(chunk)}:layout={lay}:fill=black' if len(chunk) > 1 else 'null')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args, '-filter_complex', fc, '-frames:v', '1', f'{d}/sheet_{p // per:02d}.jpg'], check=True)
    print(f'{name}: {len(scenes)} scenes, {(len(scenes) + per - 1) // per} sheets in {d}/')

def find(words):
    tags = json.load(open(f'{LIB}/tags.json'))
    for k, v in tags.items():
        if all(w.lower() in v.lower() for w in words): print(f'{k:14s} {v}')

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'scan': [scan(n) for n in sys.argv[2:]]
    elif cmd == 'find': find(sys.argv[2:])
