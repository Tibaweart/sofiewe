# 01 — Instalação, processos e CLI

## Pastas
| Caminho | Conteúdo | Fonte |
|---|---|---|
| `steamapps/common/wallpaper_engine/` | instalação | ✅ help oficial |
| `…/launcher.exe` | inicia o processo certo (32/64 bits) | ✅ help oficial |
| `…/wallpaper32.exe`, `…/wallpaper64.exe` | **processo principal** (core + motor) | ✅ help oficial |
| `…/bin/webwallpaper32.exe` | host CEF dos wallpapers web | ✅ help oficial |
| `…/bin/wallpaperui.exe` | interface (navegador, configurações, editor) | ✅ help oficial |
| `…/assets/` | shaders, efeitos, materiais e modelos **base**. Wallpapers de cena dependem deles | ✅ linux-WE README:79–118, open-WE README |
| `steamapps/workshop/content/431960/<id>/` | um wallpaper baixado: `project.json`, preview, `scene.pkg` ou `.mp4` ou `index.html` | ✅ |
| `…/projects/myprojects/` | projetos criados no editor | 🟡 |

🟡 O 32 bits continua existindo por compatibilidade com plugins e PCs antigos. O launcher escolhe.
❓ Onde ficam as configurações do usuário (arquivo/registro) e o cache de shaders compilados.

## Processos
- **Principal** (`wallpaper64.exe`): host na área de trabalho, render de cena e vídeo, regras de pausa, captura de áudio, servidor da CLI.
- **Web** (`webwallpaper32.exe`): um ou mais processos CEF (o Chromium cria subprocessos de render/GPU).
- **UI** (`wallpaperui.exe`): pode ser fechada sem parar o wallpaper. 🟡 A interface é feita em tecnologia web (CEF) (❓ confirmar).
- **Stop (free memory)**: o motor encerra e sobra um processo mínimo que reinicia tudo quando o jogo fecha ✅ (desenvolvedor, fórum Steam).

## Host na área de trabalho
WorkerW clássico (mensagem `0x052C` para `Progman` → `WorkerW` → `SetParent`), igual ao Lively ([../01-lively.md](../01-lively.md)).
❓ Tratamento do layout Windows 11 24H2. ❓ Como encaminha o mouse (Raw Input? hook?).

## CLI de controle ✅ (help.wallpaperengine.io/en/functionality/cli.html)
O WE precisa estar rodando. Os comandos vão para o executável principal:
```
wallpaper64.exe -control <comando> [argumentos]
```
| Comando | Argumentos | Efeito |
|---|---|---|
| `openWallpaper` | `-file <project.json ou .mp4>` `[-monitor N]` `[-location …]` `[-preset …]` `[-playInWindow "nome" -width -height -x -y]` | abre wallpaper (monitor começa em 0). `playInWindow` roda numa janela comum com nome único |
| `closeWallpaper` | `[-monitor N]` ou `[-playInWindow "nome"]` | fecha em um monitor/janela, ou todos |
| `pause` / `play` / `stop` | — | controla todos os wallpapers |
| `mute` / `unmute` | — | áudio |
| `applyProperties` | `-properties RAW~({...})~END` `[-monitor N]` | altera propriedades do wallpaper em execução (sintaxe exata ❓ conferir na doc) |

**Por quê:** permite integração com Rainmeter, scripts, modo noturno (AutoDarkMode), atalhos e hardware RGB, sem abrir uma API de rede.
🟡 Transporte provável: a segunda instância do exe encontra a primeira (mutex/janela oculta) e repassa a linha de comando (ex.: `WM_COPYDATA`) e sai. ❓
