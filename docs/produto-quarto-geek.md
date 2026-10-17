# Produto: "Quarto Geek" como fundo de tela

> Rascunho a partir das análises em [`../analysis/`](../analysis/). Pontos marcados com **(?)**
> dependem de respostas do time.

## A ideia
1. A pessoa baixa o app (Windows primeiro).
2. Digita o **código da conta Loom ID** **(?)**.
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
            API Loom: GET /rooms/{loomId} → manifesto + assets
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
  "loomId": "ABC123",
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
| 0 | Protótipo Windows: uma página web local atrás dos ícones (2 caminhos WorkerW) + pausa básica |
| 1 | Login com Loom ID + download e cache do manifesto + quarto 2.5D |
| 2 | Quarto 3D (Three.js), áudio reativo, música tocando, interação com o mouse |
| 3 | macOS. Linux (layer-shell) depois |
| 4 | Editor do quarto na conta Loom, itens colecionáveis |

## Perguntas em aberto (?)
1. **O que é a Loom ID?** Uma plataforma de vocês? O quarto já existe (web/3D) ou vamos criá-lo?
2. O código da conta é **público** (qualquer um com o código vê o quarto) ou precisa de login?
   Se for privado, o fluxo recomendado é o *device code* (digitar o código num site e aprovar).
3. Plataformas no lançamento: só Windows ou Windows + macOS?
4. Estilo do quarto: pixel art 2.5D, isométrico low-poly ou 3D realista? (muda bastante o custo de GPU)
