# 01 — Lively Wallpaper

`rocksdanister/lively@25a0a5f` · C# / .NET · GPL-3.0 · Windows

## Arquitetura

Vários processos:
- **Core** (`src/Lively/Lively`): serviço residente que controla o desktop, as regras de pausa e o ciclo de vida.
- **UI** (`Lively.UI.WinUI`): processo separado que fala com o Core por **gRPC**
  (`Lively.Grpc.Common/Proto/*.proto`: commands, display, settings, wallpaper, update).
- **Players**, **um processo por wallpaper**: `Lively.Player.WebView2`, `Lively.Player.CefSharp`,
  `Lively.Player.Vlc`, `Lively.Player.Wmf` (Media Foundation), mpv. O Core lança cada um e
  conversa por **stdin/stdout com mensagens JSON** (`WebWebView2.cs:87` cria o processo, `:142` escreve no stdin).
- **Watchdog** (`Lively.Utility.Watchdog`): mata os players se o Core morrer.

**Por quê:** se um wallpaper web travar ou vazar memória, só aquele processo cai. A UI pode
ser fechada inteira (economiza RAM) enquanto o wallpaper continua. O watchdog evita
processos órfãos desenhando na área de trabalho.

## 1. Ficar atrás dos ícones

`Core/WinDesktopCore.cs:147` (`SetupDesktopLayer`):
1. Localiza `Progman`.
2. **Detecta o layout novo do Windows 11 24H2** (`:173`): se `Progman` tem
   `WS_EX_NOREDIRECTIONBITMAP`, o desktop "levantado" agora é *filho* de Progman
   (Progman → `SHELLDLL_DefView` em camadas + `WorkerW` filho), e não mais janelas de topo irmãs.
   O comentário reproduz a orientação da Microsoft: criar uma janela `WS_EX_LAYERED` (alpha 0xFF)
   entre o DefView e o WorkerW para apresentar via DirectX sem perder desempenho.
3. Envia `0x052C` (wParam `0xD`, lParam `0x1`) com `SendMessageTimeout` de 1 s (`:180`).
4. Layout clássico: `EnumWindows` até achar a janela que contém `SHELLDLL_DefView` e pega a
   **próxima** `WorkerW` (`:199`). Layout 24H2: `FindWindowEx(progman, "WorkerW")` (`:227`).
5. Windows 7: esconde a WorkerW e usa o próprio Progman (`:233`).

**Recuperação:** um *WinEventHook* observa `EVENT_OBJECT_DESTROY` da WorkerW (`:249`). Quando o
Explorer reinicia ou troca o wallpaper estático, a WorkerW é destruída e o Lively refaz o layer e
reposiciona as janelas, em vez de sumir.

**Multi-monitor:** `TrySetWallpaperPerScreen` (`:516`) posiciona a janela em coordenadas da tela, converte
para coordenadas da WorkerW (`MapWindowPoints`) e então faz `SetParent`. Também existe o modo "span" (uma janela cobre todas as telas).

## 2. Pausa automática

`Core/Suspend/Playback.cs`:
- **Timer de 500 ms** (`SettingsModel.cs:173`), em vez de WinEventHook. O próprio código explica
  (`:53`): `EVENT_OBJECT_LOCATIONCHANGE` gera ruído demais e não é confiável em alguns sistemas.
- Primeiro checa o **estado do sistema** (`:400`): tela de bloqueio, sessão remota (RDP), bateria
  e economia de energia.
- Depois um de **4 algoritmos** (`:129`):
  - `foreground`: só a janela em foco. Pausa se ela estiver maximizada ou em tela cheia no monitor dela.
  - `all`: qualquer janela visível que cubra a área de trabalho.
  - `grid`: divide a tela em blocos e pausa se X% estiver coberto (janelas lado a lado).
  - `gamemode`: pergunta ao shell via `SHQueryUserNotificationState` e pausa só em
    `QUNS_RUNNING_D3D_FULL_SCREEN` (jogo D3D exclusivo em tela cheia) (`:337`). É barato e
    não precisa enumerar janelas.
- Por monitor ou global (`DisplayPause.perdisplay/all`).
- Áudio: muta quando não está na área de trabalho (`AudioOnlyOnDesktop`).
- Exceções por app (`IsPauseRuleApp`): sempre pausar ou nunca pausar.

**Por quê de vários algoritmos:** não existe sinal único confiável de "o wallpaper está visível"
no Windows. Cada heurística erra em casos diferentes, então o usuário escolhe.

## 3. Wallpapers web

- **WebView2** como padrão (já vem com o Windows, atualiza sozinho). CefSharp como alternativa.
- Ponte JS chamando funções globais da página: `livelyPropertyListener(nome, valor)`,
  `livelyAudioListener(array)`, `livelyCurrentTrack(json)`, `livelySystemInformation(json)`,
  `livelyWallpaperPlaybackChanged(...)` (`Lively.Player.CefSharp/Form1.cs:238-499`).
- Propriedades declaradas em `LivelyProperties.json` viram controles na UI (slider, cor, dropdown, arquivo, botão).
- Observação no código (`WinDesktopCore.cs:313`): instâncias de WebView2 com a mesma pasta UserData
  compartilham o processo de render e às vezes começam pausadas. Por isso ele fecha antes de abrir.

## 4. Entrada de mouse/teclado

A janela do wallpaper fica atrás dos ícones e não recebe input. Solução: **Raw Input** com
`RIDEV_INPUTSINK` (`Views/WindowMsg/RawInputMsgWindow.xaml.cs:42`), que recebe eventos mesmo sem foco.
O Core repassa cliques, movimento e roda para a janela interna do Chromium (`Chrome_WidgetWin_1`,
localizada em `WebWebView2.cs:276`) só quando a área de trabalho está em foco.

## Lições para o nosso
1. **Um processo por wallpaper + watchdog**: robustez quase de graça.
2. Tratar **desde o dia 1** o layout do Windows 11 24H2 e a recriação da WorkerW.
3. Pausa por timer simples (250–500 ms) + regras de sistema. É bom o suficiente e previsível.
4. WebView2 > CEF no Windows (instalador menor, segurança atualizada pela Microsoft).
5. Raw Input para interatividade.
