---
name: wallpaper-re
description: Roteiro clean-room para dissecar wallpapers animados (Wallpaper Engine e alternativas open source como Lively, linux-wallpaperengine, Waywallen, ScreenPlay, mpvpaper, lwp, RePKG) e registrar o que fazem e por quê em analysis/. Use ao estudar código de terceiros, ao analisar o binário do Wallpaper Engine com GhidraMCP, ou ao atualizar as notas de análise.
---

# Engenharia reversa de wallpapers animados (clean room)

## Regras invioláveis
1. Notas em `analysis/` só com **descrições nossas**: o que faz + **por que** + fonte `projeto@commit:arquivo:linha`.
2. Nunca colar no repositório código de terceiros (GPL/AGPL), pseudocódigo do Ghidra, binários,
   `.pkg`/`.tex` ou assets da Workshop. Nomes de API do SO e layouts de formato são fatos e podem entrar.
3. O código do produto (fora de `analysis/`) é escrito a partir das notas, nunca copiando dos repositórios.
4. Distinga ✅ confirmado (código/doc), 🟡 inferido, ❓ a investigar.

## Projetos open source (clonar FORA do repositório, ex.: no scratchpad)
| Projeto | URL | Focar em |
|---|---|---|
| Lively | github.com/rocksdanister/lively | `src/Lively/Lively/Core/WinDesktopCore.cs`, `Core/Suspend/Playback.cs`, `Core/Wallpapers/*`, `Views/WindowMsg/RawInputMsgWindow.xaml.cs` |
| linux-wallpaperengine | github.com/Almamu/linux-wallpaperengine | `docs/`, `src/WallpaperEngine/Data/Parsers/*`, `Render/Wallpapers/CScene.cpp`, `Render/Shaders/ShaderUnit.cpp` |
| wallpaper-scene-renderer | github.com/catsout/wallpaper-scene-renderer | `wpdoc/`, `src/RenderGraph`, `src/Swapchain` |
| Waywallen | github.com/waywallen/waywallen | `protocol/*.xml`, `src/wallframe/*`, `plugins/*` |
| ScreenPlay | gitlab.com/kelteseth/ScreenPlay | `CLAUDE.md` de cada módulo, `ScreenPlayWallpaper/src/*integration*` |
| mpvpaper | github.com/GhostNaN/mpvpaper | `src/main.c` (render mpv, auto-pause), `src/holder.c` |
| lwp | github.com/jszczerbinsky/lwp | `src/wlp/window.c`, `src/wlp/render.c` |
| RePKG | github.com/notscuffed/repkg | `RePKG.Application/Package`, `RePKG.Application/Texture` |

Ao reestudar, registre o novo commit em `analysis/README.md` e atualize as linhas citadas.

## Modelo de nota por subsistema
```
### <Subsistema>
O quê: <comportamento em 1-3 frases>
Como: <passos, APIs do SO, estruturas de dados>
Por quê: <restrição/trade-off que explica a escolha>
Fonte: <projeto@commit:arquivo:linha>
Lição para o nosso: <decisão>
```

## Wallpaper Engine com GhidraMCP (só no PC do usuário, ver docs/setup-ghidra.md)
Trabalhe por subsistema, sempre partindo de uma âncora:
| Subsistema | Âncora |
|---|---|
| Host desktop | strings `WorkerW`, `Progman`, `SHELLDLL_DefView`; imports `SendMessageTimeoutW`, `SetParent`, `SetWinEventHook` |
| Pacote | string `PKGV` |
| Textura | strings `TEXV0005`, `TEXI0001`, `TEXB`, `TEXS`; import/código LZ4 |
| Render | imports `D3D11CreateDevice`, `CreateSwapChain*`, `D3DCompile` (tradução GLSL→HLSL) |
| Pausa | `GetForegroundWindow`, `MonitorFromWindow`, `SHQueryUserNotificationState`, `GetSystemPowerStatus` |
| Áudio | `IAudioClient`, `AUDCLNT_STREAMFLAGS_LOOPBACK` |
| Web | imports de `libcef.dll`, strings `wallpaperRegisterAudioListener` |
| Classes | RTTI MSVC (`.?AV…@@`), que dá nomes de classe e hierarquia |

Fluxo por função: descompilar → renomear (`FUN_…` → nome descritivo) → comentar no Ghidra →
resumir na nota (sem pseudocódigo). Comece pelas perguntas ❓ de `analysis/00-wallpaper-engine.md`.
