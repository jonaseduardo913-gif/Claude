# Canal de Engenharia — sistema de produção de Shorts 3D

Vídeos verticais (1080×1920, 30 fps, 45–60 s) explicando como as coisas funcionam, com animação 3D,
corte transversal real, narração neural pt-BR, legendas sincronizadas, trilha e efeitos sonoros originais.

Episódio-modelo: **`episodes/fechadura/`** → `output/fechadura/fechadura.mp4`.

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

## Motor 3D (`engine/`)
- `kit.js`: estúdio (fundo gradiente, piso técnico, luz-chave/recorte, HDRI), materiais PBR (aço, latão, níquel…),
  **sistema de corte transversal** (`Cutaway`: plano de corte animável com faces hachuradas via stencil),
  CSG (`csg/brush`), molas, etiquetas 3D com linha-guia, câmera (`path/orbit`), easing, grade de cor,
  peças reutilizáveis (`parts.gearGeometry`, `parts.arrow`, `parts.pipe`, `parts.flow`, `parts.shaft`, `parts.ghost`).
- `runtime.js`: renderer, pós-processamento (bloom, vinheta, grão), carrega o `scene.js` do episódio.

## Requisitos do ambiente
Node 22 + `npm install` (three, three-bvh-csg), Playwright/Chromium, Python 3 com `numpy scipy pillow piper-tts`,
ffmpeg com libass, vozes Piper em `/opt/tools/voices` (`pt_BR-faber-medium`, `cadu`, `jeff`).
Para preparar uma máquina nova: `bash tools/setup.sh`.
