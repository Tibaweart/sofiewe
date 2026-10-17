# 07 — Plash

`sindresorhus/Plash@79728c9` · Swift · macOS · **não é mais open source**

## O que encontramos
O repositório público tem só `readme.md` e o ícone. O autor explica que fechou o código porque o
projeto não recebia contribuições e sofria com clones na App Store. O histórico git foi reescrito
(um único commit "Init"), então **não há versão antiga recuperável** nesse repositório. Não procuramos
forks antigos para não depender de código de licença incerta.

## O que dá para aprender sem o código (comportamento + docs públicas)
- Proposta: **qualquer site como wallpaper** do Mac, com lista de sites, troca por atalho e recarga periódica.
- Bibliotecas citadas: `Defaults` (preferências tipadas) e `KeyboardShortcuts` (atalhos globais), ambas MIT do mesmo autor.
- Técnica padrão macOS (a mesma confirmada no ScreenPlay, [05](05-screenplay.md)): uma `NSWindow` sem
  borda no nível da área de trabalho, presente em todos os Spaces, com um `WKWebView` dentro.

## Lição de produto
É o mais próximo da nossa ideia (uma **página web** como fundo de tela) e mostra que, no macOS, um
`WKWebView` numa janela de nível desktop basta. A história do código fechado também ensina algo:
abrir o código não traz comunidade sozinho, e clones são um risco real em lojas de apps.
