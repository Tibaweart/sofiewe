# 05 — API de wallpapers web e áudio

Fontes: docs oficiais (`docs.wallpaperengine.io/en/web/...`) ✅ e `open-wallpaper-engine@d906a69`
`src/Web/AppHandler.cpp`, `UserProperties.cpp` ✅.

## Host
Página aberta num processo CEF (`bin/webwallpaper32.exe`) com um **esquema de URL próprio** para os
arquivos do wallpaper (linux-WE `WPSchemeHandler`, open-WE `weweb://`), o que evita `file://` e as restrições de origem.

## `window.wallpaperPropertyListener` ✅
```js
window.wallpaperPropertyListener = {
  applyUserProperties(props) {},   // ao carregar (todas) e a cada mudança (só as alteradas)
  applyGeneralProperties(props) {},// configurações gerais do app; principal: props.fps (limite)
  setPaused(isPaused) {},          // opcional: o WE já pausa sozinho, mas a página pode parar trabalho extra
  userDirectoryFilesAddedOrChanged(propName, files) {}, // propriedade "directory" em modo fetchall
  userDirectoryFilesRemoved(propName, files) {},
};
```
- `props.<nome>.value`: cor como `"r g b"` (0–1), slider número, bool, combo string, arquivo com caminho.
- **Mudanças chegam como patch** (só a chave alterada). A página precisa checar se a chave existe.
  (open-WE `BuildPropertyPatchSnippet` faz o mesmo.)
- FPS: a doc recomenda limitar o próprio loop `requestAnimationFrame` pelo `fps` recebido.

## Áudio ✅
```js
window.wallpaperRegisterAudioListener(function (audioArray) {
  // 128 floats: [0..63] canal esquerdo, [64..127] direito; graves → agudos
  // valores lineares, normalmente 0..1 mas PODEM passar de 1
});
window.wallpaperRemoveAudioListener(cb); // (open-WE implementa; ❓ confirmar que é API oficial)
```
**Captura sob demanda:** o primeiro listener liga a captura e o último desliga (open-WE `AppHandler.cpp`
`__weweb_setAudioDemand`). **Por quê:** WASAPI loopback + FFT custam CPU, então não faz sentido rodar sem consumidor.
Exige `general.supportsaudioprocessing: true` no `project.json`.

No lado nativo (linux-WE): buffer circular → FFT real (kissfft) → 64 bandas em escala log → 32/16 por
agrupamento → suavização por frame `movetowards(atual, alvo, 0.3)`.

## Mídia (Windows Media Integration) ✅/🟡
O WE lê a mídia tocando no sistema (SMTC do Windows): título, artista, capa, posição, estado. Web e
SceneScript recebem eventos (`mediaPlaybackChanged`, `mediaPropertiesChanged`, `mediaThumbnailChanged`,
`mediaTimelineChanged`). Os nomes exatos dos listeners web (`wallpaperRegisterMedia*Listener`) ❓ precisam ser conferidos na doc.

## Lição para o nosso
A nossa API `window.sofie.*` ([produto](../../docs/produto-quarto-geek.md)) segue o mesmo modelo:
listener objeto + patches + captura sob demanda + estado de pausa explícito.
