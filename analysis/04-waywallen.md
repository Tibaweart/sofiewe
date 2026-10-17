# 04 — Waywallen

`waywallen/waywallen@027e2dd` · Rust (daemon) + C++/Qt QML (UI) + Lua (plugins) · MIT · Linux

Sucessor do plugin KDE ([03](03-kde-scene-renderer.md)), do mesmo autor. É a arquitetura mais moderna
das nove, e com licença MIT dá para estudar sem medo.

## Arquitetura em três papéis
```
[renderer (processo)] --dma-buf--> [daemon waywallen] --dma-buf--> [display consumer]
   vídeo/imagem/cena                 roteamento, ciclo de vida        extensão KDE/GNOME
   via plugin Lua                    composição, recuperação          ou layer-shell
```
- **Daemon** (`src/daemon`, `src/wallframe/*`): `renderer_manager`, `routing`, `scheduler`,
  `dma`, `sync`, `ipc`, `display`. Gerencia quem renderiza o quê para qual tela.
- **Renderers**: executáveis separados por plugin (ex.: `waywallen-video-renderer`).
- **Displays** (repositório `waywallen-display`): um cliente pequeno por ambiente (extensão do
  KDE, extensão do GNOME, ou cliente `layer_shell` para Hyprland/Niri/Sway/COSMIC/Wayfire). Ele só
  importa buffers e reporta tamanho, input e janelas.
- **UI** (`ui/`): Qt/QML, conversa com o daemon por `proto/control.proto`.

**Por quê:** cada desktop Linux tem um jeito diferente de mostrar o fundo. Isolar isso num
"display" fino deixa o resto (decodificação, cena, playlists) igual para todos.

## Protocolo do display (`protocol/waywallen_display_v1.xml`, v9)
- Socket Unix em `$XDG_RUNTIME_DIR/waywallen/display.sock`. Cabeçalho `u16 opcode + u16 tamanho`, little-endian.
- File descriptors passados com `SCM_RIGHTS`.
- Fluxo: `hello` → `welcome` → `register_display` → `display_accepted` → `bind_buffers`
  (pool de N buffers dma-buf com fourcc/modifier/stride) → `frame_ready` (índice + **sync_file
  de aquisição** + **syncobj de liberação**).
- Input: `pointer_motion`, `pointer_button`, `pointer_axis` vão do display para o daemon.
- **Gerações monotônicas** (`buffer_generation`, `seq`): mensagens atrasadas de um estado antigo
  são descartadas. É resistente a corridas quando a resolução muda.
- Corpo "tagged" (tag + tipo + tamanho, tags desconhecidas ignoradas) para extensões compatíveis.
- `consumer_capabilities` (`:169`): formatos e modifiers aceitos + UUID da GPU. Se forem desconhecidos,
  o daemon assume caminho entre GPUs diferentes e usa memória visível ao host (conservador).

**Por quê da sincronização explícita:** sem fences, o display pode ler um buffer que a GPU ainda está
escrevendo (tearing/lixo). Com sync_file e syncobj, cada lado espera só o necessário.

## Pausa
O display recebe `window_observation_config` (`:152`), com listas de app-id e título para excluir
(com padrões `*`/`?`), e reporta o estado das janelas. Quem "vê" as janelas é o cliente do desktop,
que tem essa informação. O daemon só decide.

## Plugins (Lua)
`plugins/org.waywallen.video/main.lua`: `M.info()` declara capacidades (`source` com
tipos/scan/auto_detect, `wallpaper` com properties/apply) e i18n via `tr()`. O plugin pode baixar
renderers próprios (`install.lua`). Aviso no README: plugins são **código confiável** com as
permissões do usuário.

## Vídeo
Decodificação por hardware: fallback `vulkan → vaapi → sw`. Não há NVDEC dedicado. Usuários
NVIDIA usam `nvidia-vaapi-driver`.

## Lições para o nosso
1. Separar **produção de frames** de **exibição**, com um protocolo versionado.
2. Gerações monotônicas + mensagens "tagged" = protocolo que evolui sem quebrar.
3. Sincronização explícita ao compartilhar texturas.
4. Plugins declarativos (manifesto + capacidades). Se aceitarmos plugins de terceiros, tratar como código não confiável.
