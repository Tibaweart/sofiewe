# 08 — Perguntas que só o binário responde

Use com [`../../docs/setup-ghidra.md`](../../docs/setup-ghidra.md) e a skill `wallpaper-re`.
Responda cada uma no arquivo do subsistema, só com descrições (sem pseudocódigo).

| # | Pergunta | Arquivo-alvo | Âncoras no binário |
|---|---|---|---|
| 1 | Como o host lida com o Windows 11 24H2 (Progman com `WS_EX_NOREDIRECTIONBITMAP`)? Cria uma janela `WS_EX_LAYERED` própria? | 01 | strings `WorkerW`, `Progman`, `SHELLDLL_DefView`; `GetWindowLongPtrW`, `SetLayeredWindowAttributes` |
| 2 | Como recupera quando o Explorer reinicia? | 01 | `SetWinEventHook`, `RegisterWindowMessageW("TaskbarCreated")` |
| 3 | Como encaminha o mouse ao wallpaper? | 01 | `RegisterRawInputDevices`, `SetWindowsHookExW(WH_MOUSE_LL)` |
| 4 | Transporte da CLI `-control` (mutex? `WM_COPYDATA`? pipe?) | 01 | string `-control`, `CreateMutexW`, `FindWindowW`, `WM_COPYDATA` (0x4A), `CreateNamedPipeW` |
| 5 | Algoritmo e frequência da detecção de foco/maximizado/tela cheia | 07 | `GetForegroundWindow`, `IsZoomed`, `MonitorFromWindow`, `GetMonitorInfoW`, `SHQueryUserNotificationState`, `SetTimer` |
| 6 | O que sobra no "Parar (liberar memória)" e como decide reiniciar | 07 | `CreateProcessW`, `WaitForSingleObject`, `TerminateProcess` |
| 7 | Backend de vídeo (Media Foundation? próprio?) e decodificação por hardware | 00 | imports `mfplat.dll`, `mfreadwrite.dll`, `MFCreateSourceReader*`, `D3D11VideoDevice` |
| 8 | Tradutor GLSL→HLSL: próprio ou biblioteca? Cache dos shaders compilados: onde e como invalida | 04 | `D3DCompile`, strings `gl_FragColor`, `texture2D`, `#version`, extensões `.cache` |
| 9 | Campos "unknown" do `.tex` (`TEXI` e `TEXB0004`) e do `.mdl` | 02 | strings `TEXI0001`, `TEXB0004`, `MDLV`, `MDLS`, `MDLA` |
| 10 | Como o áudio é suavizado/normalizado antes de chegar ao JS e aos shaders | 05 | `IAudioClient::Initialize` + `AUDCLNT_STREAMFLAGS_LOOPBACK` (0x20000), funções FFT perto dele |
| 11 | Motor JS do SceneScript (V8? QuickJS? ChakraCore?) | 06 | strings `JS_NewRuntime`, `v8::`, `JsCreateRuntime` |
| 12 | Hierarquia de classes do motor | todos | RTTI MSVC `.?AV…@@` |
