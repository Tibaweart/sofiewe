# 03 — wallpaper-engine-kde-plugin + wallpaper-scene-renderer

`catsout/wallpaper-engine-kde-plugin@ca50d24` (GPL-2.0) + submódulo
`catsout/wallpaper-scene-renderer@8dde7e7` · C++ / Vulkan · Linux/KDE

> Os dois repositórios agora dizem *"Moved to"*: o plugin foi para **Waywallen** ([04](04-waywallen.md))
> e o renderer para `waywallen/open-wallpaper-engine`. Estudamos a versão arquivada porque ela é
> uma segunda reimplementação independente do motor do WE, com arquitetura diferente do linux-WE.

## Arquitetura
- **Plugin KDE** (`plugin/contents/ui/*.qml` + `src/plugin.cpp`): UI de configuração em QML, lista de
  wallpapers, `PowerSource.qml` (bateria), `WindowModel.qml` (janelas → pausa), `MouseGrabber`.
  Backends: `backend_mpv` (vídeo) e `backend_scene` (o submódulo).
- **Renderer** (`src/`): `WPSceneParser`, `WPShaderParser`, `WPTexImageParser`, `WPMdlParser`,
  `WPParticleParser`, que geram um `Scene` genérico. Um **RenderGraph** decide os passes, e o
  `VulkanRender` executa.

## Ideias que diferem do linux-WE
1. **Render graph** (`src/RenderGraph/`: `DependencyGraph`, `PassNode`, `TexNode`): os passes declaram
   quais texturas leem e escrevem. O grafo ordena, elimina passes inúteis e decide quando reusar
   render targets. **Por quê:** as cenas do WE têm dezenas de efeitos em ping-pong, e alocar um FBO por
   efeito estoura a VRAM. O grafo permite *aliasing* de memória.
2. **Thread de render separada + triple buffer sem lock** (`src/Swapchain/TripleSwapchain.hpp`):
   três ponteiros atômicos (`presented`, `ready`, `inprogress`). O renderer troca `inprogress↔ready`
   ao terminar um frame, e o consumidor troca `ready↔presented` quando quer exibir. **Por quê:** o
   Plasma (Qt) e o renderer nunca se bloqueiam. Se o Qt atrasar, o renderer não espera, e
   vice-versa.
3. **Imagem Vulkan exportada por file descriptor** (`ExSwapchain.hpp`, campo `fd`): o Qt importa a
   mesma memória da GPU. É zero-copy entre a API Vulkan do renderer e o OpenGL/RHI do Plasma.
4. **Looper** (`src/Looper`): fila de mensagens no estilo Android para mandar comandos à thread de render.

## Documentação útil (`wpdoc/`)
Trechos da documentação oficial do WE, preservados:
- `shader.md`: *"GLSL 1.20 … traduzido dinamicamente para HLSL e compilado como shader model 3.0"*,
  o JSON dos uniforms (`material`, `type: color`, `default`, `range`) e o layout dos atributos de partícula.
- `texture.md`: o porquê de cada opção (DXT5 usa 1 byte/pixel de VRAM contra 4 do RGBA. Desativar mipmaps
  só em fundos grandes 2D. Point filter para pixel art).
- `scenejson.md`: campos de modelos, texturas e materiais (blending, depth, `combos`, `usershadervalues`).

## Lições para o nosso
1. Se tivermos efeitos encadeados, usar **render graph** desde o início.
2. **Render em thread própria + triple buffer**: a UI nunca trava o wallpaper.
3. Compartilhar a textura da GPU entre processos (fd/dma-buf no Linux, *shared handle* DXGI no Windows)
   em vez de copiar pixels.
