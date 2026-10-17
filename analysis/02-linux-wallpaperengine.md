# 02 — linux-wallpaperengine

`Almamu/linux-wallpaperengine@b016d7d` · C++ / OpenGL · GPL-3.0 · Linux

Reimplementação que **roda wallpapers do WE** (scene, vídeo, web). É a melhor fonte para
entender o motor de cenas. **Depende dos `assets/` do WE original** (shaders base, efeitos):
o usuário precisa ter o WE comprado (README:79–110). Ou seja, os shaders "do sistema" são
conteúdo proprietário e não estão no repositório.

## Organização (`src/WallpaperEngine/`)
| Pasta | Papel |
|---|---|
| `Data/Parsers` | Um parser por formato: Package, Texture, Project, Object, Material, Effect, Model, Shader constants, Property |
| `Data/Model` | Modelo em memória, separado do render (permite testes e dumps) |
| `FileSystem/Adapters` | Sistema de arquivos virtual: diretório, `.pkg`, virtual (arquivos gerados em runtime) |
| `Render/Wallpapers` | `CScene`, `CVideo` (mpv), `CWeb` (CEF) |
| `Render/Objects` | `CImage`, `CParticle` (2323 linhas, a maior parte), `CText`, `CSound` |
| `Render/Objects/Effects/CPass` | Um passe de efeito = shader + entradas + saída |
| `Render/Shaders` | Pré-processador + glslang + SPIRV-Cross |
| `Render/Drivers/Output` | GLFW (janela), X11 (root window), Wayland (layer-shell) |
| `Audio` | Captura PulseAudio + FFT (kissfft) |
| `Scripting` | QuickJS emulando o SceneScript |

**Por quê da separação Data/Render:** o parser pode ser testado e "dumpado" sem GPU
(`Data/Dumpers`, `Testing/`), e o render só consome um modelo já validado.

## Fluxo de uma cena
1. `project.json` → tipo → abre `scene.pkg` pelo FS virtual (`PackageParser.cpp:15`, header
   `PKGV`, lista `{nome, offset, tamanho}`).
2. `scene.json` → objetos. `CScene` (`Render/Wallpapers/CScene.cpp`):
   - Câmera ortográfica, com tamanho automático se `isAuto` (`:41`).
   - Cria render targets globais: `_rt_shadowAtlas` (`:82`) e, para o bloom, `_rt_4FrameBuffer`,
     `_rt_8FrameBuffer` e `_rt_Bloom` (`:103-113`).
   - **Ordena objetos por dependência** (`addObjectToRenderOrder`, `:262`): um objeto que usa
     outro como textura precisa ser desenhado depois.
   - O bloom original do WE desenha direto na tela. Aqui ele vira um objeto imagem sintético com efeito
     JSON (`:117-165`), porque a reimplementação nunca desenha na tela a partir da cena.
3. `renderFrame` (`:300`): atualiza o mouse, calcula o **parallax** com suavização
   (`mix(atual, mouse*amount*influence, delay*dt)`), roda um *tick* do JS, atualiza texturas
   animadas e desenha os objetos na ordem.

## Shaders
`Render/Shaders/ShaderUnit.cpp`:
- Lê linha a linha: `// [COMBO] {json}` define variantes (`:101`). Uniform seguido de
  `// {json}` é exposto ao material/editor (`:114`).
- Resolve `#include` (sem includes aninhados, `:173`) e troca `gl_FragColor` pelo equivalente moderno.
- Compila com **glslang → SPIR-V → SPIRV-Cross → GLSL** atual (as versões vendorizadas em `External/`
  são forks "WallpaperEngine"). **Por quê:** os shaders do WE são GLSL 1.20 com extensões do WE.
  Passar por SPIR-V normaliza tudo para um GLSL que drivers modernos aceitam.

## Texturas
`Data/Parsers/TextureParser.cpp`: valida `TEXV0005`/`TEXI0001` (`:185`), aceita `TEXB0001-0004`
(`:213`), descomprime mipmaps com `LZ4_decompress_safe` (`:80`), lê frames `TEXS0001-0003` de
GIF/spritesheet (`:244`) e deduz a grade do spritesheet (`:275`).

## Áudio
`Audio/Drivers/Recorders/PulseAudioPlaybackRecorder.cpp`: buffer circular do monitor do PulseAudio,
`kiss_fftr` (`:242`), agrupamento logarítmico em **64 bandas** (`:246`, depois 32 e 16) e
suavização `movetowards(atual, alvo, 0.3)` por frame (`:219`). **Por quê da suavização:** sem
ela as barras "piscam". O WE expõe valores já suavizados.

## Saída
- Wayland: `zwlr_layer_shell_v1` na camada BACKGROUND (`WaylandOpenGLDriver.cpp:117`).
- X11: desenha na root window.

## Lições para o nosso
1. **FS virtual** que abstrai diretório/pacote: o mesmo código lê o modo de desenvolvimento e o pacote final.
2. Separar **modelo de dados** de **render**, com testes de parser sem GPU.
3. Grafo de dependências entre objetos da cena.
4. Metadados de UI dentro do próprio shader/asset: um arquivo só para o criador.
5. Se tivermos shaders de usuários, compilar via SPIR-V para portabilidade.
