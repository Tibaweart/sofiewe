# Produto: "Quarto Geek" como fundo de tela

> Rascunho a partir das análises em [`../analysis/`](../analysis/). Decisões confirmadas pelo time
> em 2026-10-17 estão na seção "Decisões".

## A ideia
1. A pessoa baixa o app (**Windows e macOS**).
2. Digita o **@handle** ou o **ID** do personagem/conta no universo Loom.
3. O app baixa o **quarto geek** dela e o mostra **ao vivo atrás dos ícones** da área de trabalho.
4. Quando ela muda o quarto na conta, o fundo de tela atualiza sozinho.

## Arquitetura proposta

```
┌─────────────── App (Tauri v2 / Rust) ────────────────┐
│ Core (bandeja)                                        │
│  • login Loom ID   • cache offline   • regras pausa   │
│  • host desktop (WorkerW / macOS desktop level)       │
│  • watchdog                                           │
└──────────┬──────────────────────────────▲─────────────┘
           │ IPC JSON (não bloqueante)    │ estado/eventos
┌──────────▼──────────────────────────────┴─────────────┐
│ Renderer (processo separado, 1 por monitor)           │
│  WebView2 / WKWebView → página do quarto (Three.js)   │
│  API window.sofie.* (propriedades, áudio, play/pause) │
└───────────────────────────────────────────────────────┘
                    ▲ HTTPS
            API Loom: @handle→ID, GET /rooms/{id} → manifesto
```

### Por que essas escolhas (ligadas às análises)
| Escolha | Motivo | Fonte |
|---|---|---|
| **Quarto = página web** (Three.js ou 2.5D em camadas) | O mesmo código roda no app, no site e no celular. Web é a forma mais rápida de iterar | Plash, Lively |
| **Tauri v2** | Usa o WebView do sistema (instalador de ~10 MB contra ~150 MB do Electron/CEF). Rust para as chamadas Win32/Cocoa | Lively (WebView2 > CEF) |
| **Renderer em processo separado** | Um quarto travado não derruba o app. Permite "parar e liberar memória" | Lively, ScreenPlay, mpvpaper |
| **Host com 2 caminhos WorkerW + hook** | Windows 11 24H2 mudou o layout do desktop | Lively `WinDesktopCore.cs:147` |
| **Pausa agregada (timer 500 ms + D3D fullscreen + bateria/bloqueio)** | Consumo perto de zero em jogos e em tela cheia | Lively, mpvpaper |
| **Cache offline do manifesto e dos assets** | Abre sem internet. A API só é consultada para checar versão | — |
| **Parallax por camadas como modo leve** | Profundidade "3D" com custo mínimo de GPU em PCs fracos | lwp |

## Manifesto do quarto (exemplo inicial, nosso formato)
```json
{
  "format": "sofie.room/1",
  "loomId": 123456,
  "handle": "@fulano",
  "version": 42,
  "theme": { "ambient": "#1b1036", "time": "night" },
  "camera": { "mode": "isometric", "parallax": 0.04 },
  "items": [
    { "id": "desk",   "asset": "assets/desk.glb",  "pos": [0, 0, 0] },
    { "id": "poster", "asset": "assets/poster.webp", "pos": [1.2, 1.5, -2], "link": "https://…" },
    { "id": "pc",     "asset": "assets/pc.glb", "screen": "audio-visualizer" }
  ],
  "properties": [
    { "key": "lights", "type": "bool", "default": true, "label": "Luzes de LED" }
  ]
}
```

## API para o conteúdo (`window.sofie`)
- `sofie.onProperties(cb)`: mudanças feitas pelo usuário na UI.
- `sofie.onAudio(cb)`: 64 bandas por canal, já suavizadas (para o PC ou as caixas de som do quarto reagirem à música).
- `sofie.onNowPlaying(cb)`: música tocando no sistema.
- `sofie.onPlayback(cb)`: pausado ou rodando (para a página parar animações e liberar CPU).
- `sofie.onPointer(cb)`: mouse sobre a área de trabalho (fase 2).

## Roadmap
| Fase | Entrega |
|---|---|
| 0 | Protótipo Windows + macOS: uma página web local atrás dos ícones (2 caminhos WorkerW) + pausa básica |
| 1 | Entrada por @handle/ID + download e cache do manifesto + quarto 3D básico |
| 2 | Quarto 3D completo: luzes, áudio reativo, música tocando, interação com o mouse |
| 3 | Linux (layer-shell), se houver demanda |
| 4 | Editor do quarto na conta Loom, itens colecionáveis |

## Decisões (2026-10-17)
| Tema | Decisão |
|---|---|
| Identidade | **ID** = número do cadastro no universo Loom. **@handle** = apelido/abreviação do ID. O app aceita qualquer um dos dois |
| Acesso | Quarto **público**: basta o @handle ou o ID, sem login. Quarto **privado** (o dono escolhe): o app pede login só nesse caso |
| Login (quarto privado) | Fluxo *device code*: o app mostra um código curto, a pessoa aprova no site/app do The Loom, e o token fica guardado no cofre do sistema (Windows Credential Manager / macOS Keychain), nunca em arquivo |
| Edição × exibição | **Toda personalização acontece no site do The Loom** (quarto, personagem, itens, atmosfera, privacidade). O wallpaper **só exibe** e não tem editor. Ajustes locais limitados a qualidade, FPS e regras de pausa |
| Atualização | Ao salvar no site, o servidor **avisa o app em tempo real** (WebSocket/SSE leve, com checagem periódica de reserva). O app baixa **só o que mudou** (manifesto versionado + assets por hash), guarda em cache e aplica com transição suave. Offline: mostra a última versão salva |
| Conteúdo 3D | Quarto, personagem e itens colecionáveis **ainda não existem**: vamos modelar o quarto base com slots, um personagem base com animações idle e os primeiros itens seguindo um padrão único (ver `direcao-visual.md`) |
| Plataformas | **Windows e macOS** no lançamento |
| Estilo | **3D** (Three.js), com modo "leve" para PCs fracos (menos sombras/efeitos, FPS menor) |

## Perguntas em aberto
1. A API do universo Loom já existe? Precisamos de algo como `GET /resolve/@handle → id` e `GET /rooms/{id}` (manifesto + assets 3D).
2. Personagem: base única no MVP e personalização por Loomer depois?
3. Itens com marcas reais (Red Bull, NVIDIA, Nike): já há parceria/licença?
4. Quem pode ver um quarto privado: só o dono, ou amigos (Friends) também?
