# 10 — Síntese: o que levamos de cada um

## Os 7 problemas que todo wallpaper animado resolve

| # | Problema | Melhor solução observada | De quem | Decisão para o nosso |
|---|---|---|---|---|
| 1 | Desenhar atrás dos ícones | WorkerW com **dois caminhos** (clássico e Win11 24H2) + hook de recriação | Lively, ScreenPlay | Implementar os dois caminhos + `EVENT_OBJECT_DESTROY` desde o dia 1 |
| | macOS | Janela `kCGDesktopWindowLevel + 1`, todos os Spaces, estacionária | ScreenPlay, Plash | Igual |
| | Linux | `wlr-layer-shell` (wlroots) / extensão do DE (KDE/GNOME) | mpvpaper, Waywallen | Fase posterior |
| 2 | Não pesar no PC | Pausa por **estado agregado**: timer 250–500 ms + `SHQueryUserNotificationState` + bateria/bloqueio/RDP; sinais nativos de visibilidade quando existem | Lively, mpvpaper | Igual. Além disso, **"parar e liberar memória"** encerrando o processo de render |
| 3 | Robustez | **Um processo por wallpaper** + watchdog + estado serializável para reiniciar | Lively, ScreenPlay, Waywallen | Core + renderer separados, IPC não bloqueante |
| 4 | Conteúdo web | WebView2 (Win) / WKWebView (mac): leve e atualizado pelo sistema | Lively, Plash | O "quarto" é uma página web |
| 5 | Interatividade | Raw Input com `INPUTSINK`, repassado só com a área de trabalho em foco | Lively | Igual (fase 2) |
| 6 | Conteúdo reativo | API JS: propriedades, áudio (FFT suavizada, 64 bandas), música tocando, estado de play/pause | WE, Lively, linux-WE | API `sofie.*` própria (ver produto) |
| 7 | Formato de conteúdo | Manifesto JSON + assets. Metadados de UI junto do asset. Parsers com limites | WE, lwp, RePKG | Manifesto do quarto em JSON, versionado |

## Ideias avançadas para depois
- Render graph + triple buffer em thread própria (KDE renderer), se um dia tivermos motor nativo.
- Protocolo versionado com gerações monotônicas e campos "tagged" (Waywallen) para o IPC core↔renderer.
- Separar "fatos / verbos / decisões" no gerenciador de processos (ScreenPlay).
- Zero-copy de textura entre processos (dma-buf / DXGI shared handle).

## O que **não** copiar
- Formatos proprietários do WE como formato nosso. Ler para importar é aceitável. Adotar como base nos prende a decisões de 2016 (GLSL 1.20, SM3).
- CEF embutido: instalador de mais de 100 MB e atualizações de segurança por nossa conta.
- Workshop da Steam como única distribuição.

## Fase 2 (Ghidra no WE)
Só para as perguntas ❓ de [00](00-wallpaper-engine.md). Nenhuma delas bloqueia o MVP.
