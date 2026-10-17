# 00 — Wallpaper Engine (referência fechada)

**Status do conhecimento:** ✅ confirmado por reimplementações/docs · 🟡 inferido · ❓ a investigar com Ghidra
(roteiro em [`../docs/setup-ghidra.md`](../docs/setup-ghidra.md)).

## Visão geral

App C++ para Windows, vendido na Steam (appid 431960). Quatro tipos de wallpaper: **scene**
(motor próprio), **video**, **web** (CEF) e **application** (exe arbitrário). Distribuição via
Steam Workshop: cada item vive em `steamapps/workshop/content/431960/<id>/` com um `project.json`.

## Subsistemas

### 1. Host na área de trabalho ✅
Mesma técnica WorkerW documentada no Lively ([01](01-lively.md#1-ficar-atrás-dos-ícones)):
mensagem `0x052C` para `Progman`, localizar a `WorkerW` irmã do `SHELLDLL_DefView`, `SetParent`.
❓ Como o WE trata o novo layout do Windows 11 24H2 (Progman com `WS_EX_NOREDIRECTIONBITMAP`).

### 2. Pacote `scene.pkg` ✅
Formato trivial (fontes: linux-WE `PackageParser.cpp:15`, RePKG `PackageReader.cs`):
```
string32  magic         "PKGV00xx"   (u32 tamanho + bytes)
u32       count
count x { string32 path; u32 offset; u32 length }
dados...  (offset é relativo ao FIM do cabeçalho)
```
**Por quê:** sem compressão nem índice hash → leitura por `seek` direto, carregamento rápido;
compressão fica a cargo de cada asset (texturas usam LZ4).

### 3. Textura `.tex` ✅
Gerada pelo `resourcecompiler.exe` do editor (linux-WE `docs/textures/TEXTURE_FORMAT.md`,
`TextureParser.cpp`; RePKG `TexImageReader.cs`):
- Cabeçalho `TEXV0005` + `TEXI0001`, depois: formato (0 RGBA8888, 4 DXT5, 6 DXT3, 7 DXT1,
  8 RG88, 9 R8 — versões novas adicionam BC7, float16…), flags (1 sem interpolação, 2 clamp UV,
  4 é GIF), tamanho da textura (potência de 2) e tamanho real da imagem.
- Container `TEXB0001..0004`: lista de mipmaps; cada um com largura, altura, flag LZ4,
  tamanho descomprimido e bytes. Em `TEXB0003+` um campo "FreeImage format": se ≠ desconhecido,
  os bytes são um **arquivo de imagem embutido** (PNG/JPG) em vez de pixels crus.
- Se flag GIF: bloco `TEXS0001..0003` com frames (posição no spritesheet + tempo por frame).

**Por quê:** DXT/BC é o formato nativo da GPU (upload sem decodificar, 4–8× menos VRAM);
LZ4 descomprime a GBs/s, então o custo de disco cai sem custo de CPU perceptível; GIF vira
spritesheet para animar só trocando UV no shader.

### 4. Cena (`scene.json`, materiais, shaders) ✅
- `scene.json`: `camera` (projeção ortográfica/perspectiva, parallax, bloom), `general`
  (cor ambiente, bloom…), `objects` (imagens, partículas, sons, textos, luzes, modelos).
- Cada objeto imagem é um quad com **duas render targets em ping-pong**
  (`_rt_imageLayerComposite_<id>_a/b`): cada efeito lê uma e escreve na outra.
- Render targets especiais: `_rt_FullFrameBuffer` (o que já foi desenhado), cadeias
  `_rt_4FrameBuffer`/`_rt_8FrameBuffer`/`_rt_Bloom` (1/4 e 1/8 da resolução) para bloom.
- Materiais: blending, depth, cull, shader, texturas, `combos` (defines), valores de uniform.
- Shaders: **GLSL 1.20 traduzido em tempo real para HLSL SM3.0** (docs oficiais citadas em
  wallpaper-scene-renderer `wpdoc/shader.md`). Metadados vivem em **comentários**:
  `// [COMBO] {...}` declara variantes; `uniform ... ; // {"material":"…","default":…,"range":[…]}`
  liga o uniform à UI do editor.

**Por quê dos comentários:** o arquivo continua GLSL válido (qualquer ferramenta abre), e o
editor gera a interface automaticamente lendo o próprio shader → criadores escrevem um arquivo só.
**Por quê de GLSL→HLSL:** escrever em GLSL, mais conhecido pela comunidade, e rodar em D3D,
o driver mais estável no Windows.

### 5. Áudio ✅
WASAPI loopback → FFT → espectro suavizado. API web expõe 128 valores (64 por canal).
Shaders recebem `g_AudioSpectrum16/32/64Left/Right` (linux-WE implementa 16/32/64 bandas,
`PulseAudioPlaybackRecorder.cpp:246`).

### 6. Web ✅ · Vídeo 🟡 · Application ✅
- Web: CEF. API JS: `wallpaperRegisterAudioListener`, `wallpaperPropertyListener.applyUserProperties`,
  `wallpaperRegisterMediaPropertiesListener` etc.
- Vídeo: player próprio com decodificação por hardware 🟡 (❓ qual backend).
- Application: encaixa a janela de um exe no WorkerW.

### 7. SceneScript ✅
JavaScript para lógica de objetos (linux-WE usa QuickJS para emular, `Scripting/`).
Funções por propriedade (`update(value)`), módulos de cor e matemática.

### 8. Pausa / desempenho 🟡
Regras por app em foco / maximizado / tela cheia, bateria, limite de FPS. ❓ Algoritmo exato de
detecção e o que "parar (liberar memória)" descarrega.

## O que vale investigar com Ghidra (fase 2)
1. Caminho Win11 24H2 do host. 2. Heurística de pausa. 3. Pipeline de vídeo. 4. Cache de shaders
traduzidos (onde e como invalida). 5. Como o editor serializa `scene.json` (campos ainda "unknown"
nos formatos acima).
