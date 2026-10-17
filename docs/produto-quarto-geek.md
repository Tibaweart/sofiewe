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
- `sofie.onNowPlaying(cb)`: música tocando no sistema.
- `sofie.onPlayback(cb)`: pausado ou rodando (para a página parar animações e liberar CPU).

## Roadmap
| Fase | Entrega |
|---|---|
| 0 | Protótipo Windows + macOS: uma página web local atrás dos ícones (2 caminhos WorkerW) + pausa básica |
| 1 | Entrada por @handle/ID + download e cache do manifesto + quarto 3D básico |
| 2 | Quarto 3D completo: luzes por horário, música tocando (opcional), animações de visita |
| 3 | Linux (layer-shell), se houver demanda |
| 4 | Editor do quarto na conta Loom, itens colecionáveis |

## Decisões (2026-10-17)
| Tema | Decisão |
|---|---|
| Identidade | **ID** = número do cadastro no universo Loom. **@handle** = apelido/abreviação do ID. O app aceita qualquer um dos dois |
| Acesso | Quarto **público**: basta o @handle ou o ID, sem login. Quarto **privado** (o dono escolhe): o app pede login só nesse caso |
| Login (quarto privado) | Fluxo *device code*: o app mostra um código curto, a pessoa aprova no site/app do The Loom, e o token fica guardado no cofre do sistema (Windows Credential Manager / macOS Keychain), nunca em arquivo |
| Personagem | **Base única no MVP**, personalização por Loomer depois |
| Itens | **Próprios/genéricos** (sem marcas reais) no lançamento |
| Arte 3D | Responsável ainda não definido |
| Backend | Site existe (Cloudflare Workers + D1 `theloom-id`), **sem API** ainda. Plano em `integracao-theloom.md` |
| Monetização | **App grátis** |
| Prazo | **Sem prazo fixo** |
| Áudio | **Sem reação à música** do PC (decidido). Sem captura de áudio, o que também reduz o consumo |
| @handle | **Escolhido pela pessoa**, único (estilo Instagram) |
| Interação | **Sem interação com o mouse** no wallpaper: só visual (sem rótulos, sem clique). Não precisa de Raw Input |
| Atmosfera | **Segue o horário real** (manhã, tarde, final de tarde, noite). No site dá para travar uma |
| Monitores | **Quarto só no monitor principal**. Os outros ficam com o fundo normal do sistema |
| Nome do app | **My Loom** |
| Distribuição | **Download pelo site do The Loom** (sem lojas). Exige **assinatura de código**: Windows (Authenticode / Azure Trusted Signing) e macOS (Apple Developer ID + notarização). Sem isso, o SmartScreen e o Gatekeeper mostram alertas de "app não confiável". Atualizações automáticas pelo próprio app |
| Inicialização | **Abre com o computador por padrão**, com opção de desligar |
| Jogos / tela cheia | **A pessoa escolhe** nas configurações: Pausar (padrão) ou Parar e liberar memória |
| Publicador | **Empresa The Loom** (própria). Apple Developer: **conta já existe**. Assinatura Windows: **decidir perto do lançamento** |
| Primeira abertura offline | **Quarto padrão The Loom embutido no instalador**, trocado pelo quarto da pessoa assim que houver internet |
| Privacidade | Quarto **privado = só o dono vê**. Público = qualquer um com o @handle/ID |
| Visitas | **Amigos e namorado(a) podem visitar** o quarto: o personagem do visitante **aparece no quarto junto com o dono (2 pessoas)**, com animações de convivência (sentar juntos, conversar, mexer no setup). A visita é **somente por convite**, e **vale nos dois sentidos**: qualquer um dos dois pode convidar o outro para o seu quarto ou receber convite (quem convida é o anfitrião, quem aceita aparece no quarto dele). Durante a visita, **o quarto do anfitrião com os 2 personagens aparece no wallpaper dos dois**. A visita **continua até o visitante sair ou o dono retirá-lo**, mesmo com alguém offline (o personagem fica no quarto). Entrada, saída e remoção são sincronizadas em tempo real pelo mesmo canal das atualizações |
| Edição × exibição | **Toda personalização acontece no site do The Loom** (quarto, personagem, itens, atmosfera, privacidade). O wallpaper **só exibe** e não tem editor. Ajustes locais limitados a qualidade, FPS e regras de pausa |
| Atualização | Ao salvar no site, o servidor **avisa o app em tempo real** (WebSocket/SSE leve, com checagem periódica de reserva). O app baixa **só o que mudou** (manifesto versionado + assets por hash), guarda em cache e aplica com transição suave. Offline: mostra a última versão salva |
| Conteúdo 3D | Quarto, personagem e itens colecionáveis **ainda não existem**: vamos modelar o quarto base com slots, um personagem base com animações idle e os primeiros itens seguindo um padrão único (ver `direcao-visual.md`) |
| Plataformas | **Windows e macOS** no lançamento |
| Estilo | **3D** (Three.js), com modo "leve" para PCs fracos (menos sombras/efeitos, FPS menor) |

## Perguntas em aberto
1. API: ver perguntas em `integracao-theloom.md`.
