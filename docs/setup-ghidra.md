# Fase 2: análise do Wallpaper Engine com Ghidra + Claude Code (no seu PC Windows)

Este passo **não roda na nuvem**: precisa do WE instalado e do Ghidra na sua máquina.

## Aviso
A licença do WE proíbe descompilar. Estudar a sua cópia para entender é zona cinzenta. Copiar código
não é aceitável. Regras: nada de binário, pseudocódigo ou export do Ghidra no git (o `.gitignore` já bloqueia).
Notas só com palavras nossas, em `analysis/00-wallpaper-engine.md`. Projeto comercial → consultar um advogado.

## Instalação
1. **JDK 21** (Temurin) e **Ghidra** (última versão em github.com/NationalSecurityAgency/ghidra/releases).
2. **GhidraMCP** (github.com/LaurieWired/GhidraMCP): instale a extensão no Ghidra
   (*File → Install Extensions*), ative o plugin em *File → Configure → Developer* e rode a ponte Python.
3. **Claude Code** no Windows. Registre o MCP, por exemplo:
   ```
   claude mcp add ghidra -- python C:\caminho\bridge_mcp_ghidra.py --ghidra-server http://127.0.0.1:8080/
   ```
   (siga o README do GhidraMCP para os parâmetros atuais.)
4. Opcional: **x64dbg** (análise dinâmica), **Spy++**, **Process Monitor**, **API Monitor**.

## Preparação
1. Copie (não mova) `wallpaper64.exe` e as DLLs da pasta do WE para uma pasta **fora** do repositório.
2. Ghidra: novo projeto → importar → autoanálise com *Decompiler Parameter ID* e *RTTI* (MSVC) ligados.
3. Clone este repositório e abra o Claude Code nele. A skill `wallpaper-re` carrega o roteiro.

## Roteiro (o que perguntar ao Claude)
Siga as âncoras da skill (`.claude/skills/wallpaper-re/SKILL.md`). Exemplo de pedido:
> "Use a skill wallpaper-re. Comece pelo subsistema *host*: ache as referências à string `WorkerW`,
> descompile as funções, renomeie e me explique o que fazem e por quê. Atualize
> analysis/00-wallpaper-engine.md só com descrições."
