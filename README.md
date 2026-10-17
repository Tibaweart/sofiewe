# sofiewe

> **Este conteúdo foi movido para o monorepo [`Tibaweart/theloom`](https://github.com/Tibaweart/theloom)**
> (branch `importar/api`: `apps/api`, `docs/myloom`, `docs/pesquisa`). Continue o trabalho lá.

**My Loom**: fundo de tela animado com o **quarto geek** de cada usuário (conta Loom ID), construído do zero
a partir do estudo do Wallpaper Engine e de 9 projetos open source.

| Onde | O quê |
|---|---|
| [`analysis/`](analysis/) | Dissecação dos 10 programas: o que fazem e **por quê** (clean room) |
| [`analysis/wallpaper-engine/`](analysis/wallpaper-engine/README.md) | **Mapa completo do Wallpaper Engine** (processos, formatos, render, shaders, APIs, pausa) |
| [`analysis/10-sintese.md`](analysis/10-sintese.md) | O que levamos de cada um → nossas decisões |
| [`docs/produto-quarto-geek.md`](docs/produto-quarto-geek.md) | Visão do produto, arquitetura e roadmap |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | **Roteiro para publicar a API e ligar o site** (para a sessão logada no Cloudflare) |
| [`api/`](api/README.md) | **API do My Loom** (Cloudflare Worker + D1 + Durable Objects), com testes. Bancos prontos; Worker ainda não publicado |
| [`docs/integracao-theloom.md`](docs/integracao-theloom.md) | Integração com theloom.com.br (contas, API, tempo real) |
| [`docs/direcao-visual.md`](docs/direcao-visual.md) | Direção visual "My Loom" (referência + como fazer em 3D leve) |
| [`docs/setup-ghidra.md`](docs/setup-ghidra.md) | Fase 2: análise do binário do WE no seu PC |
| [`.claude/skills/wallpaper-re/`](.claude/skills/wallpaper-re/SKILL.md) | Skill do Claude Code com o roteiro de engenharia reversa |

**Regra do repositório:** nenhum código, binário ou asset de terceiros entra aqui. Só as nossas notas e o nosso código.
