# Dissecação: Wallpaper Engine + 9 projetos

Estudo de como os principais "wallpapers animados" resolvem os mesmos problemas, para
basear o **nosso** produto (ver [`../docs/produto-quarto-geek.md`](../docs/produto-quarto-geek.md)).

## Regras deste diretório (clean room)

1. Aqui só entram **descrições com nossas palavras**: o que o código faz e **por que**.
2. **Nunca** colar código de terceiros (GPL/AGPL contaminam), pseudocódigo do Ghidra, binários ou
   assets da Workshop. Nomes de API do sistema (ex.: `SetParent`) e trechos de formato de arquivo
   são fatos, podem ser citados.
3. Toda afirmação aponta para a fonte: `projeto@commit:caminho:linha`.
4. O código do nosso produto é escrito a partir destas notas, não dos repositórios.

## Índice

| # | Programa | Plataforma | Linguagem | Licença | Nota |
|---|---|---|---|---|---|
| 00 | [Wallpaper Engine](00-wallpaper-engine.md) | Windows | C++ (fechado) | Proprietária | Referência; estudado via formatos, reimplementações e docs |
| 01 | [Lively Wallpaper](01-lively.md) | Windows | C# / .NET | GPL-3.0 | Melhor referência de **host Windows** |
| 02 | [linux-wallpaperengine](02-linux-wallpaperengine.md) | Linux | C++ / OpenGL | GPL-3.0 | Melhor referência do **motor de cenas do WE** |
| 03 | [wallpaper-scene-renderer (plugin KDE)](03-kde-scene-renderer.md) | Linux | C++ / Vulkan | GPL-2.0 | Segunda leitura do motor do WE, arquitetura de render moderna |
| 04 | [Waywallen](04-waywallen.md) | Linux | Rust + Qt/QML | MIT | Arquitetura **daemon + plugins + displays**, zero-copy |
| 05 | [ScreenPlay](05-screenplay.md) | Win/macOS/Linux | C++23 / Qt6 | AGPL-3.0 ou comercial | Multiplataforma real, multi-processo |
| 06 | [mpvpaper](06-mpvpaper.md) | Linux Wayland | C | GPL-3.0 | Mínimo viável: vídeo como wallpaper |
| 07 | [Plash](07-plash.md) | macOS | Swift | **Fechado hoje** | Código removido; só comportamento |
| 08 | [Layered WallPaper (lwp)](08-lwp.md) | Win/macOS/Linux | C / SDL2 | MIT | Parallax simples, didático |
| 09 | [RePKG](09-repkg.md) | — | C# | MIT | Formatos `.pkg` / `.tex` do WE |
| 10 | [**Síntese → nossas decisões**](10-sintese.md) | | | | O que levamos de cada um |

Commits estudados (2026-10-17): lively `25a0a5f`, linux-wallpaperengine `b016d7d`,
wallpaper-scene-renderer `8dde7e7`, waywallen `027e2dd`, ScreenPlay `7d23cf0`,
mpvpaper `fc5ed28`, Plash `79728c9`, lwp `5d94c82`, repkg `8005eb2`.

## Matriz: como cada um resolve os problemas centrais

| Problema | WE | Lively | linux-WE | KDE/Waywallen | ScreenPlay | mpvpaper | lwp |
|---|---|---|---|---|---|---|---|
| Ficar atrás dos ícones | WorkerW | WorkerW (+ caminho Win11 24H2) | X11 root / wlr-layer-shell | Extensão do DE / layer-shell | WorkerW / layer-shell / `kCGDesktopWindowLevel+1` | layer-shell | WorkerW / `_NET_WM_WINDOW_TYPE_DESKTOP` |
| Isolamento | processo por tipo | **1 processo por wallpaper** + watchdog | 1 processo | renderer ↔ daemon ↔ display | 1 processo por wallpaper/widget | 1 processo | 1 processo por monitor |
| Pausar | tela cheia/foco/bateria | timer 500 ms + 4 algoritmos | — | observação de janelas pelo display | via manager | **frame callback "deadman"** | — |
| Web | CEF | WebView2 (ou CEF) | CEF | plugin | Qt WebEngine | — | — |
| Vídeo | próprio | mpv / VLC / WMF | mpv | Vulkan Video / VA-API | Qt Multimedia | libmpv | — |
| Cena | D3D11, GLSL→HLSL | — | OpenGL, GLSL→SPIR-V→GLSL | Vulkan + render graph | Godot | — | SDL2 camadas |
| Áudio reativo | WASAPI loopback, 16/32/64 bandas | WASAPI → JS | PulseAudio + kissfft | — | — | — | — |
| API p/ conteúdo | `wallpaperRegisterAudioListener`… | `livelyAudioListener`… | compatível WE | Lua plugins | ScreenPlaySDK | — | — |
