# Handover

Status as of 2026-09-29 · branch `claude/youthful-pascal-m6eofy` · no PR opened yet.

Read in this order: this file → `project.md` (concept, twist, scene outline) → `docs/scenes.md` (per-scene animation/interaction spec, implementation status, tuning) → `docs/tech-setup.md` (install, Rive CLI, MediaPipe, troubleshooting).

## TL;DR

- Hackathon: Contra × Rive Halloween challenge, solo, 18 days. Psychological thriller on a fake desktop OS; twist = "you are the one being watched", built from real session data.
- **Working today:** `/lab`, a minimal S1. A Rive eye follows your head via the webcam, blinks when you blink, contracts when you look away, and answers hand gestures. The owner tested it on a Mac and it works.
- **Also working:** the Rive WGSL overlay (grain, vignette, glitch). It was signed on the Mac (`rive push` bound it to file 2618191 in project 2005592) and shows in the browser.
- **Next step:** build the screens, interactions and animations. Start with the desktop OS shell, then S1→S10 (plan below).

## How to run

```bash
git checkout claude/youthful-pascal-m6eofy
corepack enable && corepack prepare pnpm@10.33.0 --activate   # project pins pnpm 10.33
pnpm install        # also runs scripts/sync-assets.mjs (wasm + MediaPipe models → public/)
pnpm dev            # http://localhost:3000/lab  ("/" redirects there)
```

In `/lab`: "Avvia recupero" → allow camera → hold still 2 s. Press `D` for the debug overlay (source, headX/Y, lookingAway, faceLost, gesture, hands status, raw gesture).

Other scripts:

| Script | Does |
|---|---|
| `pnpm rive:build` | compiles `rive/presence` → `public/rive/presence.riv` (no scripts, unsigned is fine, works in the cloud container) |
| `pnpm rive:publish` | signs `rive/effects` → `public/rive/effects.riv` (**Mac only**, needs `rive login`; commit the output) |
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
| `components/FxOverlay.tsx` | mounts the signed `/rive/effects.riv` (HEAD check first); levels are passed in as props |
| `rive/presence/` | Rive CLI project, the eye: RML only, data binding + state machine (Blink, Attention layers), cubic lag converters |
| `rive/effects/` | Rive CLI project: `overlay_fx.wgsl` + `fx.luau` (ScriptedLayout → GPUCanvas → drawImage). `shaderOutputs: [glsl, wgsl]` |
| `scripts/sync-assets.mjs` | copies MediaPipe/Rive wasm and IIFE bundle into `public/`, downloads models (gitignored) |
| `.claude/hooks/session-setup.sh` | cloud SessionStart: genjutsu skill, Rive CLI + EGL libs, `pnpm install` |
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
| WGSL overlay in a browser (signed) | ✅ owner confirmed on Mac |
| Safari / Firefox, low-end hardware | ❌ untested |
| Vercel deploy | ❌ not done |

## Owner actions pending

1. Tell us the Rive plan: a watermark appears if the workspace is below Cadet. None reported so far.
2. Decide the tone and voice of the copy. It replaces the placeholder gesture replies and will be needed for every screen.
3. Every time `rive/effects` changes: `pnpm rive:publish` on the Mac, then commit `public/rive/effects.riv` **and** any `scene.rml` id write-back.

## Next step: screens, interactions, animations

Follow `docs/scenes.md` per scene. Suggested build order, each step demoable on its own:

1. **Experience state** (`lib/experience/`): one store (React context + reducer, or `useSyncExternalStore`) holding `stage` (1–3), `scene` (S1–S10), found clues, and `session` data: open time, time to each clue, back-navigations, camera refused, look-away count. Persist the session part in `localStorage` for the "not your first time" beat. Everything stays client-side.
2. **Stage → effects:** map `stage` to `FxOverlay` levels (stage table below), tweened with GSAP over 1.2–2 s. Map it to the `Presence` eye behaviour too.
3. **Desktop shell** (`components/os/`): wallpaper, icon grid, frosted-glass `Window` (drag, focus/z-order, open with GSAP Flip from the icon at 280 ms `cubic-bezier(0.2,0,0,1)`, close at 180 ms opacity), toast system. Port the look from `prototype/design-mockup.html`. Keep hover glow and breathing for affordance (monochrome UI).
4. **Move S1 out of `/lab`** into the real flow: boot → desktop. Keep `/lab` as the sandbox with the `D` overlay.
5. **Apps and scenes in story order:** S2 Mail, S3 Photos (needs WGSL `lens` shader), S4 Chat (fake choice, `webcam_widget` Rive), S5 Notes (real date, SplitText typewriter), S6 History (`ghost_cursor` Rive), S7 Backup (password + gesture unlock, `backup_you` neon), S8 session log (data-bound Rive text), S9 reveal (GSAP master timeline + `corruption` and `mirror_dither` shaders, `window_across` Rive), S10 login.
6. **Rive asset split:** script-free assets (eye, silhouette, cursor, folders) go in their own projects under `rive/`, buildable in the cloud with `pnpm rive:build`-style scripts. Anything with Luau/WGSL goes in `rive/effects` (or a sibling), signed on the Mac.
7. **Content:** placeholder copy is fine while building, marked `// COPY:` so it is easy to find and replace.

Per screen, done means: works with the camera and with the mouse fallback, respects `prefers-reduced-motion`, neon rule held (≤2 cyan elements), lint/build clean, a screenshot sent to the owner.

## Later

- Gesture polish: per-gesture thresholds (Open_Palm lower).
- Deploy to Vercel (HTTPS is required for the camera). The build must run `pnpm install` so the models are fetched.
- Playtest, `prefers-reduced-motion` pass, perf on low-end hardware, Safari/Firefox.

## Known issues / gotchas

- Dev-only Next overlays from **browser extensions** (`bis_skin_checked` hydration warning, `M_ID` TypeError from `chrome-extension://…`) are not our code. Ignore them, or use incognito.
- A pnpm error mentioning unrelated packages (alchemy/prisma…) means pnpm is reading another project, or pnpm 11 is in use. See `docs/tech-setup.md` §7.
- `rive login` cannot complete inside cloud containers (localhost OAuth redirect).
- After any Rive build on the Mac, `scene.rml` may change (the CLI writes ids back). Commit it along with the `.riv`.
- If a push is rejected on the Mac: `git stash && git pull --rebase && git push && git stash pop`.
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
