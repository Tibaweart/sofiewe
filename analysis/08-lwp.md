# 08 — Layered WallPaper (lwp)

`jszczerbinsky/lwp@5d94c82` · C / SDL2 (+ GTK para configuração) · MIT · Windows, macOS, Linux

O mais didático: cerca de 3600 linhas no total.

## Arquitetura
- `src/core`: app residente (ícone na bandeja, janela de configuração GTK em `main.glade`) que
  descobre monitores e wallpapers e lança um processo `wlp` por monitor (`core/wlp.c`).
- `src/wlp`: o renderizador. Uma janela SDL2 por monitor.
- `src/common`: config, caminhos, scanner de monitores e de wallpapers.

## Formato do wallpaper (`wallpapers/default-fullhd/`)
Imagens numeradas `1.bmp … N.bmp` (do fundo para a frente) + `wallpaper.cfg` em texto:
`count=4; movement_x=0.05; movement_y=0.05; repeat_x=0; repeat_y=0;`
**Por quê:** qualquer pessoa cria um wallpaper com um editor de imagem, sem ferramenta própria.

## Host (`src/wlp/window.c`)
- Windows: `0x052C` + procura `WorkerW` + `SetParent` (`:51-56`). É a técnica clássica, sem o caso 24H2.
- Linux/X11: janela com `_NET_WM_WINDOW_TYPE_DESKTOP` (`:94`), que o gerenciador de janelas põe no fundo.
  Wayland só via XWayland (README).

## Parallax (`src/wlp/render.c`)
- Ponto alvo = posição do mouse no monitor (`targetPoint.c`).
- Ponto atual se aproxima do alvo com `lerp(atual, alvo, dt*4)` (`:18-21`), uma suavização exponencial
  independente de FPS.
- Cada camada `i` é deslocada por `ponto * movement * sensibilidade_i` (`:83-97`). Camadas da frente
  se mexem mais, o que dá a ilusão de profundidade.

## Lições para o nosso
1. Formato de conteúdo **simples e editável à mão** baixa a barreira para criadores.
2. Parallax por camadas + lerp = profundidade "3D" barata. Serve muito bem para um "quarto" em 2.5D.
3. Um processo por monitor simplifica DPI e resolução diferentes.
