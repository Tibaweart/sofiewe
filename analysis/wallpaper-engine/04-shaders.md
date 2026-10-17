# 04 — Shaders

## Linguagem ✅
Doc oficial (preservada em `wallpaper-scene-renderer/wpdoc/shader.md`): **GLSL 1.20 com pequenas
exceções, traduzido dinamicamente para HLSL e compilado como Shader Model 3.0**. A lista oficial de
uniforms fica em `assets/shaders/readme.txt` da instalação.

Reimplementações fazem o caminho inverso para OpenGL/Vulkan: pré-processar → **glslang** (SPIR-V) →
**SPIRV-Cross** (GLSL moderno) ou Vulkan direto (linux-WE `Render/Shaders/ShaderUnit.cpp`).

## Pré-processador próprio ✅
- `#include "common.h"`: bibliotecas em `assets/shaders/` (sem includes aninhados).
- `// [COMBO] {"material":"…","combo":"NOME","type":"options","default":0}`: declara uma **variante**.
  O material escolhe o valor (`combos{}` no material), que vira `#define NOME valor`.
  **Por quê:** um "uber shader" com `#if`, compilado só nas variantes realmente usadas.
- `uniform float g_Speed; // {"material":"Velocidade","default":1,"range":[0,5]}`: expõe o uniform
  no editor. Com `"type":"color"` vira seletor de cor. O valor pode ser ligado a uma propriedade do usuário.

## Uniforms globais injetados pelo motor ✅ (união de linux-WE + open-WE)
| Grupo | Uniforms |
|---|---|
| Tempo | `g_Time`, `g_Frametime`, `g_Daytime` (0–1 hora do dia) |
| Matrizes | `g_ModelViewProjectionMatrix`(+`Inverse`), `g_ModelMatrix`(+`Inverse`), `g_ViewProjectionMatrix`, `g_NormalModelMatrix`, `g_EffectModelViewProjectionMatrix`(+`Inverse`), `g_EffectTextureProjectionMatrix`(+`Inverse`), `g_LayerModelMatrix`, `g_AltModelMatrix`, `g_AltViewProjectionMatrix` |
| Texturas | `g_Texture0`…`g_Texture12`, `g_Texture0Resolution` (+ resolução de cada), `g_Texture0Rotation/Translation`, `g_TexelSize`, `g_TexelSizeHalf`, `g_TextureReductionScale` |
| Mouse/parallax | `g_PointerPosition`, `g_PointerPositionLast`, `g_ParallaxPosition` |
| Áudio | `g_AudioSpectrum16Left/Right`, `g_AudioSpectrum32Left/Right`, `g_AudioSpectrum64Left/Right`, `g_AudioFrequencyMin/Max` |
| Cor | `g_Color`, `g_Color4`, `g_Alpha`, `g_UserAlpha`, `g_Brightness`, `g_TintColor`, `g_CompositeColor/Alpha`, `g_BlendAlpha` |
| Câmera | `g_EyePosition`, `g_ViewForward/Right/Up`, `g_OrientationForward/Right/Up`, `g_Screen` |
| Luz/névoa | `g_LightAmbientColor`, `g_LightSkylightColor`, `g_LightsPosition`, `g_LightsColorRadius`, `g_LightsColorPremultiplied`, `g_LightsConeExponent`, `g_LightsDirectionType`, `g_LightsCastShadow`, `g_ShadowAtlasTransforms`, `g_FogDistanceColor/Params`, `g_FogHeightColor/Params` |
| Animação | `g_Bones`, `g_BonesAlpha`, `g_MorphOffsets`, `g_MorphWeights` |
| Diversos | `g_RefractAmount`, `g_RenderVar0..2`, `g_BlendMap` |

## Atributos de vértice ✅ (`open-WE SpecNames.cppm`)
Geral: `a_Position`, `a_Normal`, `a_TexCoord`, `a_Tangent4`, `a_BlendIndices`, `a_BlendWeights`,
`a_Center`, `a_Color4u`, `a_PositionC1`.
Partículas: `a_PositionVec4`, `a_Color`, `a_TexCoordVec4` (xyz rotação, w tamanho), `a_TexCoordVec4C1`
(velocidade, z vida), `a_TexCoordVec4C2/C3`, `a_TexCoordC2/C3/C4`.

**Por quê de tantos dados por partícula no vértice:** a simulação fica na CPU, e a GPU só desenha
sprites orientados. Mandar tudo como atributo evita um draw call por partícula.
