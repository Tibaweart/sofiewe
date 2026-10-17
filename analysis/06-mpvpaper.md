# 06 — mpvpaper

`GhostNaN/mpvpaper@fc5ed28` · C · GPL-3.0 · Linux Wayland (wlroots)

O "mínimo viável" de um wallpaper de vídeo: cerca de 1500 linhas em `src/main.c`.

## Como funciona
1. Conecta ao Wayland e cria uma *layer surface* (`zwlr_layer_shell_v1`) na camada BACKGROUND para cada saída.
2. Cria um contexto EGL/OpenGL e um `mpv_render_context` (`main.c:163`): o mpv decodifica e desenha
   direto no FBO da surface (`MPV_RENDER_PARAM_OPENGL_FBO`, `FLIP_Y`,
   `BLOCK_FOR_TARGET_TIME=0` para não travar a thread esperando o horário do frame).
3. Desenha só quando o compositor pede, via `wl_surface_frame` (`:186`).
4. `holder.c` (`mpvpaper-holder`): no modo `--auto-stop`, em vez de só pausar, o mpvpaper **encerra
   e faz `execv` para um "porteiro" enxuto** (`main.c:265`) sem mpv nem GL, que só observa a
   visibilidade e a lista de apps e, quando pode voltar, faz `execv` de volta para o mpvpaper
   (`holder.c:69`). **Por quê:** pausar mantém decodificador e VRAM ocupados. Trocar a imagem do
   processo libera tudo, e é a versão Linux do "parar (liberar memória)" do WE.

## Pausa: o truque do "deadman switch"
`handle_auto_pause` (`:367`): numa thread, zera `frame_ready` e espera. Se o compositor **não**
mandar frame callback dentro do prazo, a surface não está visível (coberta por janela em tela
cheia, por exemplo) e o vídeo pausa. Quando os callbacks voltam, despausa.

**Por quê:** no Wayland um cliente não pode listar as janelas dos outros (segurança). Mas o
compositor para de pedir frames de surfaces invisíveis, e esse silêncio vira o sinal de oclusão.
Custo zero e nenhuma heurística.

Outros motivos de pausa são agregados (`update_mpv_pause_state`, `:284`): lista de apps
(`pauselist`, checada numa thread rodando `pidof <app>`, `:320`), usuário e "full". O mpv só recebe comando quando o
estado agregado **muda**.

## Lições para o nosso
1. **libmpv** resolve vídeo (decodificação por hardware, formatos, loop) com pouquíssimo código.
2. Usar sinais de visibilidade do próprio sistema quando existem (frame callbacks no Wayland,
   oclusão no macOS) em vez de heurísticas.
3. Várias fontes de pausa → um estado agregado → um comando só quando muda.
