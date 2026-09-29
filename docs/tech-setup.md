# Tech setup: Rive CLI, WGSL, MediaPipe, GSAP, genjutsu

Verificato il 2026-09-29 sui sorgenti ufficiali (`rive-app/rive-docs`, npm registry). Vale per Claude Code (web + locale) e per Codex.

## 0. Rete: domini da consentire

I container cloud (Claude Code web, Codex) hanno un'allowlist di rete. Serve:

| Dominio | Perché | Stato qui (2026-09-29) |
|---|---|---|
| `releases.rive.app` | installer Rive CLI | ✅ (aperto il 2026-09-29) |
| `api.rive.app` / `*.rive.app` | `rive login`, `--publish`, `push/pull` | ✅ |
| `registry.npmjs.org` | pnpm/npm | ✅ |
| `storage.googleapis.com` | modelli MediaPipe `.task` | ✅ |
| `github.com` | fallback genjutsu | ✅ |

Claude Code web: impostazioni dell'environment → Network access (custom allowlist). Codex: environment settings → Internet access → allowlist con gli stessi domini.

## 1. Rive CLI

```bash
curl -fsSL https://releases.rive.app/cli/install.sh | bash # Linux x86_64 / macOS Apple Silicon (con `sh`=dash su Ubuntu fallisce: usare bash)
export PATH="$HOME/.rive/bin:$PATH"                       # aggiungilo a ~/.zshrc o ~/.bashrc
rive doctor
# Linux headless: servono le librerie EGL/GL → apt-get install libegl1 libgl1 libgles2
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
- **Login nei container cloud:** `rive login` apre un OAuth con redirect su `127.0.0.1` del container, che il tuo browser non raggiunge. Quindi login e `--publish` si fanno **in locale sul Mac**. Nel container si fa tutto il resto (build, verify, screenshot, test).
- Strategia adottata: gli asset "vivi" (es. `rive/presence`) sono **senza script**, solo RML + data binding, quindi il `.riv` non firmato gira sul web. Gli shader WGSL (che richiedono script Luau) vanno in un progetto Rive separato, firmato dal Mac con `--publish`.
- `rive create x --from-rev=file.rev` converte un file esportato dall'Editor in progetto testuale; `rive pull` e `rive push` sincronizzano con l'Editor.

## 2. Shader WGSL in Rive (sintesi operativa)

- Solo vertex + fragment, massimo 4 bind group. Niente compute shader, niente `override`, f64, push constants.
- Lo shader disegna su un `GPUCanvas` da uno script Luau: `context:gpuCanvas{}`, `context:shader('Nome')`, `GPUPipeline.new{}`, `canvas:beginRenderPass{}`, `pass:draw(3)`, `renderer:drawImage(canvas.image, ...)`.
- **Uniform**: `GPUBuffer` in `GPUBindGroup` (`@group/@binding` combacianti). Il valore arriva da script input o da **data binding**, quindi l'app JS lo pilota tramite view model (è così che MediaPipe arriva fino allo shader).
- **Post-process di un artboard** (offscreen `context:canvas()` + `instance:draw` + `image:view()`): funziona nella CLI ma **non sul web** con `@rive-app/webgl2` 2.43.1 ("context:canvas() requires a RenderContext"). Per questo la foto IMG_0418 è disegnata direttamente nello shader (`rive/photo/photo_lens.wgsl`).
- **Shader targets** (nell'Editor o in `rive.yaml`): per il web servono **GLSL ES 300** (WebGL2) e **WGSL** (WebGPU). Un target non incluso = shader che non si carica su quel backend.
- Runtime web: `@rive-app/webgl2` (2.43.x). **Serve `enableGPUCanvas: true`** nelle opzioni di `new Rive({...})`, altrimenti i `GPUCanvas` degli script non vengono disegnati (si vede solo il watermark). Verificato il 2026-09-29.

### Trappole WGSL → GLSL (web, verificate il 2026-09-29)

La CLI compila e mostra tutto bene; sul web lo shader passa per GLSL ES 300 e alcune cose falliscono **in silenzio** (nessun errore in console, output nero):

| Problema | Soluzione |
|---|---|
| Identificatori riservati in GLSL (`half`, e per prudenza `window`, `sample`, `input`, `output`) | rinominare (`hs`, `pane`, …) |
| Colori decodificati da `u32` con shift (`(h >> 16u) & 255u`) | costanti `vec3<f32>` già calcolate |
| `GPUSampler.new` nel costruttore dello script | crearlo in `init` (prima non esiste il contesto GPU) |
| `target` come nome di variabile | è riservato in WGSL stesso (la CLI dà errore): rinominare (`aim`) |
| `sed` con `\b` per rinominare identificatori sul Mac | il `sed` di macOS non supporta `\b`: usare Python/`re` |

Test rapido quando lo schermo resta nero: `clearColor` rosso nel render pass. Rosso visibile = il pass gira e il problema è nello shader.

### Ciclo di vita delle istanze Rive con GPU canvas (web)

- Con `enableGPUCanvas: true`, `rive.cleanup()` può lanciare `Cannot read properties of undefined (reading 'deleteTexture')`. L'errore smonta la pagina React e la camera si spegne.
- Regola: **mai distruggere a metà sessione** un'istanza che usa GPU canvas. L'overlay è montato una volta sola in `Experience.tsx`; la foto IMG_0418 è un singleton (`lensInstance()` in `PhotoLens.tsx`) il cui canvas viene staccato dal DOM con `stopRendering()`, non distrutto.
- I valori che cambiano a ogni frame (posizione della testa per il faro) si scrivono direttamente nel view model (`vm.number("fx/headX").value = …`), non passando dallo stato React.
- Gli strappi di glitch sono decisi dalla pagina: cambia `fx/pulse` e lo script Luau fa partire lo strappo. Così shader, pagina e suono sono sincronizzati.

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

Come è implementato (vedi `lib/presence/tracker.ts` e `public/presence-worker.js`):

- `pnpm install` esegue `scripts/sync-assets.mjs`, che copia i file WASM e il bundle IIFE (`vision_bundle.js`) in `public/mediapipe/` e scarica i due modelli in `public/models/`. Sono file generati, esclusi da git.
- MediaPipe gira in un **Web Worker classico** (`public/presence-worker.js`, `importScripts` del bundle IIFE). Non passa dal bundler di Next: il loader WASM di MediaPipe si aspetta proprio `importScripts`.
- Il main thread cattura un frame con `requestVideoFrameCallback`, lo trasforma in `createImageBitmap` e lo invia al worker come oggetto trasferibile. Un solo frame alla volta, massimo ~33 Hz. Il worker restituisce solo numeri: tre valori della matrice, un punteggio di battito e la gesture principale.
- Sul main thread restano la conversione in yaw/pitch, il filtro EMA e le soglie di `lookingAway`, blink e gesture.
- Delegate GPU, con fallback su CPU. Se la camera o il worker falliscono, si passa al mouse.

Gesture predefinite: `Open_Palm`, `Closed_Fist`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`, `None`.
Regole: richiede HTTPS (Vercel ok, `localhost` ok). I frame non lasciano mai il browser. Si caricano i modelli solo dopo il consenso alla camera. Se la camera viene rifiutata, il fallback è il mouse.

## 3b. Audio

Nessuna dipendenza e nessun file: `lib/audio/sfx.ts` genera tutto con la Web Audio API (rumore filtrato, oscillatori, un compressore sul master). Il browser tiene l'audio bloccato fino a un gesto dell'utente: lo sblocca il clic su "Open" (`unlockAudio()`). Saltando le fasi con `Alt+D` l'audio resta bloccato. Il mute è salvato in `localStorage` (`recovery.muted`). Il browser integrato di Claude non ha audio: i suoni vanno provati su un browser vero.

## 4. GSAP

```bash
pnpm add gsap @gsap/react   # 3.15: tutti i plugin (SplitText, Flip, CustomEase) sono gratuiti
```

## 5. genjutsu (skill motion design)

Installata globalmente in `~/.agents/skills/genjutsu` con link in `~/.claude/skills/genjutsu`. Nei container cloud la reinstalla l'hook `SessionStart` del repo (`.claude/hooks/install-genjutsu.sh`: prova npx e, se fallisce, scarica il release zip da GitHub).

- In locale (Claude Code sul Mac): `npx skills add https://genjutsu.athevon.dev -g`, oppure `/plugin marketplace add AThevon/genjutsu` seguito da `/plugin install genjutsu` per avere `/genjutsu:cast` e `/genjutsu:paint`.
- Codex: lo stesso comando npx la installa anche per Codex (supporto "community").
- Audit senza modello: `python3 ~/.agents/skills/genjutsu/_jutsu/design-audit/scripts/audit.py . --group tells`

## 6. Sul Mac: primo avvio e firma degli shader

1. `git clone https://github.com/sararr25/halloween-hack && cd halloween-hack && git checkout claude/youthful-pascal-m6eofy`
2. Node 22 (`node -v`), poi `corepack enable && corepack prepare pnpm@10.33.0 --activate`
3. `pnpm install` (lo script finale scarica i modelli MediaPipe; se fallisce: `pnpm install --ignore-scripts && node scripts/sync-assets.mjs`)
4. `pnpm dev` → `http://localhost:3000/lab` → "Avvia recupero" → `D` per il pannello debug
5. `brew install --cask rive-app/tap/rive-cli && rive doctor && rive login`
6. Una sola volta: `rive push rive/effects` (lega il progetto a un file del tuo account e toglie il watermark se il workspace è Cadet+)
7. A ogni modifica degli shader: `pnpm rive:publish` e poi commit di `public/rive/effects.riv` e `public/rive/photo.riv` (firmati). La CLI 1.2.0 a volte va in segmentation fault durante la firma: basta rilanciare. Finché il file non esiste, l'overlay resta spento e l'app funziona lo stesso.
8. L'occhio (`rive/presence`) non ha script: basta `pnpm rive:build`, anche nel container.

## 7. Problemi noti e soluzioni

| Sintomo | Causa | Soluzione |
|---|---|---|
| `pnpm install`/`pnpm dev`: `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` con pacchetti estranei (alchemy, prisma, cloudflare…) | pnpm sta leggendo un altro progetto (branch sbagliato senza `package.json`) e/o pnpm 11 globale | `git checkout claude/youthful-pascal-m6eofy`, `corepack enable && corepack prepare pnpm@10.33.0 --activate`, `rm -rf node_modules && pnpm install`. Non disattivare `minimumReleaseAge` |
| Overlay Next "hydration mismatch" con `bis_skin_checked` | estensione del browser (antivirus/ad-blocker) che modifica l'HTML | ignorare, solo in dev; in incognito sparisce |
| Overlay Next `Cannot read properties of undefined (reading 'M_ID')` da `chrome-extension://…` | errore interno di un'estensione | ignorare; non è codice nostro |
| Nel pannello `D` mancano le righe `hands`/`raw` | codice locale non aggiornato | `git pull` |
| La mano aperta viene riconosciuta poco | `Open_Palm` è la gesture più fragile del modello | mano intera nell'inquadratura, a 40–60 cm, palmo verso la camera, buona luce; se `raw` mostra un punteggio basso, abbassare la soglia solo per quella gesture |
| `rive login` non funziona nel container cloud | OAuth con redirect su `127.0.0.1` del container | login e `--publish` solo sul Mac |
| Installer Rive fallisce con `set: Illegal option -o pipefail` | lanciato con `sh` (dash) | usare `| bash` |
| `rive: libEGL.so.1` mancante su Linux | niente librerie GL | `apt-get install libegl1 libgl1 libgles2` (lo fa l'hook di sessione) |
