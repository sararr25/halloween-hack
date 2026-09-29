# Handover

Status as of 2026-09-29 (evening) · branch `claude/youthful-pascal-m6eofy` · no PR opened yet.

Read in this order: this file → `project.md` (concept, twist, scene outline) → `docs/desktop.md` (experience decisions, desktop structure, the Sign) → `docs/scenes.md` (per-scene animation/interaction spec, implementation status, tuning) → `docs/tech-setup.md` (install, Rive CLI, MediaPipe, troubleshooting).

## TL;DR

- Hackathon: Contra × Rive Halloween challenge, solo, 18 days. Psychological thriller on a fake desktop OS; twist = "you are the one being watched", built from real session data.
- **Working today at `/`:** premise → **S1 boot** (English recovery log, camera + microphone asked in one prompt as "operator verification", calibration, Rive eye) → **desktop with all apps filled** (Mail, Photos, Messages, Notes, History, Phone, Trash, backup_you, Camera). Story content lives in `lib/story/content.ts`.
- **Progression works end to end:** holding the lens on the figure in IMG_0418 → stage 2 (REC, Camera opens by itself, `backup_you`, IMG_0419, E.V.'s voicemail, live searches) → code = entry time `HHMM` (or Victory gesture with camera) → stage 3. The anonymous sender nudges ("Start with the mail", "…check her notes" after 2 wrong codes, one idle nudge per stage).
- **WGSL:** IMG_0418 is drawn entirely by a WGSL shader in Rive (`rive/photo`), with a lens that sharpens and magnifies under the cursor. The overlay shader (`rive/effects`) now really renders on the web: it needed `enableGPUCanvas: true` (before, only the watermark showed).
- **Sound (procedural, `lib/audio/sfx.ts`):** Web Audio only, no files: keystrokes on every typed text (boot log, anonymous notes, E.V.'s dated note, live searches), glitch sounds, soft notification, room-tone drone that thickens per stage. Unlocked by the "Open" click; mute toggle (menubar, or bottom right before the desktop), saved in `localStorage`.
- **Glitch:** scheduled by the page (`Overlay` in `Experience.tsx`): each one fires the shader tear (`fx/pulse`), a 140 ms RGB split of the page (`[data-glitch]`) and the sound together. Cadence 6–11 s / 2.5–5 s / 0.8–2 s per stage. Story moments call `glitchNow()`.
- **Boot:** no eye (it would reveal the head tracking). A viewfinder; on "hold still" the operator's silhouette is traced with a scan line and reference points ("reconstructed" when the camera is refused).
- **Desktop decor** (`Decor.tsx`, content in `content.ts`): the Sign on the wallpaper (moves only while you look away), calendar widget with events that appear by themselves, Memento polaroid (rewritten at stage 3), files `invitation.pdf` (The Game), `operator_manual.pdf`, `Screenshot 23.02.png` (shows *your* open windows), `viewers 1→3` in the menubar, cracked glass at stage 2–3. Icons open with a single click.
- **Next:** S8 session log, S9 reveal, S10 login; real photos/audio.

## How to run

```bash
git checkout claude/youthful-pascal-m6eofy
corepack enable && corepack prepare pnpm@10.33.0 --activate   # project pins pnpm 10.33
pnpm install        # also runs scripts/sync-assets.mjs (wasm + MediaPipe models → public/)
pnpm dev            # http://localhost:3000 (experience) · /lab (S1 eye test bench)
```

At `/`: Open → Start recovery → double-click icons. Dev only: Alt+1/2/3 = stage, Alt+P/B/D/R/L = phase (premise/boot/desktop/reveal/login).

If `pnpm dev` says "Another next dev server is already running", use the existing one on :3000 or `kill <PID>` it.

In `/lab`: "Avvia recupero" → allow camera → hold still 2 s. Press `D` for the debug overlay (source, headX/Y, lookingAway, faceLost, gesture, hands status, raw gesture).

Other scripts:

| Script | Does |
|---|---|
| `pnpm rive:build` | compiles `rive/presence` → `public/rive/presence.riv` (no scripts, unsigned is fine, works in the cloud container) |
| `pnpm rive:publish` | signs `rive/effects` and `rive/photo` → `public/rive/*.riv` (**Mac only**, needs `rive login`; commit the output; the CLI sometimes segfaults while signing: rerun) |
| `pnpm lint` / `pnpm build` | both clean at the last commit |

## Architecture

```
webcam ─▶ tracker.ts (main) ──ImageBitmap──▶ presence-worker.js (MediaPipe FaceLandmarker + GestureRecognizer)
                ▲                                         │ numbers only (matrix m8/m9/m10, blink score, top gesture)
                └──────────── apply(): yaw/pitch, EMA, lookingAway, blink, gesture hold ◀─┘
                │ PresenceState + onBlink/onGesture
                ▼
Boot.tsx (S1) ─▶ PresenceEye.tsx ─▶ Rive view model "Presence" (headX, headY, lookingAway, blink)
             └─▶ FxOverlay.tsx  ─▶ Rive view model "Overlay.fx" (grain, vignette, glitch, neon) → WGSL
```

| Path | What |
|---|---|
| `app/lab/Boot.tsx`, `lab.module.css` | S1: diegetic camera request, calibration, status line (GSAP typewriter), gesture replies (`GESTURE_LINES`, placeholder copy), debug overlay |
| `lib/presence/tracker.ts` | `PresenceTracker`: public API `startMouse()`, `startCamera(video)`, `calibrate()`, `stop()`, events `onChange/onBlink/onGesture`. All tuning constants at the top |
| `public/presence-worker.js` | classic worker, `importScripts('/mediapipe/vision_bundle.js')` (IIFE global `Vision`). One frame in flight |
| `components/PresenceEye.tsx` | loads `/rive/presence.riv` with `@rive-app/webgl2`, writes the view model |
| `components/FxOverlay.tsx` | mounts `/rive/effects.riv` only if it exists (HEAD check); a 404 in the console until it is signed is expected |
| `rive/presence/` | Rive CLI project, the eye: RML only, data binding + state machine (Blink, Attention layers), cubic lag converters |
| `rive/effects/` | Rive CLI project: `overlay_fx.wgsl` + `fx.luau` (ScriptedLayout → GPUCanvas → drawImage). `shaderOutputs: [glsl, wgsl]` |
| `scripts/sync-assets.mjs` | copies MediaPipe/Rive wasm and IIFE bundle into `public/`, downloads models (gitignored) |
| `.claude/hooks/session-setup.sh` | cloud SessionStart: genjutsu skill, Rive CLI + EGL libs, `pnpm install` |
| `lib/story/store.tsx` | `StoryProvider` + `useStory()`: reducer with `phase`, `stage`, `windows` (open order kept for S9), `clues` (ms since start), `openedAt`, `session` (camera/mic answer + time), `notices`, `wrongCodes`. Dev shortcuts |
| `lib/story/content.ts` | **all story text**: mails, photos, chats, notes, searches, calls/voicemails, trash, backup readme. Tokens `{{entry}}`, `{{now}}`, `{{today}}` are filled with the user's session data |
| `lib/story/time.ts` | `clock`, `entryCode` (backup password), `duration`, `daysAgo`, `today` |
| `lib/presence/context.tsx` | `PresenceProvider`: one `PresenceTracker` for the whole experience, hidden `<video>`, `usePresenceEvent`, `useLookingAway` |
| `components/desktop/Experience.tsx` | phase switch (premise, S1 boot, desktop, reveal/login placeholders) + small-screen diegetic block |
| `components/desktop/Boot.tsx` | S1: recovery log (typewriter), camera + mic request, calibration, Rive eye; timer-based hand-off to the desktop |
| `components/desktop/Desktop.tsx` | menubar (E.V., **Recovery** menu with the session log = where the entry time can be read again, clock, REC), icons, windows, `useDirector` (clues → stages, anonymous nudges), Notices, FxOverlay |
| `components/desktop/views/*` | one file per app. `PhotoLens.tsx` drives `photo.riv` (lens, figure swap while `lookingAway`, silhouette per stage, "found" after 700 ms on the figure) |
| `rive/photo/` | IMG_0418: `photo_lens.wgsl` draws the whole night photo + the lens; `lens.luau` feeds uniforms from the `Photo` view model |
| `components/desktop/Window.tsx` | glass window: GSAP open from icon, fade close, drag by title bar, focus/z-order |
| `components/desktop/apps.tsx` | app registry (title, glyph, size, `iconFrom` stage, placeholder body) |
| `prototype/design-mockup.html` | static visual mockup of the desktop in the 3 stages (reference only) |

Key decisions and why:

- **Eye has no scripts** → unsigned `.riv` plays on the web, so it can be built in the cloud. Anything needing Luau/WGSL lives in a separate Rive project that is signed on the Mac.
- **MediaPipe in a classic worker, not bundled** → Next/Turbopack module workers break MediaPipe's `importScripts` loader. The worker kept the animations at 60 fps: on a CPU-only container, fps with tracking went from 3 to about 27.
- **Self-hosted wasm/models** → no runtime CDN (jsdelivr is blocked in cloud containers, and self-hosting is more robust).
- **Camera asked for inside the fiction, with a mouse fallback for everything.** A refusal is stored (`localStorage recovery.cameraDenied`) for the story to use. Frames never leave the browser.

## Verified vs not

| | Status |
|---|---|
| Eye follow / blink / look-away in Rive (CLI screenshots) | ✅ |
| Worker pipeline loads and runs (Playwright + fake camera) | ✅ |
| Real face + gestures on the owner's Mac (Chrome) | ✅ head direction correct, blink OK, look-away OK, gestures OK (open palm weakest) |
| Head sensitivity after retune (18°/12°) and faster lag (0.3 s) | ✅ owner confirmed "funziona" |
| WGSL overlay in a browser | ✅ renders (grain, vignette, glitch tears) since `enableGPUCanvas: true`; **Rive free-plan watermark** on top |
| WGSL photo + lens (IMG_0418) in a browser | ✅ in-app browser (Chrome): lens, found → stage 2 |
| S1 boot inside `/` | ✅ refusal path (camera blocked in the in-app browser). ❌ **grant path with a real camera + mic not tested yet** |
| Apps S2–S7, stages 1→2→3, nudges, wrong codes, entry-time password | ✅ in-app browser |
| Desktop skeleton: open/drag/close/focus windows, stage 1→2→3, Camera opens once | ✅ in-app browser (Chrome) |
| Safari / Firefox, low-end hardware | ❌ untested |
| Vercel deploy | ❌ not done |

## Owner actions pending

1. Decide the Rive plan: the watermark is visible now; removing it needs Cadet or higher (paid).
2. Decide tone and voice of the copy (replaces the placeholder gesture replies).

## Next steps (recommended order)

1. Owner: test S1 on the Mac with the real camera + mic (one prompt for both), then the whole path to stage 3. Read the content in `lib/story/content.ts` and change the tone where it is off.
2. S8 session log (Rive `session_log`, real `sessionSeconds`, "no need to cover yourself"), S9 reveal (`corruption` + `mirror_dither` shaders, windows closing in reverse, ~1 s of ambient audio), S10 login + case list + CRT switch-off.
3. The Sign (design + "moves only when you are not looking"). Photos: AI images for the 15 placeholder tiles (IMG_0418 stays the shader). Audio: TTS for voice memos/voicemails (the Phone app shows a text description of the audio until then).
4. Gesture polish: per-gesture thresholds (Open_Palm lower), S7 gesture unlock, S8 "non serve coprirti".
5. Deploy to Vercel (HTTPS needed for camera). Run `pnpm install` in the build so the models are fetched.
6. Playtest, `prefers-reduced-motion` pass, perf on low-end hardware.

## Known issues / gotchas

- The in-app/automation browser pauses `requestAnimationFrame` when the pane is hidden, so GSAP animations (and window close, which completes on animation end) seem stuck. Not a bug: test with the page visible.
- `docs/scenes.md` S10 is superseded by `docs/desktop.md` (case list + CRT switch-off).
- **Never tear down a Rive instance that uses `enableGPUCanvas` mid-session:** its `cleanup()` can crash (`glDeleteTextures` on an undefined context), the error unmounts the page and the camera stops. The overlay is mounted once in `Experience.tsx`; the photo lens is a singleton whose canvas is detached, not destroyed.
- **Rive web + WGSL:** `enableGPUCanvas: true` is required; script 2D canvases (`context:canvas()`) do not work on the web; some WGSL compiles in the CLI but draws black on WebGL2 (`half` is reserved, `u32` colour decoding). See `docs/tech-setup.md` §2.
- In the in-app browser the page is often "hidden": Rive and GSAP draw only when the pane renders frames, so screenshots can look black or stuck. Move the mouse over the canvas / take a second screenshot.

- Dev-only Next overlays from **browser extensions** (`bis_skin_checked` hydration warning, `M_ID` TypeError from `chrome-extension://…`) are not our code. Ignore them, or use incognito.
- A pnpm error mentioning unrelated packages (alchemy/prisma…) means pnpm is reading another project, or pnpm 11 is in use. See `docs/tech-setup.md` §7.
- `rive login` cannot complete inside cloud containers (localhost OAuth redirect).
- `next dev` rewrites the `AGENTS.md` Next block. Commit it as is.
- The mockup in `prototype/` still has placeholder content (`m.lenhart`, CSS photos).

## Design direction (unchanged)

### Decisions (agreed with the owner)

| Topic | Decision |
|---|---|
| Format | Desktop website simulating a computer OS (not mobile) |
| Mood | Dark, horror-leaning psychological thriller; no Halloween clichés |
| Main color | **No red or orange** as main color (too common/sloppy) |
| Palette | **"Ink"** — blue-black base, slate greys, bone-white text |
| Neon | One blinding neon, **electric cyan `#00f0ff`**, used sparingly |
| Materials | Frosted glass windows, heavy blur, film grain, vignette, glitch |
| Narrative arc | Stage A "perfect life" → B surveillance moments → C corruption |

#### Palette tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#06080d` | Page background |
| `--glass` | `rgba(15,19,28,.45)` | Window/icon glass fill |
| `--text` | `#d8dce5` | Body text |
| `--muted` | `#646b7a` | Metadata, timestamps only (low contrast, never body copy) |
| `--accent` | `#eef0f4` | Neutral highlight (white + grey underline) |
| `--ghost` | `#8a96b3` | Glitch RGB-split colour (becomes neon in stage 3) |
| `--neon` | `#00f0ff` | The single neon |

Fonts: Inter Tight (UI) + JetBrains Mono (paths, timestamps, metadata), via Google Fonts.

#### Neon rule

Cyan always means "something that knows about you". Its usage grows with tension:

- **Stage 1:** none.
- **Stage 2:** one element only — the newly appeared `backup_you` folder (breathing glow).
- **Stage 3:** the lit window across the street, lines built from real session data (e.g. "you opened this at HH:MM"), and glitch RGB-split flashes.

Never more than 1–2 neon elements per screen, otherwise it turns cyberpunk.

#### Stage behaviour

| | Stage 1 · Perfect | Stage 2 · Watched | Stage 3 · Corrupted |
|---|---|---|---|
| Grain / vignette | low | medium | high |
| Glitch frequency | every 9–16 s (subliminal) | every 3.5–7 s | every 0.9–2.6 s + note shivers |
| New elements | — | webcam window, REC indicator, "photo taken from outside" toast, `backup_you` folder, silhouette in lit window | note text rewritten with real session time, "you spent Ns getting here" toast, face blurred in photo |

Glitches and animations are disabled under `prefers-reduced-motion`.

### Design open points

1. Stage 3 glass still carries a faint cool tint — neutralise if it reads purple.
2. Placeholder content (`m.lenhart`, dates, CSS-drawn photos) is illustrative only; real story assets still to be written/produced.
3. Monochrome UI can hide what's clickable — solve with motion (hover glow, breathing) rather than colour.
4. Tokens are ported to CSS variables in `app/globals.css`. Windows still have to become draggable, openable apps (Notes, Photos, Messages, History, Trash, backup folder).
5. The session-data twist (open time, time to find clues, back-navigation) is still to be built in-app (client-side only, no personal data sent anywhere).
