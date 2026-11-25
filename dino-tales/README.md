# DINO CONTOS — 3 curtas animados em 3D (pré-história com dinossauros)

Três episódios de desenho 3D (1920×1080, 30 fps, H.264 + AAC), com personagens caricatos
originais, legendas em português, vozes "fofas" sintetizadas, trilha e efeitos sonoros —
tudo gerado 100% por código (three.js + Chromium headless + Python/numpy + ffmpeg).

| # | Episódio | Ambiente | Elenco | Duração |
|---|---|---|---|---|
| 1 | **O Ovo Perdido** — `output/01-o-ovo-perdido.mp4` | Selva vulcânica, dia ensolarado | **Tuca** (menino das cavernas desastrado, nariz enorme e um dente só), **Pipoca** (bebê tricerátops que usa a casca do ovo como chapéu), **Dona Tetê** (mamãe tricerátops de cílios e lacinho rosa) | 50 s |
| 2 | **Pedrão e o Fogo** — `output/02-pedrao-e-o-fogo.mp4` | Vale nevado ao entardecer, com aurora boreal e caverna | **Grunk** (homem das cavernas grandalhão, monocelha e barba), **Lili** (filhinha de marias-chiquinhas), **Pedrão** (anquilossauro sonolento e alérgico) | 48 s |
| 3 | **Vovó Zuza e o Peixão** — `output/03-vovo-zuza-e-o-peixao.mp4` | Praia ao pôr do sol, mar animado | **Vovó Zuza** (vovó pescadora de coque e óculos de pedra), **Bico** (pteranodonte guloso e trapalhão), **Nessa** (plesiossauro brincalhão) | 46 s |

## Sinopses
1. **O Ovo Perdido** — Tuca passeia pela selva, tropeça num "pedra" esquisita... que é um ovo! Nasce Pipoca,
   que acha que Tuca é a mãe dele e o segue por toda parte. Os dois saem em busca da mãe verdadeira, seguem
   pegadas gigantes e encontram Dona Tetê — brava no começo, agradecida no final. Tuca volta para casa nas costas dela.
2. **Pedrão e o Fogo** — Lili está congelando e Grunk tenta fazer fogo: esfrega gravetos, bate pedras, fica bravo
   e ainda leva um monte de neve na cabeça. Chega Pedrão, que espirra e acerta uma pedra com a cauda: faíscas!
   Lili faz cócegas no nariz dele, Grunk posiciona os gravetos... ATCHIM! Fogo! (E a barba do Grunk também pega fogo.)
3. **Vovó Zuza e o Peixão** — Zuza pesca tranquila até Bico roubar o peixe do cesto (e levar uma varada de leve).
   Então algo enorme puxa a linha: Zuza é arrancada da pedra, Bico a salva no ar — e quem surge do mar é Nessa,
   que só queria brincar. Tudo termina num piquenique ao pôr do sol.

## Estrutura
- `src/engine.js` — renderer, céu em shader, chão, olhos cartoon, emoções, partículas, legendas, títulos.
- `src/chars.js` — personagens montados com primitivas (humanos, tricerátops, anquilossauro, pteranodonte, plesiossauro, peixe, ovo).
- `src/props.js` — cenário (palmeiras, árvores, samambaias, vulcão, montanhas, pinheiros, fogueira, água).
- `src/story1.js`, `story2.js`, `story3.js` — roteiro, falas, câmeras e animação de cada episódio (cada quadro é função pura do tempo).
- `audio.py` — sintetiza música, ambiência, efeitos e vozes a partir das deixas exportadas pelo renderizador.

## Gerar
```bash
./build.sh 1 2 3      # requer node, python3 + numpy, ffmpeg e o Chromium do Playwright
```

## Especial: THE LOST EGG (narrado, 6:20)
`output/04-the-lost-egg.mp4` — curta cinematográfico narrado em inglês americano (somente narrador,
voz sintetizada com Kokoro TTS, voz `am_michael`), 1920×1080 a 24 fps, 11 cenas sincronizadas com a narração:
floresta mágica ao amanhecer, o arbusto e o ovo dourado, pegadas gigantes, ponte de madeira, cachoeira com
arco-íris, campo de flores, o filhote no arbusto, o nascimento, a trilha de árvores altas, o rugido,
o reencontro na clareira, a despedida e a lição ao pôr do sol.
- Narração: `narration/tts.py` gera `narration/lines/*.wav` e `src/narr4.json` (tempos de cada frase).
- Cena: `src/story4.js`. Gerar: `./build.sh 4`.
