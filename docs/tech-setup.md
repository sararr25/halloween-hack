# Tech setup: Rive CLI, WGSL, MediaPipe, GSAP, genjutsu

Verificato il 2026-09-29 sui sorgenti ufficiali (`rive-app/rive-docs`, npm registry). Vale per Claude Code (web + locale) e per Codex.

## 0. Rete: domini da consentire

I container cloud (Claude Code web, Codex) hanno un'allowlist di rete. Serve:

| Dominio | Perché | Stato qui (2026-09-29) |
|---|---|---|
| `releases.rive.app` | installer Rive CLI | ❌ bloccato (403): **da aggiungere** |
| `api.rive.app` / `*.rive.app` | `rive login`, `--publish`, `push/pull` | ❌ da aggiungere |
| `registry.npmjs.org` | pnpm/npm | ✅ |
| `storage.googleapis.com` | modelli MediaPipe `.task` | ✅ |
| `github.com` | fallback genjutsu | ✅ |

Claude Code web: impostazioni dell'environment → Network access (custom allowlist). Codex: environment settings → Internet access → allowlist con gli stessi domini.

## 1. Rive CLI

```bash
curl -fsSL https://releases.rive.app/cli/install.sh | sh   # Linux x86_64 / macOS Apple Silicon
export PATH="$HOME/.rive/bin:$PATH"                       # aggiungilo a ~/.zshrc o ~/.bashrc
rive doctor
# macOS alternativa: brew install --cask rive-app/tap/rive-cli
```

Flusso di lavoro:

```bash
rive create rive/desktop       # rive.yaml, scene.rml, AGENTS.md, CLAUDE.md
rive rive/desktop              # finestra di preview con rebuild live (solo in locale)
rive rive/desktop --verify     # compila senza scrivere
rive inspect --summary         # cosa contiene davvero la scena
rive rive/desktop --screenshot=out.png --advance=1s --data=headX=0.3   # headless: ok per agenti/CI
rive docs / rive schema <Type> # documentazione e tipi, offline
```

- Tutto ciò che è nella cartella viene preso per estensione: `.rml` (scena), `.luau` (script), `.wgsl` (shader), immagini, font.
- **Script + web = `--publish` obbligatorio.** Le runtime web rifiutano gli script non firmati. `--publish` richiede `rive login`. Per evitare il watermark: progetto legato a un file del tuo account (`rive push`) in un workspace **Cadet o superiore**. → Serve il tuo account Rive: il login lo fai tu (`rive login`) in locale o nel container.
- `rive create x --from-rev=file.rev` converte un file esportato dall'Editor in progetto testuale; `rive pull` e `rive push` sincronizzano con l'Editor.

## 2. Shader WGSL in Rive (sintesi operativa)

- Solo vertex + fragment, massimo 4 bind group. Niente compute shader, niente `override`, f64, push constants.
- Lo shader disegna su un `GPUCanvas` da uno script Luau: `context:gpuCanvas{}`, `context:shader('Nome')`, `GPUPipeline.new{}`, `canvas:beginRenderPass{}`, `pass:draw(3)`, `renderer:drawImage(canvas.image, ...)`.
- **Uniform**: `GPUBuffer` in `GPUBindGroup` (`@group/@binding` combacianti). Il valore arriva da script input o da **data binding**, quindi l'app JS lo pilota tramite view model (è così che MediaPipe arriva fino allo shader).
- **Post-process di un artboard**: lo si renderizza in un canvas offscreen (`srcCanvas:beginFrame`, `instance:draw`) e si campiona `srcCanvas.image:view()` come texture.
- **Shader targets** (nell'Editor o in `rive.yaml`): per il web servono **GLSL ES 300** (WebGL2) e **WGSL** (WebGPU). Un target non incluso = shader che non si carica su quel backend.
- Runtime web: `@rive-app/webgl2` (2.43.x), con renderer GPU. Prima del build va verificato che la runtime canvas2d non esegua gli shader. Se non li esegue, si usa solo webgl2.

## 3. MediaPipe (testa + gesture)

Il link `developers.google.com/edge/mediapipe/framework/getting_started/install` riguarda il vecchio **Framework** C++/Bazel e **non serve**. Sul web si usa **MediaPipe Tasks Vision**, un pacchetto npm: niente da installare a livello di sistema, né qui né su Codex.

```bash
pnpm add @mediapipe/tasks-vision        # v1.0.1
# asset self-hosted (jsdelivr è bloccato nei container, e self-host è più robusto)
mkdir -p public/mediapipe public/models
cp -r node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/
curl -fsSL -o public/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task      # 3.7 MB
curl -fsSL -o public/models/gesture_recognizer.task \
  https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task  # 8.4 MB
```

Uso (bozza del modulo `presence`):

```ts
import { FilesetResolver, FaceLandmarker, GestureRecognizer } from "@mediapipe/tasks-vision";

const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
const face = await FaceLandmarker.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO", numFaces: 1,
  outputFaceBlendshapes: true,                 // eyeBlinkLeft/Right, jawOpen, eyeLookOut...
  outputFacialTransformationMatrixes: true,    // matrice 4x4 → yaw/pitch/roll
});
const hands = await GestureRecognizer.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: "/models/gesture_recognizer.task", delegate: "GPU" },
  runningMode: "VIDEO", numHands: 1,
});

// loop su requestVideoFrameCallback; face a ogni frame, gesture a frame alterni (~15 Hz)
const r = face.detectForVideo(video, performance.now());
const m = r.facialTransformationMatrixes?.[0]?.data; // column-major
// yaw = atan2(m[8], m[10]); pitch = asin(-m[9]); smussare con EMA (alpha ~0.2)
const g = hands.recognizeForVideo(video, performance.now()).gestures?.[0]?.[0]; // {categoryName, score}
```

Gesture predefinite: `Open_Palm`, `Closed_Fist`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`, `None`.
Regole: richiede HTTPS (Vercel ok, `localhost` ok). I frame non lasciano mai il browser. Si caricano i modelli solo dopo il consenso alla camera. Se la camera viene rifiutata, il fallback è il mouse.

## 4. GSAP

```bash
pnpm add gsap @gsap/react   # 3.15: tutti i plugin (SplitText, Flip, CustomEase) sono gratuiti
```

## 5. genjutsu (skill motion design)

Installata globalmente in `~/.agents/skills/genjutsu` con link in `~/.claude/skills/genjutsu`. Nei container cloud la reinstalla l'hook `SessionStart` del repo (`.claude/hooks/install-genjutsu.sh`: prova npx e, se fallisce, scarica il release zip da GitHub).

- In locale (Claude Code sul Mac): `npx skills add https://genjutsu.athevon.dev -g`, oppure `/plugin marketplace add AThevon/genjutsu` seguito da `/plugin install genjutsu` per avere `/genjutsu:cast` e `/genjutsu:paint`.
- Codex: lo stesso comando npx la installa anche per Codex (supporto "community").
- Audit senza modello: `python3 ~/.agents/skills/genjutsu/_jutsu/design-audit/scripts/audit.py . --group tells`
