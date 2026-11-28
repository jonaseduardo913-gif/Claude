# Generates storyboard.json for "7 lugares" (16:9). Run from videos/planetas.
import json, re, os
W = json.load(open('build/words.json'))['words']
txt = [w['w'] for w in W]
N = len(txt)

def find(seq, start=0):
    """index of first word of `seq` (space separated, case-insensitive, punctuation-stripped) at/after start"""
    s = [re.sub(r'[^\wà-ú-]', '', x.lower()) for x in seq.split()]
    norm = [re.sub(r'[^\wà-ú-]', '', x.lower()) for x in txt]
    for i in range(start, N - len(s) + 1):
        if norm[i:i + len(s)] == s: return i
    raise SystemExit(f'not found: {seq}')

ends = {i for i, x in enumerate(txt) if x[-1] in '.!?:'}
def anchors(a, b, maxlen=13):
    """shot change points in [a,b): sentence starts, long sentences split"""
    out, s = [], a
    while s < b:
        e = s
        while e < b - 1 and e not in ends: e += 1
        L = e - s + 1; parts = max(1, round(L / maxlen))
        for p in range(parts): out.append(s + round(p * L / parts))
        s = e + 1
    return out

CAMS = [
    ({'cx': .5, 'cy': .5, 'z': 1.04}, {'cx': .5, 'cy': .5, 'z': 1.2}),
    ({'cx': .42, 'cy': .5, 'z': 1.18}, {'cx': .58, 'cy': .5, 'z': 1.18}),
    ({'cx': .5, 'cy': .48, 'z': 1.24}, {'cx': .5, 'cy': .52, 'z': 1.06}),
    ({'cx': .58, 'cy': .5, 'z': 1.18}, {'cx': .42, 'cy': .5, 'z': 1.18}),
]
ci = 0
def cam(i=None, **kw):
    global ci
    f, t = CAMS[ci % len(CAMS)] if i is None else CAMS[i]; ci += 1
    f, t = dict(f), dict(t)
    for k, v in kw.items():
        if k.startswith('f'): f[k[1:]] = v
        else: t[k[1:]] = v
    return {'from': f, 'to': t, 'ease': 'inOutSine'}

shots = []
def shot(at, src, trans='cut', overlays=None, **kw):
    s = {'at': at, 'src': src, 'trans': trans}
    if not src.startswith('anim:') and 'cam' not in kw: s['cam'] = cam()
    s.update(kw)
    if overlays: s['overlays'] = overlays
    shots.append(s)

def section(a, b, pool, first_trans='dissolve', every=3, tags=None, maxlen=13):
    """fill [a,b) with images from pool; dissolve on sentence starts every few shots"""
    tags = tags or {}
    for k, at in enumerate(anchors(a, b, maxlen)):
        src = pool[k % len(pool)]
        tr = first_trans if k == 0 else ('dissolve' if (at - 1 in ends and k % every == 0) else 'cut')
        ov = [dict(o) for o in tags.get(src, [])]
        for o in ov: o.setdefault('word', at)
        shot(at, src, tr, ov or None)

def media(sub, keys): return [f'img:{sub}/{k}' for k in keys]
def have(sub, prefix):
    d = f'input/media/{sub}'
    return sorted(os.path.splitext(f)[0] for f in os.listdir(d) if f.startswith(prefix) and not f.endswith('.json')) if os.path.isdir(d) else []

E4K = 'earth4k'
NUM = [i for i, x in enumerate(txt) if x == 'Número']
assert len(NUM) == 7, NUM
CH = [  # num, title, country, lower text, pool
    ('7', 'ILHA DE SOCOTRA', 'IÊMEN', 'SOCOTRA|A ILHA ALIENÍGENA'),
    ('6', 'DALLOL', 'ETIÓPIA', 'DALLOL|A PAISAGEM MAIS ALIENÍGENA DA TERRA'),
    ('5', 'SALAR DE UYUNI', 'BOLÍVIA', 'SALAR DE UYUNI|O ESPELHO DO CÉU'),
    ('4', 'ZHANGYE', 'CHINA', 'ZHANGYE|AS MONTANHAS DE ARCO-ÍRIS'),
    ('3', 'WAITOMO', 'NOVA ZELÂNDIA', 'WAITOMO|O CÉU ESTRELADO SUBTERRÂNEO'),
    ('2', 'DARVAZA', 'TURCOMENISTÃO', 'DARVAZA|A PORTA DO INFERNO'),
    ('1', 'RIO TINTO', 'ESPANHA', 'RIO TINTO|O RIO VERMELHO'),
]
CLOSE = find('De uma ilha repleta')

def chapter(k, img, lower_at, pool, tags=None, special=None):
    a = NUM[k]; b = NUM[k + 1] if k < 6 else CLOSE
    num, title, country, lower = CH[k]
    shot(a, img, 'dissolve', [{'type': 'chapter', 'num': num, 'text': title, 'sub': country, 'word': a, 'until': a + 5}],
         cam=cam(0, tz=1.12))
    body = a + 5
    special = special or {}
    # body shots
    for kk, at in enumerate(anchors(body, b)):
        src = special.get(at) or pool[kk % len(pool)]
        tr = 'dissolve' if kk == 0 or (at - 1 in ends and kk % 3 == 0) else 'cut'
        ov = []
        if kk == 0: ov.append({'type': 'lower', 'text': lower, 'word': at, 'dur': 5.5})
        for o in (tags or {}).get(src, []): o = dict(o); o.setdefault('word', at); ov.append(o)
        if isinstance(src, dict): shot(at, trans=tr, overlays=ov or None, **src)
        else: shot(at, src, tr, ov or None)

# ---------------- intro ----------------
i_rio = find('Ou observar um rio'); i_mont = find('montanhas com todas'); i_crat = find('e uma cratera')
i_pode = find('Pode parecer'); i_mas = find('Mas todos esses'); i_nosso = find('Nosso planeta esconde')
i_hoje = find('E hoje você'); i_prep = find('Prepare-se')
Z = ['zhangye' + k for k in ['15', '01', '14', '03', '17', '00', '21', '04', '16', '20', '09', '05', '08', '13', '18', '12', '19', '02']]
WT = ['waitomo' + k for k in ['06', '07', '20', '10', '21', '12', '14', '00']]; TT = have('tinto', 'tinto')
zh = media('zhangye', Z) + media('ov', ['ov_zhangyefl' + k for k in ['00', '06', '07', '15', '02', '04', '08', '10', '03', '12', '09', '11', '13', '01']])
wt = (media('waitomo', WT) or [])
ti = (media('tinto', TT) or [])
shot(0, 'img:socotra/socotra03', 'cut', cam=cam(0))
shot(find('onde as árvores'), 'img:inat/dr01', 'cut')
shot(i_rio, 'img:ov/ov_tinto03', 'dissolve', fit='blurfill')
shot(i_mont, zh[0], 'dissolve')
shot(i_crat, 'img:darvaza/night', 'dissolve', fx=['heat'])
shot(i_pode, 'img:dallol/dallol19', 'dissolve')
shot(i_pode + 5, 'img:dallol/dallol01', 'cut')
shot(i_mas, f'{E4K}:300', 'dissolve', cam=cam(0, tz=1.08))
shot(i_nosso, 'img:uyuni/uyuni06', 'dissolve')
shot(i_nosso + 8, 'img:inat/gw09', 'cut')
shot(i_hoje, f'{E4K}:1300', 'dissolve', overlays=[{'type': 'bigtext', 'text': '7 LUGARES DA TERRA|QUE PARECEM DE|OUTRO PLANETA', 'style': 'fade', 'size': 120, 'y': 0.45, 'color': 'gold', 'word': i_hoje, 'until': NUM[0]}], cam=cam(0, tz=1.06))

# ---------------- 7 Socotra ----------------
SO = media('socotra', ['socotra15', 'socotra13', 'socotra21', 'socotra03', 'socotra09', 'socotra11', 'socotra17', 'socotra18', 'socotra05', 'socotra12', 'socotra19', 'socotra10', 'socotra14', 'socotra16', 'socotra20', 'socotra01', 'socotra07'])
SO = SO[:2] + ['img:nasa/socotra_iss'] + SO[2:] + media('inat', ['dr00', 'dr02', 'dr03', 'dr04'])
chapter(0, 'img:socotra/socotra00', None, SO,
        tags={'img:inat/dr03': [{'type': 'tag', 'text': 'DRACAENA CINNABARI'}], 'img:nasa/socotra_iss': [{'type': 'tag', 'text': 'FOTO: NASA / ISS'}]},
        special={find('Entre suas espécies'): 'img:inat/dr02', find('Ela possui um tronco'): 'img:inat/dr03', find('Quando sua casca'): 'img:socotra/socotra06'})

# ---------------- 6 Dallol ----------------
DA = media('dallol', ['dallol01', 'dallol07', 'dallol03', 'dallol19', 'dallol05', 'dallol14', 'dallol15', 'dallol17', 'dallol18', 'dallol00', 'dallol06', 'dallol20', 'dallol21', 'dallol09'])
DA = DA[:3] + ['img:ov/ov_dallol07'] + DA[3:] + ['img:ov/ov_dallol05', 'img:ov/ov_dallol13', 'img:ov/ov_dallol03']
chapter(1, 'img:dallol/dallol04', None, DA,
        special={find('Esse lugar existe no deserto'): 'img:nasa/danakil_afrera', find('As temperaturas'): 'img:ov/ov_dallol03'},
        tags={'img:nasa/danakil_afrera': [{'type': 'tag', 'text': 'DEPRESSÃO DE DANAKIL · NASA'}]})

# ---------------- 5 Uyuni ----------------
UY = media('uyuni', ['uyuni13', 'uyuni03', 'uyuni01', 'uyuni08', 'uyuni04', 'uyuni09', 'uyuni11', 'uyuni05', 'uyuni07', 'uyuni10', 'uyuni00', 'uyuni02'] + [k for k in have('uyuni', 'uyuni') if int(k[5:]) > 13])
UY += ['img:ov/ov_uyuni07', 'img:ov/ov_uyuni10', 'img:ov/ov_uyuni08']
chapter(2, 'img:uyuni/uyuni12', None, UY,
        special={find('Com mais de dez mil'): 'img:nasa/uyuni_iss', find('Mas o lugar também guarda'): 'img:nasa/uyuni_lithium'},
        tags={'img:nasa/uyuni_iss': [{'type': 'tag', 'text': 'VISTO DO ESPAÇO · NASA'}], 'img:nasa/uyuni_lithium': [{'type': 'tag', 'text': 'PISCINAS DE LÍTIO · NASA'}]})

# ---------------- 4 Zhangye ----------------
chapter(3, zh[0], None, [x for p in zip(zh[1:18], zh[18:] + zh[1:18]) for x in p][:30])

# ---------------- 3 Waitomo ----------------
GW = media('inat', ['gw09', 'gw30', 'gw35', 'gw11', 'gw31', 'gw15'])
chapter(4, (wt or GW)[0], None, (wt[1:] + GW) if wt else GW[1:],
        special={find('Essas criaturas ficam penduradas'): 'img:inat/gw27', find('São organismos vivos'): 'img:inat/gw18'},
        tags={'img:inat/gw27': [{'type': 'tag', 'text': 'FIOS DE SEDA DAS LARVAS'}], 'img:inat/gw18': [{'type': 'tag', 'text': 'LARVAS DE ARACHNOCAMPA'}]})

# ---------------- 2 Darvaza ----------------
DV = media('darvaza', ['glow', 'goetz_dawn', 'pav1', 'inside', 'pav2', 'goetz_day', 'pav3', 'pav_day', 'pav4', 'doortohell', 'pav_dawn', 'panorama', 'pav5'])
chapter(5, 'img:darvaza/night', None, DV,
        special={find('À noite'): 'img:darvaza/night', find('Uma enorme cratera brilhante'): 'img:darvaza/glow'})
for s in shots:
    if 'darvaza/' in s['src'] and s['src'] not in ('img:darvaza/goetz_day', 'img:darvaza/pav_day'): s['fx'] = ['heat', 'embers']

# ---------------- 1 Rio Tinto ----------------
TO = ti + media('ov', ['ov_tinto01', 'ov_tinto03', 'ov_tinto14', 'ov_tinto02', 'ov_tinto15', 'ov_tinto13', 'ov_tinto04', 'ov_tinto09', 'ov_tinto16', 'ov_tinto05'])
chapter(6, TO[0], None, TO[1:], special={find('Esse lugar existe na região'): 'img:nasa/tinto_aster'},
        tags={'img:nasa/tinto_aster': [{'type': 'tag', 'text': 'RIO TINTO VISTO DO ESPAÇO · NASA'}]})

# ---------------- closing ----------------
i_e7 = find('E esses são apenas sete'); i_terra = find('A Terra ainda esconde'); i_agora = find('Agora queremos'); i_se = find('E se pudesse')
i_conte = find('Conte nos'); i_insc = find('E inscreva-se'); i_porque = find('Porque a realidade')
shot(CLOSE, 'img:socotra/socotra10', 'dissolve')
shot(find('até um rio vermelho', CLOSE), TO[1], 'dissolve')
shot(find('nosso planeta está cheio', CLOSE), f'{E4K}:800', 'dissolve')
shot(i_e7, 'img:dallol/dallol19', 'dissolve')
shot(i_terra, f'{E4K}:1100', 'dissolve')
mont = ['img:socotra/socotra03', 'img:dallol/dallol07', 'img:uyuni/uyuni06', zh[1 % len(zh)], (wt or GW)[0], 'img:darvaza/night', TO[2]]
for k, src in enumerate(mont):
    shot(i_agora + round(k * (i_conte - i_agora) / len(mont)), src, 'cut' if k else 'dissolve', **({'fx': ['heat']} if 'darvaza' in src else {}))
shot(i_conte, 'img:uyuni/uyuni11', 'dissolve')
shot(i_insc, f'{E4K}:900', 'dissolve', cam=cam(0, tz=1.1))
shot(i_porque, f'{E4K}:1400', 'dissolve', cam=cam(0, tz=1.1),
     overlays=[{'type': 'bigtext', 'text': 'A TERRA É MAIS SURPREENDENTE|DO QUE VOCÊ IMAGINA.', 'style': 'fade', 'size': 104, 'y': 0.42, 'color': 'white', 'word': i_porque}])

shots.sort(key=lambda s: s['at'])
# de-dup anchors (keep the later definition = special/closing)
ded = {}
for s in shots: ded[s['at']] = s
shots = sorted(ded.values(), key=lambda s: s['at'])
keep = []
for k, s in enumerate(shots):
    nxt = shots[k + 1]['at'] if k + 1 < len(shots) else N
    if nxt - s['at'] < 5 and not s.get('overlays') and not (i_agora <= s['at'] < i_conte) and k > 0: continue
    keep.append(s)
shots = keep

music = [{'t': 0, 'level': 0.32}, {'word': i_hoje, 'level': 0.45}]
for k, a in enumerate(NUM): music += [{'word': a, 'level': 0.5}, {'word': a + 6, 'level': 0.36}]
music += [{'word': CLOSE, 'level': 0.45}, {'word': i_porque, 'level': 0.55}]
sfx = [{'word': a, 'kind': 'swell'} for a in NUM] + [{'word': a + 1, 'kind': 'sub'} for a in NUM]

SB = {
    'format': 'landscape', 'lead': 0.1, 'headline': None, 'stamp': None, 'epic_word': i_porque,
    'music': music, 'sfx': sfx, 'shots': shots,
    'end': {'hold': 5.0, 'trans': 'fade', 'fade': 1.0, 'tagline': ['INSCREVA-SE PARA DESCOBRIR', 'O EXTRAORDINÁRIO']},
    'keywords': {'gold': ['SOCOTRA', 'DALLOL', 'UYUNI', 'ZHANGYE', 'WAITOMO', 'DARVAZA', 'TINTO', 'ÁRVORE-SANGUE-DE-DRAGÃO', 'LÍTIO', 'GLOWWORMS',
                          'VERMELHO', 'SANGUE', 'ARCO-ÍRIS', 'INFERNO', 'PLANETA', 'PLANETAS', 'TERRA', 'ALIENÍGENA', 'ALIENÍGENAS', 'MARTE',
                          'SETE', 'CÉU', 'REFLEXO', 'ESTRELADO', 'CHAMAS', 'VIVOS', 'ÁCIDAS', 'EXTRAORDINÁRIAS', 'INACREDITÁVEIS', 'EXTRAMUNDO',
                          'IMPOSSÍVEIS', 'SURPREENDENTE', 'CORES', 'COLORIDAS', 'VULCÂNICA', 'SAL', 'MINERAIS', 'MICRORGANISMOS', 'LUZES']},
}
json.dump(SB, open('storyboard.json', 'w'), indent=1, ensure_ascii=False)
print(len(shots), 'shots')
