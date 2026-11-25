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

## Biblioteca de cenas
Fontes de vídeo usadas no `storyboard.json` como `nome:segundos`:

| Nome | Arquivo | Conteúdo |
|---|---|---|
| `tr` | `input/media/trailer.mp4` | Launch Trailer oficial (89 s, 4K) |
| `ext` | `input/media/extended.mp4` | "GTA VI – An Extended Look" oficial (26,8 min, 4K) |
| `cover` | `input/media/videos/cover.mp4` | Arte de capa animada (33 s) |
| outros | `input/media/videos/<nome>.mp4` | qualquer vídeo seu (gameplay capturada etc.) |

```bash
python3 library.py scan ext          # detecta as cenas, gera library/ext/sheet_*.jpg
python3 library.py find beach day    # busca nas tags (library/tags.json)
```
Cada miniatura das folhas traz o código da cena (ex.: `ext:612.4`), que vai direto no campo `src` do storyboard.
Tags em MAIÚSCULAS marcam restrições: `TEXT-OVERLAY`, `LOGO-ONLY`, `SUGGESTIVE` (evitar).
