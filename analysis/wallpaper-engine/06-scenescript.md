# 06 — SceneScript

JavaScript (ES moderno) que roda dentro de cenas para dar lógica às propriedades dos objetos.
Fontes: docs oficiais (`docs.wallpaperengine.io/en/scene/scenescript/reference.html`) ✅ e a
emulação em `open-wallpaper-engine@d906a69` `src/Scene/Script/Script.cpp` (4400 linhas, **QuickJS**) ✅.

## Onde vive
Um script é anexado a uma **propriedade** de um objeto (origem, escala, ângulos, alpha, cor,
texto, visibilidade, valores de efeito…). O módulo exporta funções de evento, e o retorno de `update`
vira o novo valor da propriedade.
```js
export function update(value) { return value; }   // a cada frame
export function init(value)   { return value; }   // uma vez
```

## Objetos globais ✅
| Global | O que oferece |
|---|---|
| `engine` | `frametime`, `runtime`, `timeOfDay`, `canvasSize`, `screenResolution`, `userProperties`, `registerAudioBuffers(resolução)`, `setTimeout`, `setInterval`, flags `isScreensaver()`, `isRunningInEditor()` ✅ (open-WE) e outras de dispositivo 🟡 |
| `thisScene` | `getLayer(nome)`, `enumerateLayers()`, `createLayer()`, `destroyLayer()`, `sortLayer()`, `getCameraTransforms()`, `setCameraTransforms()`, `getTextureAnimation()`, `getAnimation()`, `getAnimationLayer()` |
| `thisLayer` / `thisObject` | a camada/objeto dono do script: propriedades, animações (`play`, `stop`, `isPlaying`) |
| `input` | `cursorScreenPosition`, `cursorWorldPosition`, `cursorLocalPosition`, `cursorLeftDown`, `cursorRightDown`, `cursorMiddleDown` |
| `shared` | objeto compartilhado entre todos os scripts da cena |
| `localStorage` | persistência simples por wallpaper |
| `WEMath`, `WEVector`, `WEColor` | utilidades (lerp, smoothstep, conversões HSV↔RGB…) |
| `Vec2`, `Vec3`, `Vec4` | vetores com operações |
| `createScriptProperties()` | declara propriedades editáveis do script na UI do editor |
| `console` | log |

## Eventos ✅
| Evento | Quando |
|---|---|
| `init()` | uma vez, na carga (setup pesado aqui, não no `update`) |
| `update(value)` | todo frame |
| `applyUserProperties(changed)` | o usuário mudou uma propriedade |
| `applyGeneralSettings(settings)` | mudaram configurações gerais |
| `resizeScreen(size: Vec2)` | a resolução mudou |
| `cursorEnter/Leave/Move/Down/Up/Click(event)` | mouse sobre objetos **marcados como Solid**. `cursorClick` vem depois de down+up |
| `mediaPlaybackChanged`, `mediaPropertiesChanged`, `mediaThumbnailChanged`, `mediaTimelineChanged` | integração de mídia do Windows |
| áudio | `engine.registerAudioBuffers(AUDIO_RESOLUTION_16/32/64)` devolve buffers `left/right/average` atualizados por frame |

**Por quê de scripts por propriedade (e não um script global):** o criador anima *uma coisa* por vez
(ex.: "rotação = hora atual") sem entender o ciclo da cena. O motor chama só os scripts necessários.
**Por quê "Solid" para mouse:** fazer hit-test em toda camada transparente seria caro e geraria cliques indesejados.
