# 02 — Formatos de arquivo

## `project.json` ✅ (linux-WE `Data/Parsers/ProjectParser.cpp`, `PropertyParser.cpp`)
| Campo | Significado |
|---|---|
| `type` | `scene` · `video` · `web` · `application` (case-insensitive na prática) |
| `file` | arquivo principal (`scene.json`, `video.mp4`, `index.html`, `.exe`) |
| `title`, `description`, `preview`, `tags` | metadados da Workshop 🟡 (só `title` é lido pelo linux-WE) |
| `workshopid` | id na Workshop |
| `general.supportsaudioprocessing` | o wallpaper usa áudio (liga a captura) |
| `general.properties` | **propriedades do usuário** (abaixo) |

### Propriedades do usuário
Cada entrada: `{ "type", "text" (rótulo), "value", "order", "condition"?, … }`.
| `type` | Extras | UI |
|---|---|---|
| `color` | `value: "r g b"` (0–1) | seletor de cor |
| `bool` | | checkbox |
| `slider` | `min`, `max`, `step`, `fraction` | slider |
| `combo` | `options: [{label, value}]` | dropdown |
| `text` | | só texto/rótulo |
| `textinput` | | campo de texto |
| `file` / `directory` | `mode: fetchall/ondemand` (web) | escolher arquivo/pasta |
| `scenetexture` | | trocar uma textura da cena |
| `usershortcut` | | atalho para abrir app/URL |
| `group` | | agrupa (sem valor) |

`condition` (ex.: `"showclock.value == true"`) mostra ou esconde a propriedade de forma condicional.
**Por quê:** a UI inteira de configuração é gerada desse JSON, então o criador não escreve interface.

## `scene.pkg` ✅
```
string32  "PKGV0001".."PKGV0023"       (u32 tamanho + ASCII; versões vistas nas reimplementações)
u32       quantidade de arquivos
N × { string32 caminho ; u32 offset ; u32 tamanho }
<dados>   (offset relativo ao fim do cabeçalho)
```
Sem compressão nem criptografia. Contém `scene.json`, `materials/`, `models/`, `effects/`, `shaders/`, `particles/`, `sounds/`, `fonts/`, `scripts/`.
Os caminhos não encontrados no pacote são procurados em `assets/` da instalação (FS virtual em camadas).

## `.tex` ✅ (detalhe em [../00-wallpaper-engine.md](../00-wallpaper-engine.md#3-textura-tex-))
`TEXV0005` → `TEXI0001` (formato, flags, tamanhos) → `TEXB0001..0004` (mipmaps, LZ4 opcional, imagem
embutida opcional) → `TEXS0001..0003` (frames de GIF/spritesheet).
Formatos: RGBA8888, DXT1/3/5, RG88, R8. Versões novas também têm BC7, RGB565, RG1616f, R16f,
RGBA1010102, RGBA16161616f, RGB161616f (linux-WE `TextureParser.cpp:158`).

## `.mdl` 🟡 (linux-WE `docs/rendering/MDL_FILES.md`, ainda incompleto)
Blocos: **MDLV** (vértices: posição, 4 índices + 4 pesos de osso, UV, e índices de triângulo),
**MDLS** (esqueleto/ossos com matrizes), **MDLA** (animações). Usado em modelos 3D **e em
"puppet warp"** 2D (malha deformada por ossos).

## `scene.json` ✅
```
{ "camera":  { "center","eye","up","fov","nearz","farz", "parallax…", "bloom…", "shake…" },
  "general": { "ambientcolor","skylightcolor","clearcolor","orthogonalprojection":{width,height,auto},
               "bloom","bloomstrength","bloomthreshold","cameraparallax*","zoom", "lighting", "fog…" },
  "objects": [ { "id","name","origin","scale","angles","visible","parallaxDepth","dependencies",
                 "image"|"particle"|"sound"|"text"|"light"|"model", "effects":[…], "animationlayers":[…] } ] }
```
Muitos valores podem ser **dinâmicos**: `{ "user": "nomeDaPropriedade", "value": … }` (ligados a uma
propriedade do usuário) ou com `script` (SceneScript). Ver [03](03-cena-e-render.md) e [06](06-scenescript.md).

Material (`materials/*.json`): `passes[] { shader, blending, cullmode, depthtest, depthwrite, textures[], combos{}, constantshadervalues{} }`.
Efeito (`effects/*/effect.json`): lista de passes com material, entradas (`_rt_*`) e saída. Cada efeito é uma cadeia de passes.
