# Mapa do Wallpaper Engine

Mapa completo do WE (Steam appid 431960), montado **sem o binário** a partir de três fontes:

| Fonte | O que dá | Confiança |
|---|---|---|
| **Docs oficiais** (docs.wallpaperengine.io, help.wallpaperengine.io), lidas via busca | APIs públicas, CLI, regras de desempenho | ✅ alta (autor oficial) |
| **Reimplementações que rodam wallpapers reais** (`linux-wallpaperengine@b016d7d` GPL-3, `open-wallpaper-engine@d906a69` GPL-2, `wallpaper-scene-renderer@8dde7e7` GPL-2, `repkg@8005eb2` MIT) | Formatos, pipeline de render, nomes internos | ✅ alta (testadas contra milhares de wallpapers) |
| **Inferência** a partir das duas acima | Arquitetura interna, motivos | 🟡 média |

❓ = só o binário responde → [08-perguntas-ghidra.md](08-perguntas-ghidra.md).

> O binário do WE **não entra neste repositório** (licença proprietária, e o `.gitignore` bloqueia).
> Para analisá-lo, veja [`../../docs/setup-ghidra.md`](../../docs/setup-ghidra.md).

## Visão em uma página

```
                       Steam (licença, Workshop, atualizações)
                                     │
   launcher.exe ──► wallpaper32.exe / wallpaper64.exe  (processo principal, "core")
                     │  • host na área de trabalho (WorkerW)            [01]
                     │  • regras de pausa/stop, FPS, qualidade          [07]
                     │  • CLI: wallpaper64.exe -control <cmd>           [01]
                     │  • captura de áudio (WASAPI loopback → FFT)      [05]
                     │
                     ├── motor SCENE (D3D11) ── scene.pkg ── .tex/.mdl  [02][03]
                     │     shaders GLSL1.20 → HLSL SM3   [04]
                     │     SceneScript (JS)               [06]
                     ├── player VIDEO (mp4/webm)
                     ├── bin/webwallpaper32.exe (CEF) ── API JS window.wallpaper* [05]
                     ├── APPLICATION (exe de terceiros encaixado)
                     └── bin/wallpaperui.exe (interface: navegador, editor, Workshop)
   assets/  ── shaders, efeitos, materiais e modelos base usados por todos os wallpapers
```

## Arquivos
| # | Subsistema |
|---|---|
| [01](01-instalacao-processos-cli.md) | Instalação, processos, pastas, CLI de controle |
| [02](02-formatos.md) | `project.json`, propriedades, `.pkg`, `.tex`, `.mdl`, `scene.json` |
| [03](03-cena-e-render.md) | Objetos da cena, render targets, efeitos, partículas, câmera, luzes |
| [04](04-shaders.md) | Linguagem, combos, anotações, uniforms e atributos globais |
| [05](05-api-web-e-audio.md) | API JavaScript de wallpapers web, áudio, mídia |
| [06](06-scenescript.md) | SceneScript: objetos globais, métodos e eventos |
| [07](07-desempenho-e-pausa.md) | Regras de aplicativo, pausa × stop, FPS e qualidade |
| [08](08-perguntas-ghidra.md) | O que só o binário responde, com âncoras para o Ghidra |

## As 10 decisões de design do WE e o porquê provável
1. **Formato de cena próprio + editor**: criadores fazem conteúdo sem programar. É o diferencial frente a "vídeo em loop".
2. **D3D11 no Windows**: o driver mais maduro e estável na base de usuários Steam.
3. **Shaders em GLSL 1.20 traduzidos para HLSL**: a comunidade conhece GLSL, e o runtime fica em D3D.
4. **Metadados no comentário do shader**: um arquivo só, e o editor gera a UI sozinho.
5. **`assets/` compartilhado**: wallpapers pequenos, que só referenciam efeitos base (por isso reimplementações exigem o WE instalado).
6. **Texturas DXT + LZ4 pré-compiladas pelo editor**: upload direto para a GPU, menos VRAM e disco.
7. **Web em processo separado (CEF)**: o Chromium é pesado e instável. Isolá-lo protege o core.
8. **Captura de áudio sob demanda**: só ativa quando algum wallpaper registra listener ou usa espectro.
9. **"Stop (free memory)"**: encerra o motor e deixa só um processo mínimo, para os jogos terem RAM e VRAM.
10. **Workshop da Steam**: distribuição, avaliação e atualização de graça, mas fica preso à Steam.
