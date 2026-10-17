# 05 — ScreenPlay

`kelteseth/ScreenPlay@7d23cf0` (GitLab) · C++23 / Qt 6 / QML · **AGPL-3.0 ou licença comercial** ·
Windows, macOS, Linux (Wayland)

> AGPL vale até para uso via rede. Não copiar nada. O repositório tem `CLAUDE.md` por módulo
> que explicam as "armadilhas". É ótimo material de **porquês**.

## Arquitetura (multi-processo)
| Módulo | Papel |
|---|---|
| `ScreenPlay/` | Gerenciador (a GUI que o usuário abre): timeline, monitores, configurações |
| `ScreenPlayWallpaper/` | **Processo de render, um por wallpaper**: vídeo, QML, HTML (Qt WebEngine), GIF, **Godot** |
| `ScreenPlayWidget/` | Processo de widgets (relógio, clima, sysinfo) |
| `ScreenPlaySDK/` | Cliente IPC dentro de cada processo de wallpaper/widget |
| `ScreenPlayWorkshop/` | Integração Steam Workshop |
| `ScreenPlayCore/` | Componentes compartilhados + lib de framing do IPC sem Qt |

## Host por plataforma (`ScreenPlayWallpaper/src/`)
- **Windows** (`windowsintegration.cpp:106`): procura uma `WorkerW` **filha de Progman** que *não*
  contenha `SHELLDLL_DefView` (já compatível com o layout 24H2). Se não houver, envia `0x052C` e tenta de novo.
- **Linux**: só Wayland via `wlr-layer-shell` (X11 não é suportado).
- **macOS** (`macintegration.mm:39`): janela no nível `kCGDesktopWindowLevel + 1`, com comportamento
  `CanJoinAllSpaces | Stationary | IgnoresCycle`, ou seja, aparece em todos os Spaces, não se move no
  Mission Control e fica fora do Cmd+Tab. O comportamento é reaplicado quando o sistema o reseta (`:11`).

## IPC (`ScreenPlaySDK/CLAUDE.md`)
- `QLocalSocket` (named pipe / socket Unix). Frames JSON delimitados por chaves + formato legado `;`
  (usado pelo wallpaper Godot).
- **Armadilhas documentadas** (o porquê de várias decisões):
  - Sockets locais **juntam e quebram** mensagens. Sempre usar um *frame buffer*, nunca `readAll()`.
  - `sendMessage` **não pode bloquear**: um processo filho travado com o pipe cheio congelou a GUI por 30 s.
  - Ping periódico para detectar processo morto. Log redirecionado vai embrulhado em JSON para não corromper o fluxo.

## Detalhes de render (`ScreenPlayWallpaper/CLAUDE.md`)
- **Crossfade com dois estados** (`currentState`/`targetState`). O estado (volume, fill mode, loop…)
  fica centralizado para sobreviver a um *crash-restart*.
- **Limitador de FPS** segura `UpdateRequest` numa grade de tempo absoluta. Exige o render loop
  "basic" do Qt, porque o loop threaded se auto-regula e ignoraria o filtro.
- Vídeo: reduz o trabalho do decodificador com `playbackRate = clamp(limite/fpsNativo, 0.1, 1.0)`.
- Qt WebEngine não tem caminho D3D12, então HTML cai para render por software em DX12.

## Design de processos (`DESIGN_state_sync_separation.md`)
Proposta de separar "**fatos**" (o processo está vivo? o socket conectou?), "**verbos**" aguardáveis
(start/replace/close que terminam num estado final) e "**decisões**" (monitor 2 deve mostrar B).
Lema: *"a camada 1 nunca sabe o porquê; a camada 2 nunca sabe o como"*. O documento nasceu de bugs
reais com polling (`isConnected` 50×50 ms).

## Lições para o nosso
1. Desenhar o IPC com framing robusto e envio **não bloqueante** desde o início.
2. Separar link/processo de lógica (verbos aguardáveis com timeout).
3. Estado do wallpaper serializável para reiniciar sem o usuário perceber.
4. Godot como motor de cena embutido é uma opção pronta para 3D, se não quisermos motor próprio.
