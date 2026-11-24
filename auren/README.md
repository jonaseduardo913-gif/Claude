# AUREN — editor de Shorts no "Estilo Leonida"

Transforma **narração + storyboard + mídia** num Short 1080×1920 / 30 fps pronto para postar,
seguindo o manual de edição (legenda palavra por palavra com código de cor, chips de local,
setas, anéis, 3 transições animadas no máximo, cortes a cada ~1,5–2,5 s, −14 LUFS).

## Pipeline
| Etapa | Arquivo | O que faz |
|---|---|---|
| 1 | `voice.py` | Encurta pausas da narração (> 150 ms) e alinha cada palavra do `script.txt` com o áudio (Whisper). |
| 2 | `prep.py` | Lê `storyboard.json`, ancora cada plano numa palavra, extrai trechos do trailer em faixa vertical 4K, monta os cartões de legenda e a lista de efeitos sonoros. |
| 3 | `render.js` + `src/edit.js` | Renderiza cada quadro no Chromium headless: enquadramento/Ken Burns, sobreposições, transições, manchete, selo AUREN, quadro final. |
| 4 | `mix.py` | Trilha synthwave (com ducking), efeitos nos cortes e voz; normaliza para −14 LUFS. |

Rodar tudo: `./build.sh`

## Fazer um vídeo novo
1. `script.txt`: roteiro (linha `TITLE:` vira a manchete do gancho; `SIGNOFF:` é só visual).
2. `input/narration.mp3`: a narração.
3. `storyboard.json`: um plano por ideia, com `at` = índice da palavra (veja `build/words.json`),
   `src` (`ss:NNN`, `map` ou `tr:SEGUNDOS`), `cam` (from/to com cx, cy, z) e `overlays`
   (`loc`, `arrow`, `ring`, `maplabel`, `bigtag`, `pause`). Transições: `zoomblur`, `glitch`, `dip`, `xfade`.
4. `keywords` no storyboard define as cores: ciano = lugares, amarelo = valor/conquista, rosa = emoção/perigo.

## Mídia
Os arquivos de `input/media` vêm da página oficial de downloads do GTA VI
(rockstargames.com/VI/downloads) e não são versionados. Créditos: Rockstar Games.
