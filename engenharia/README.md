# Canal de Engenharia — sistema de produção de Shorts 3D

Vídeos verticais (1080×1920, 30 fps, 45–60 s) explicando como as coisas funcionam, com animação 3D,
corte transversal real, narração neural pt-BR, legendas sincronizadas, trilha e efeitos sonoros originais.

Episódios prontos:
- **`episodes/fechadura/`** (pt-BR, estilo *studio* — documentário escuro com cortes hachurados, voz Piper) → `output/fechadura/fechadura.mp4`
- **`episodes/elevator/`** (en-US, estilo *lowpoly* com personagens, narração ElevenLabs fornecida) → `output/elevator/elevator.mp4`
- **`episodes/channel-tunnel/`** (en-US, estilo *lowpoly*, narração fornecida) → `output/channel-tunnel/channel-tunnel.mp4`

## Estilos visuais
- `studio` (padrão): estúdio escuro, metais PBR, cortes com hachura técnica.
- `lowpoly` (`export const style = 'lowpoly'` no `scene.js`): 3D facetado, cores vivas, céu e sol, nuvens e árvores
  low-poly e **elenco original** (`engine/lowpoly.js`): `otto` (engenheiro, capacete laranja), `nova` (curiosa, cabelo roxo),
  `crewA`, `crewB`. `makeCharacter('otto')` + `.pose({point, wave, thumbs, cheer, walk, mouth, brows, blink, head})`.

## Narração
- **TTS local** (`"voice"` no episode.json): Piper pt-BR, tempos de palavra por fonemas.
- **Narração fornecida** (`"narration_audio": {"file": "narration.mp3", "max_pause": 0.38, "tempo": 1.0}`):
  `python3 tools/align.py <slug>` gera `alignment.json` (faster-whisper); cada cena começa na frase `starts_with`.
  `max_pause` encurta silêncios longos e `tempo` ajusta a velocidade sem mudar o tom, para caber na duração-alvo.

## Novo episódio só com o tema
No Claude Code: `/novo-episodio como funciona um motor a combustão` (skill em `.claude/skills/novo-episodio/`).
A skill pesquisa, escreve o roteiro, modela e anima as cenas, faz prévias, renderiza e valida.

## Pipeline
```
episodes/<slug>/episode.json   roteiro, pesquisa/fontes, storyboard, câmera, transições, SFX, intensidade da trilha
episodes/<slug>/scene.js       modelos 3D + animação determinística por cena
        │
        ▼  python3 tools/produce.py <slug>
 tts        narração Piper (voz pt_BR-faber) por cena + tempos por palavra (fonemas)
 timeline   duração de cada cena = narração + respiro (3–7 s), total 45–60 s
 render     three.js no Chromium headless → um clipe por cena (tools/render.cjs)
 video      transições cinematográficas (xfade) entre cenas
 audio      trilha procedural + SFX mecânicos + ducking sob a voz (tools/audio.py)
 captions   legendas palavra a palavra (ASS), palavra ativa em destaque
 final      MP4 H.264 + AAC, -14 LUFS, legendas gravadas
 storyboard prancha + storyboard.md com quadros reais
```
Passos podem ser rodados isoladamente: `--steps tts,timeline`, `--steps render --only S04,S05`, etc.

## Ferramentas
- `tools/new_episode.py <slug> "<tema>"` — cria o esqueleto do episódio.
- `tools/validate.py <slug> [--final]` — checa estrutura, fontes, durações, transições, SFX, resolução e loudness.
- `tools/render.cjs --ep <slug> --still S03:2.5 --out <dir>` — prévias de quadros únicos.
- `tools/align.py <slug>` — alinhamento palavra a palavra de uma narração fornecida.

## Motor 3D (`engine/`)
- `kit.js`: estúdio (fundo gradiente, piso técnico, luz-chave/recorte, HDRI), materiais PBR (aço, latão, níquel…),
  **sistema de corte transversal** (`Cutaway`: plano de corte animável com faces hachuradas via stencil),
  CSG (`csg/brush`), molas, etiquetas 3D com linha-guia, câmera (`path/orbit`), easing, grade de cor,
  peças reutilizáveis (`parts.gearGeometry`, `parts.arrow`, `parts.pipe`, `parts.flow`, `parts.shaft`, `parts.ghost`).
- `runtime.js`: renderer, pós-processamento (bloom, vinheta, grão), carrega o `scene.js` do episódio.

## Requisitos do ambiente
Node 22 + `npm install` (three, three-bvh-csg), Playwright/Chromium, Python 3 com `numpy scipy pillow piper-tts faster-whisper`,
ffmpeg com libass, vozes Piper em `/opt/tools/voices` (`pt_BR-faber-medium`, `cadu`, `jeff`).
Para preparar uma máquina nova: `bash tools/setup.sh`.
