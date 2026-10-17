# 09 — RePKG

`notscuffed/repkg@8005eb2` · C# · MIT · ferramenta de linha de comando

Extrai `.pkg` e converte `.tex` do Wallpaper Engine em imagens. É a referência mais limpa dos formatos.

## Organização
- `RePKG.Core`: modelos e enums (`TexFormat`, `MipmapFormat`, `FreeImageFormat`).
- `RePKG.Application`: leitores e escritores (`Package/PackageReader.cs`, `Texture/TexReader.cs`,
  `TexImageContainerReader.cs`, `TexImageReader.cs`, `TexFrameInfoContainerReader.cs`,
  `TexToImageConverter.cs`, decodificadores `DXT.cs`/`RG88.cs`).
- `RePKG.Tests`.

## Formatos (confirmam [00](00-wallpaper-engine.md))
- **PKG** (`PackageReader.cs`): string com prefixo i32 (magic, até 32 bytes), `i32 count`, entradas
  `{string path (até 255), i32 offset, i32 length}`. O offset é somado ao **início dos dados**
  (fim do cabeçalho).
- **TEX**: `TexFormat` = RGBA8888 0, DXT5 4, DXT3 6, DXT1 7, RG88 8, R8 9.
  Mipmap V1 = `{w, h, bytes}`. V2/V3 = `{w, h, isLZ4, tamanhoDescomprimido, bytes}`. A V4 tem
  parâmetros extras de papel desconhecido, provavelmente só do editor (FIXME no código).
- O **FreeImageFormat** do container indica quando o mipmap é um arquivo de imagem embutido (PNG/JPG…).

## Segurança
Valida limites antes de alocar: `mipmapCount > MaximumMipmapCount` lança `UnsafeTexException`,
e strings têm tamanho máximo. **Por quê:** arquivos da Workshop são entrada não confiável, e um
contador malicioso faria alocar gigabytes.

## Lições para o nosso
1. Parsers de conteúdo de terceiros sempre com **limites explícitos**.
2. Separar Core (modelo) de Application (I/O) facilita testes.
3. Se quisermos importar wallpapers do WE que o usuário já possui, estes formatos bastam para
   imagens e cenas 2D simples (sem redistribuir nada).
