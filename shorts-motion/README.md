# PULSO — Motion Graphics Short (9:16)

Vídeo de 24 s, 1080×1920, 30 fps, gerado 100% por código: tipografia cinética em Canvas 2D,
objetos 3D com materiais PBR em three.js, pós-processamento (shake, glitch, aberração cromática,
distorção fluida, grão) e trilha sonora sintetizada a 120 BPM, travada nos cortes.

**Resultado:** `output/pulso-short.mp4`

## Roteiro (cada cena começa numa batida de 0,5 s)

| Tempo | Cena | Destaques |
|---|---|---|
| 0.0–2.0 | **PARE DE ROLAR** | letras caem com squash & stretch, faixa azul, anel desenhado à mão, zoom punch |
| 2.0–4.5 | **ISSO É MOTION** | transição íris, torus knot 3D voando até a câmera, letras se montando do caos, anel 3D atravessando a câmera |
| 4.5–7.0 | **ENERGIA** | letras esticam e ondulam, explodem e se remontam, linhas de velocidade, octaedro cromado |
| 7.0–9.5 | **TUDO SE TRANSFORMA** | círculo → quadrado → triângulo → estrela → raio, texto girando em cascata |
| 9.5–12.0 | **CRIATIVIDADE** | close extremo no "C" com whip zoom para o plano geral, objetos 3D em órbita, rabiscos |
| 12.0–15.0 | **SEM LIMITES** | túnel 3D com rampa de velocidade (câmera lenta 0.25x → aceleração), motion blur |
| 15.0–17.5 | **MAIS / RÁPIDO / MAIS / FORTE / VIRAL** | 5 cortes secos, um por batida |
| 17.5–19.0 | **3 · 2 · 1** | contagem regressiva com relógio e riser |
| 19.0–20.0 | **EXPLOSÃO** | onda de choque, ~850 partículas, destroços 3D, implosão no logo |
| 20.0–24.0 | **Quadro final** | logo, nome do canal, botão Inscreva-se clicado, sino |

## Personalizar
- Nome do canal / @ / slogan: `src/config.js`
- Paleta: `PAL` em `src/lib.js`
- Cenas e tempos: `SCENES` em `src/main.js`; trilha: `audio.py`

## Gerar
```bash
./build.sh            # requer node, python3+numpy, ffmpeg e Chromium do Playwright
```
Cada quadro é função pura do tempo, então a renderização é determinística e paralela (~30 s para 720 quadros).
