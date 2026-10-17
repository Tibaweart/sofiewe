# 07 — Desempenho, pausa e regras

Fontes: help oficial (`help.wallpaperengine.io/en/performance/game.html`), respostas do
desenvolvedor no fórum Steam e no X ✅.

## Configurações globais (aba Desempenho)
| Situação | Ações possíveis |
|---|---|
| Outro aplicativo **em foco** | Continuar rodando · Pausar · Parar (liberar memória) |
| Outro aplicativo **maximizado** | idem |
| Outro aplicativo **em tela cheia** | idem (padrão: pausa durante jogos) |
| Outro aplicativo **tocando áudio** | Continuar · Mutar 🟡 |
| Notebook **na bateria** | Continuar · Pausar · Parar 🟡 |

Definições do desenvolvedor: *maximizado* = janela expandida; *em foco* = a última janela clicada.

## Pausar × Parar ✅
- **Pausar**: congela o render. RAM e VRAM continuam ocupadas, e a volta é instantânea.
- **Parar (liberar memória)**: o WE *"descarrega completamente, libera a RAM (exceto um processo de
  fundo minúsculo) e reinicia quando você sai do jogo"*.
  **Por quê:** em jogos pesados VRAM é o gargalo, e só encerrar o motor devolve tudo.
  (O mpvpaper faz igual com `execv` para um "holder", ver [../06-mpvpaper.md](../06-mpvpaper.md).)

## Regras por aplicativo ✅
Lista de exceções: escolher o executável, a **condição** (em foco / maximizado / tela cheia / rodando)
e a **ação** (continuar / pausar / parar). Usada para corrigir falsos positivos (overlays que parecem
tela cheia) e para manter o wallpaper rodando com apps específicos.

## Qualidade
Limite de FPS (também repassado para wallpapers web via `applyGeneralProperties.fps`), antialiasing
(MSAA), pós-processamento, resolução de textura, filtragem, "reflexos", qualidade de vídeo/decodificação. 🟡 nomes exatos variam por versão.

## ❓ Para o Ghidra
- Algoritmo de detecção de tela cheia (compara retângulo com o monitor? usa `SHQueryUserNotificationState`?).
- Frequência da checagem (timer? hook de eventos?).
- O que o processo mínimo do "Parar" vigia para saber a hora de reiniciar.
