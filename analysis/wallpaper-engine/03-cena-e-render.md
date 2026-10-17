# 03 — Cena e render

## Tipos de objeto ✅
| Objeto | O que é |
|---|---|
| **image** | Quad com textura (camada). Pode ser `fullscreen`, `solid` (recebe clique), `passthrough`, ter `copybackground`. Recebe uma **pilha de efeitos** |
| **particle** | Sistema de partículas (ver abaixo) |
| **text** | Texto renderizado com fonte; pode ser ligado a script (relógio, data) |
| **sound** | Áudio tocando (playlist, volume, modo) |
| **light** | Luz pontual/spot/direcional para cenas com iluminação |
| **model** | Malha 3D (`.mdl`) |
| **group / layer** | Hierarquia com transformação herdada |

Campos comuns: `origin`, `scale`, `angles`, `visible`, `alpha`, `color`, `brightness`, `alignment`,
`parallaxDepth` (quanto a camada se move com o mouse), `dependencies` (ids que precisam ser desenhados antes).

## Pipeline de um frame ✅ (linux-WE `CScene.cpp:300`, open-WE `RenderGraph`)
1. Atualiza mouse e **parallax** (suavizado: `mix(atual, mouse·amount·influence, delay·dt)`).
2. Roda um *tick* do SceneScript ([06](06-scenescript.md)).
3. Atualiza texturas animadas (GIF/spritesheet, vídeo como textura).
4. Desenha objetos **na ordem de dependência** num framebuffer da cena.
5. Bloom (se ligado): reduz para 1/4 e 1/8 → blur → soma.
6. Apresenta na janela do WorkerW.

## Render targets nomeados ✅ (`SpecNames.cppm`, docs linux-WE)
| Nome | Uso |
|---|---|
| `_rt_imageLayerComposite_<id>_a/_b` | **ping-pong** de cada camada: cada efeito lê A e escreve B, depois inverte |
| `_rt_FullFrameBuffer` | tudo o que já foi desenhado (efeitos de "distorcer o fundo") |
| `_rt_MipMappedFrameBuffer` | versão com mipmaps (blur barato) |
| `_rt_HalfCompoBuffer1/2`, `_rt_FullCompoBuffer1_*` | buffers intermediários de composição |
| `_rt_4FrameBuffer`, `_rt_8FrameBuffer`, `_rt_Bloom` | cadeia de bloom |
| `_rt_Reflection*` | reflexos |
| `_rt_shadowAtlas` | sombras |
| `_rt_link_<id>` | textura de **outro objeto** (composição entre camadas) |

**Por quê do ping-pong:** uma textura não pode ser lida e escrita no mesmo passe. Com duas, os efeitos encadeiam sem limite.
**Por quê de nomes globais:** materiais e efeitos são JSON. Um nome textual liga as peças sem código.

## Efeitos
Biblioteca em `assets/effects/` (água, nuvens, shake, iris, waterripple, blur, tint, pulse,
scroll, foliage sway, god rays, reflection, xray…) ✅ (pastas citadas pelas reimplementações).
Cada efeito = `effect.json` + passes → materiais → shaders. 🟡 Lista exata depende da versão do WE.

## Partículas ✅ (chaves de `wallpaper-scene-renderer/src/WPParticleParser.cpp`)
| Estágio | Módulos |
|---|---|
| **Emissor** | `boxrandom`, `sphererandom`, taxa, `distanceinner/outer`, `speedinner/outer`, `controlpoint` |
| **Inicializador** | `colorrandom`, `sizerandom`, `alpharandom`, `lifetimerandom`, `velocityrandom`, `rotationrandom`, `angularvelocityrandom`, `turbulentvelocityrandom` |
| **Operador** (por frame) | `movement` (gravity, drag), `angularmovement`, `alphafade` (fadein/out), `sizechange`, `alphachange`, `colorchange` (start/end), `oscillatealpha/size/position` (frequência, fase), `turbulence`, `vortex`, `controlpointattract` |
| **Renderizador** | sprite, rope/trail (🟡), spritesheet animado |
| Extras | `children` (sub-sistemas), `instanceoverride` (sobrescreve parâmetros por instância), `timescale` |

**Por quê da divisão:** é o modelo de Source Engine/Unity, e combinando poucos módulos saem milhares de efeitos.

## Câmera, luz e outros
- Câmera ortográfica (2D) ou perspectiva (3D), `fov/nearz/farz`, **parallax**, **shake**.
- Iluminação: luz ambiente e skylight, até N luzes (`g_LightsPosition/ColorRadius/ConeExponent/DirectionType`), sombras via atlas, névoa (distância/altura).
- **Puppet warp**: malha 2D deformada por ossos (`.mdl` + `animationlayers`), usada para "dar vida" a personagens desenhados.
