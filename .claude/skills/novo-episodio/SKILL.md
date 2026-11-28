---
name: novo-episodio
description: Produz um vídeo curto completo (9:16, 45-60s, MP4) do canal de engenharia "como as coisas funcionam" a partir apenas de um tema. Use quando o usuário pedir um novo episódio/vídeo sobre como algo funciona (máquina, construção, tecnologia, fenômeno físico).
---

# Novo episódio — Canal de Engenharia

Entrada: um tema (ex.: "como funciona um motor a combustão", "por que pontes suspensas não caem").
Saída: `engenharia/output/<slug>/<slug>.mp4` + roteiro, narração, storyboard, legendas e trilha.

Sistema em `engenharia/` (leia `engenharia/README.md`). Episódio-modelo completo: `engenharia/episodes/fechadura/`.

## Etapas (siga na ordem, sem pular)

### 1. Pesquisa e verificação (obrigatório)
- Use WebSearch (2+ buscas) para confirmar como o mecanismo REALMENTE funciona: peças, nomes técnicos em pt-BR, sequência física, números.
- Não invente mecanismos. Se fontes divergem (datas, números), use a formulação segura ("no século dezenove", "em teoria") e registre a divergência em `research.facts_checked`.
- Registre `research.summary`, ≥3 `facts_checked` e ≥2 `sources` (URLs) em `episode.json`.

### 1b. Estilo, idioma e narração
- Estilo `studio` (documentário escuro) ou `lowpoly` (3D facetado colorido com personagens originais Otto/Nova/crew — referência: canais tipo "Desmontando o Mundo"). Pergunte se não estiver claro; se o usuário mandar referências, siga-as.
- **Voz padrão do canal HOWSTUFF: ElevenLabs "Nathan" em TODOS os vídeos.** Nunca entregue um vídeo final com a voz Piper: ela serve só como rascunho para prévia/timeline. Se o usuário não mandar o MP3, peça a narração em Nathan (texto exato por cena) antes de renderizar o vídeo completo.
- Se o usuário fornecer narração (MP3/WAV): copie para `episodes/<slug>/narration.mp3`, configure `narration_audio` e rode `python3 tools/align.py <slug>`; use `starts_with` em cada cena; ajuste `max_pause`/`tempo` para caber na duração pedida (`format.duration_range`).

### 2. Esqueleto
```
cd engenharia && python3 tools/new_episode.py <slug> "<tema>"
```

### 3. Roteiro (`episode.json`)
- 9 a 14 cenas, cada uma 3–7 s depois da narração (a voz fala ~3,6 palavras/s; cena = narração + 0,6 s). Total 45–60 s ≈ 150–175 palavras.
- S01 = gancho visual nos primeiros 2 s (a coisa mais surpreendente do tema já em movimento) + pergunta curta.
- Estrutura: gancho → visão geral → corte/peças → mecanismo passo a passo (cena principal com a física real) → resultado → contraste (falha / sem ele) → número impressionante → contexto/história verificada → fecho.
- Narração: frases curtas, documental, números por extenso (TTS), sem jargão não explicado.
- Cada cena: `narration`, `storyboard` (o que se VÊ, ligado à explicação), `camera`, `transition` (`zoomin`, `smoothup`, `fade`, `wipeleft`, `fadeblack`, `slideup`, `circleopen`, `smoothleft`, `dissolve`; última = `none`), `music` (0–3 intensidade), `sfx` (lista de `{u: 0..1, type}`; tipos em `tools/audio.py::sfx`; crie novos tipos lá se o tema exigir, ex. vapor, água, motor), `min_seconds`.

### 4. Narração e linha do tempo (antes de animar, para ter as durações reais)
```
python3 tools/produce.py <slug> --steps tts,timeline
python3 tools/validate.py <slug>
```
Ajuste o texto até não haver erros (cenas > 7 s, total fora de 45–60 s).

### 5. Modelos 3D e animação (`scene.js`)
- Modele o objeto real com proporções coerentes (pesquise dimensões). Use `kit.csg()` para furos/cavidades, `kit.parts` (engrenagens com `meshSpeed` correto, setas de força, tubos com fluxo de partículas, eixos), `kit.springGeometry`, `LatheGeometry` para peças de revolução, `ExtrudeGeometry` para perfis.
- Mostre o interior: `cut.add(mesh, capMaterial(cor))` + `cut.offset` (100 = inteiro, 0 = cortado em z=0; anime para revelar). Ou `parts.ghost()` para carcaças translúcidas.
- Movimento deve vir da física/cinemática real (como `solve()` no episódio fechadura: pinos seguem o perfil da chave). Nada de cenas genéricas.
- Cada função de cena define o estado completo para (t, d) — determinístico. Câmera com `path([[t, pose], ...], t)` e `orbit(...)`, sempre em movimento suave.
- Etiquetas: `new Label(ctx, 'TEXTO')` e `label.set(opacidade, âncoraMundo|null, [x, y] em tela -1..1)`; mantenha y entre -0.55 e 0.75 (legendas ficam embaixo).
- Visual consistente: estúdio escuro, metais PBR (`mat.steel/brass/nickel/...`), destaque ciano `#37d2ff`, alerta `#ff4d4d`, ok `#52ff9a`, latão `#ffc24a`.

### 6. Prévia (sempre antes do render completo)
```
node tools/render.cjs --ep <slug> --out /tmp/prev --still S01:1 --still S06:3 ...
```
Monte uma prancha e INSPECIONE as imagens: enquadramento 9:16, etiquetas dentro da tela, nada cortado, peças corretas, contraste das faces de corte. Corrija e repita.

### 7. Produção completa
```
python3 tools/produce.py <slug> --steps render,video,audio,captions,final,storyboard --workers 2
python3 tools/check_frames.py <slug>     # blocos pretos? re-renderize as cenas com --steps render --only Sxx
python3 tools/validate.py <slug> --final
```
Não rode mais de 2 workers ao mesmo tempo na máquina (CPU compartilhada).
(~1,5 s por quadro por worker; um vídeo de 55 s leva ~25–35 min. Rode em segundo plano.)

### 8. Controle de qualidade final
- Extraia quadros do MP4 final (início de cada cena) e confira: gancho forte, mecanismo visível, legendas sincronizadas e legíveis, sem quadros quebrados.
- Confira precisão técnica do roteiro contra as fontes.
- Entregue: caminho do MP4, duração, resumo das fontes.

## Regras do canal
- Nunca imagens estáticas no lugar de animação; toda cena tem câmera e/ou mecanismo em movimento.
- Nunca sacrificar precisão por estética; nunca inventar processos.
- Sem música/voz de terceiros: trilha e SFX são sintetizados (`tools/audio.py`), voz final sempre ElevenLabs Nathan (Piper local só para rascunho).
