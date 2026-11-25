# EXTRAMUNDO — Shorts

Mesmo motor do AUREN (narração com tempo por palavra → storyboard → render → mix), com identidade própria:
paleta preto/brasa/turquesa, textos gigantes por cena, brasas e distorção de calor, filtro de filme antigo,
animação procedural (`anim:collapse`), comparação lado a lado (`compare:a,b`) e pino de mapa.

- `brand/logo.js` — logo (planeta + órbita em brasa), avatar, banner e marca d'água.
- `storyboard.json` — vídeo da Cratera de Darvaza (fontes: Wikimedia Commons, ver `output/CREDITOS.txt`).

```bash
python3 voice.py --audio input/narration.mp3 --tighten --lang pt
python3 prep.py && node render.js --workers 4 && python3 mix.py
```
Mídia em `input/media/<nome>.jpg` → `img:<nome>` no storyboard.
