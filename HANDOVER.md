# Handover

Status as of 2026-09-29 (night) · branch `claude/youthful-pascal-m6eofy` · no PR opened yet · last code commit `f7a1ba8`.

Read in this order: this file → `project.md` (concept, twist, scene outline, checklist) → `docs/desktop.md` (experience decisions, desktop structure, decor, sound, copy rules) → `docs/scenes.md` (per-scene spec + implementation status) → `docs/tech-setup.md` (install, Rive CLI, WGSL traps, MediaPipe, troubleshooting) → `docs/image-prompts.md` (photos to generate).

## TL;DR

- **What it is:** Contra × Rive Halloween challenge, solo, 18 days. A psychological thriller on a fake desktop OS. The user "recovers" the files of E.V., missing for 7 days; the twist is that the user is the one being watched, built from real session data (entry time, time to each clue, camera answer).
- **Playable today at `/`, end to end up to stage 3:** premise → S1 boot → desktop with every app filled → stage 1 → 2 → 3. S8 (session log), S9 (reveal) and S10 (login) are still placeholders.
- **Rive + WGSL in use:** three Rive projects. `presence` (Eye for `/lab`, Lens for the Camera window, no scripts), `effects` (full-screen overlay: grain, vignette, glitch tears, searchlight), `photo` (IMG_0418 drawn entirely in a WGSL shader, with a magnifying lens).
- **Sound:** procedural Web Audio, no files. Keystrokes, four glitch sounds (rare), notification, shutter, room tone.
- **Not verified yet:** the grant path with a real camera + microphone after the latest changes (head-following searchlight, Lens shutter on blink, palm answer), and the new sound mix.
- **Waiting on the owner:** the AI photos (`docs/image-prompts.md`), a Mac test with webcam and headphones, a read of the copy in `lib/story/content.ts`, the Rive plan decision (watermark).

## How to run

```bash
git checkout claude/youthful-pascal-m6eofy
corepack enable && corepack prepare pnpm@10.33.0 --activate   # project pins pnpm 10.33
pnpm install        # also runs scripts/sync-assets.mjs (wasm + MediaPipe models → public/)
pnpm dev            # http://localhost:3000 (experience) · /lab (eye test bench)
```

- At `/`: Open (unlocks audio) → Start recovery → allow camera + microphone → desktop. **One click** opens icons and files.
- Dev only: `Alt+1/2/3` = stage, `Alt+P/B/D/R/L` = phase (premise/boot/desktop/reveal/login). Jumping straight to the desktop skips the boot, so audio stays locked until the first click.
- Best test: an **incognito window** (extensions add `bis_skin_checked` attributes and a hydration warning that is not ours) with **headphones**.
- If `pnpm dev` says "Another next dev server is already running", open the existing one on :3000 or `kill <PID>` it.
- `/lab`: "Avvia recupero" → allow camera → hold still 2 s. `D` shows the debug overlay (source, headX/Y, lookingAway, faceLost, gesture, hands status, raw gesture).

| Script | Does |
|---|---|
| `pnpm rive:build` | compiles `rive/presence` → `public/rive/presence.riv` (no scripts, unsigned is fine) |
| `pnpm rive:publish` | signs `rive/effects` and `rive/photo` → `public/rive/*.riv` (**Mac only**, needs `rive login`; commit the output). The Rive CLI 1.2.0 sometimes segfaults while signing: rerun |
| `pnpm lint` / `pnpm build` | both clean at the last commit |

## The experience today, step by step

| Phase | What happens | Where |
|---|---|---|
| Premise | "E.V. has been missing for 7 days…", Open, "best with headphones", sound toggle bottom right | `Experience.tsx` |
| S1 boot | Recovery log typed with keystrokes, including `session opened HH:MM:SS` (the future password). Camera + mic in **one** prompt as "operator verification". A viewfinder: on "hold still" the operator's silhouette is traced (scan line, reference points). Refused: "verification refused", the silhouette is drawn anyway as "operator · reconstructed". No eye: it would reveal the head tracking | `Boot.tsx` |
| Desktop, stage 1 | Anonymous sender: "She kept everything. Start with the mail." Apps on the left, files on the right, calendar, polaroid, the Sign on the wallpaper, searchlight at 25 % | `Desktop.tsx`, `Decor.tsx` |
| → stage 2 | Hold the lens on the figure in the street in IMG_0418 for 700 ms. REC, `viewers 2`, Camera opens by itself (Rive Lens), `backup_you` (neon), IMG_0419 "source: unknown device", E.V.'s voicemail dated after she vanished, searches typed live, Mara "typing…" that never sends, calendar event "23:02 leave the light on", cracked glass, searchlight 60 % | `PhotoLens.tsx`, `useDirector` |
| → stage 3 | `backup_you` code = the local time the page was opened, `HHMM` (or two fingers up with the camera on). Two wrong codes → "…check her notes." Contents: E.V.'s readme + `session_0418.log · in progress`. Toast "you spent Ns getting here", `viewers 3` in neon, full crack, polaroid rewritten "it was never the window", calendar "HH:MM operator", cyan searchlight. Open palm → "no need to cover yourself." | `Backup.tsx`, `useDirector` |
| S8 / S9 / S10 | placeholders | `Experience.tsx` |

Idle help: one nudge per stage after 100 s without progress ("…look at her photos. Closely." / "…it's a time. Four digits."). The Recovery menu in the menubar shows the session log again (entry time, camera answer).

## Architecture

```
webcam ─▶ tracker.ts ──ImageBitmap──▶ presence-worker.js (MediaPipe face + gestures, numbers only)
             │ PresenceState, onBlink, onGesture
             ▼
PresenceProvider (lib/presence/context.tsx) · one tracker for the whole session, hidden <video>
   ├─▶ Camera window ─▶ PresenceEye artboard="Lens" (rive/presence)
   ├─▶ Overlay (Experience.tsx) ─▶ FxOverlay ─▶ effects.riv fx/headX, fx/headY, fx/beam (searchlight)
   ├─▶ PhotoLens (figure swaps while lookingAway)
   ├─▶ TheSign (moves while lookingAway), Messages ("…are you still there?"), Mail (attachment scrambles)
   └─▶ useDirector (palm at stage 3), Backup (Victory gesture)

StoryProvider (lib/story/store.tsx): phase, stage, windows, clues, openedAt, session, notices, wrongCodes
   └─▶ useDirector (Desktop.tsx): clues → stages, anonymous nudges

Overlay (Experience.tsx): glitch scheduler → fx/pulse (shader tear) + body.glitching (DOM split) + glitchSound()
```

| Path | What |
|---|---|
| `lib/story/content.ts` | **All story text**: mails (+ sign-in, usage, tracking, contact sheet, books blocks), photos, chats, notes, searches, calls/voicemails, trash, backup readme, invitation, manual, calendar, polaroid. Tokens `{{entry}}`, `{{now}}`, `{{today}}` |
| `lib/story/store.tsx` | reducer: `phase`, `stage`, `windows` (open order kept for S9), `clues` (ms since start), `openedAt`, `session` (camera/mic answer + time), `notices`, `wrongCodes`. Dev shortcuts |
| `lib/story/time.ts` | `clock`, `entryCode` (backup password), `duration`, `daysAgo`, `today` |
| `lib/story/glitch.ts` | `glitchNow(strength, { sound })`: story moments ask for a glitch now |
| `lib/audio/sfx.ts` | Web Audio engine: `unlockAudio`, `key`, `glitch`, `staticSwell`, `tapeWarble`, `subThud`, `glitchSound` (rotates the four), `shutter`, `blip`, `drone`, mute (`recovery.muted` in localStorage) |
| `lib/presence/tracker.ts` | `PresenceTracker`: `startMouse()`, `startCamera(video, { withMic })`, `calibrate()`, `stop()`. Tuning constants at the top |
| `lib/presence/context.tsx` | `PresenceProvider`, `usePresence`, `usePresenceEvent`, `useLookingAway` |
| `components/desktop/Experience.tsx` | phase switch, the single persistent `Overlay` (glitch scheduler, drone, searchlight), `FloatingSound`, small-screen block |
| `components/desktop/Boot.tsx` + `boot.module.css` | S1 |
| `components/desktop/Desktop.tsx` | menubar (E.V., Recovery menu, `viewers N`, REC, sound, battery, clock), app icons, files, `useDirector`, windows, Notices, Crack |
| `components/desktop/Decor.tsx` | `SignGlyph`, `TheSign`, `Crack`, `CalendarWidget`, `Polaroid` |
| `components/desktop/apps.tsx` | app registry: title, glyph, size, `iconFrom` stage, `place: "file"` for desktop files, body |
| `components/desktop/views/*` | one file per app: `Mail` (+ `mail.module.css`), `Messages` (+ `messages.module.css`), `Photos`, `PhotoLens`, `Notes`, `History`, `Phone`, `Trash`, `Backup`, `Camera`, `Docs` (invitation, manual, screenshot), `shared` |
| `components/desktop/Window.tsx` | glass window: open from icon, fade close, drag, focus/z-order |
| `components/desktop/Notices.tsx` | notifications; the anonymous sender types with keystrokes |
| `components/desktop/SoundToggle.tsx` | mute toggle (`useSyncExternalStore`) |
| `components/FxOverlay.tsx` | mounts `effects.riv`; `levels` prop + `onVm` for per-frame values |
| `components/PresenceEye.tsx` | `presence.riv`, `artboard="Eye"` or `"Lens"` |
| `rive/presence/` | Eye + Lens artboards, RML only, `Presence` view model |
| `rive/effects/` | `overlay_fx.wgsl` + `fx.luau`: grain, vignette, scanlines, tears on `pulse`, searchlight |
| `rive/photo/` | `photo_lens.wgsl` draws IMG_0418 + lens; `lens.luau` feeds uniforms |
| `app/lab/` | the original eye test bench (own overlay, no glitch scheduler) |
| `docs/image-prompts.md` | prompts, names and folders for every AI image |

### Key decisions and why

- **Rive GPU instances are never destroyed mid-session.** With `enableGPUCanvas` the runtime's `cleanup()` can crash (`glDeleteTextures` on an undefined context); the error unmounted the page and switched the camera off. So: one overlay for the whole experience, and the photo lens is a singleton whose canvas is detached, not destroyed.
- **IMG_0418 lives in the shader**, not in a Rive artboard sampled as a texture: script 2D canvases (`context:canvas()`) don't work in the web runtime.
- **Glitches are scheduled by the page**, not by Luau: that's the only way the shader tear, the DOM split and the sound land on the same frame.
- **Glitch sound is much rarer than the visual glitch** (owner feedback: it broke reading) and rotates between four sounds.
- **Presence values that change every frame go straight to the view model** (`onVm` setter), not through React state.
- **No eye in the boot** (owner feedback): showing tracking that early spoils it. Tracking becomes visible in stage 2 (Camera Lens, searchlight) and explicit in stage 3 (palm).
- **One click opens** icons: people expect a web page to answer a single click.
- **MediaPipe in a classic worker, self-hosted assets, camera asked inside the fiction, mouse fallback for everything**: unchanged.

## Verified vs not

| | Status |
|---|---|
| Real face + gestures on the owner's Mac (Chrome), `/lab` | ✅ |
| S1 boot with real camera + mic on the owner's Mac | ✅ ran; the teardown crash it caused is fixed (`c101230`). ⚠️ not re-tested after the silhouette boot |
| Refusal path, whole flow to stage 3 (in-app browser, camera blocked) | ✅ |
| WGSL overlay (grain, tears, searchlight following the mouse) in a browser | ✅ |
| WGSL photo + lens, found → stage 2 | ✅ |
| Rive Lens in the Camera window (follow, narrow on look-away) | ✅ CLI renders + in-app browser |
| Lens shutter on a real blink, searchlight on a real head, palm answer | ❌ needs the owner's webcam |
| Sound (keystrokes, glitch rotation, shutter, drone) | ⚠️ the owner heard an earlier version (too much glitch, fixed); the new mix is unheard |
| Mail and Messages redesign | ✅ in-app browser |
| Safari / Firefox, low-end hardware | ❌ untested |
| Vercel deploy | ❌ not done |

## Owner actions pending

1. **Generate the images** with `docs/image-prompts.md` and drop them into `public/photos/` and `public/wallpaper/` with the exact names. Then ask to wire them.
2. **Test on the Mac with webcam and headphones**, incognito: boot grant path, searchlight on the head, Lens shutter on a blink, palm at stage 3 (`Alt+3` to jump), sound levels.
3. **Read the copy** in `lib/story/content.ts` (mails, chats, notes, invitation, manual) and mark what's off in tone.
4. **Rive plan:** the free-plan watermark shows on every Rive canvas. Removing it needs Cadet or higher (paid) plus `rive push` for `rive/photo`.

## Next steps (recommended order)

1. **Wire the AI photos** when they exist: thumbnails and viewer in `Photos.tsx` (IMG_0418 stays the shader), wallpaper `ev-home.jpg` with the `ev-home-3.jpg` swap at stage 3, `polaroid.jpg` in `Decor.tsx`. A listed file that is missing should fail loudly in dev, not fall back silently.
2. **S8 session log**: a Rive `session_log` with real `sessionSeconds` and "last interruption Ns ago" from `lookingAway` / `document.hidden`; it closes by itself after 20 s.
3. **S9 reveal**: GSAP master timeline, `corruption` + `mirror_dither` WGSL shaders, windows closing in reverse open order, the silhouette in the lit window copying the user 1:1, ~1 s of the user's own ambient audio (mic permission already asked in S1), then black.
4. **S10 login**: empty username field, Enter → case list with `Case #0418 · <typed name>`, CRT switch-off, credits line "No frames or audio left your device."
5. **Audio assets**: TTS for voice memos and voicemails (the Phone app shows a text description of the audio until then). Check licences.
6. **Ship**: Vercel (HTTPS for the camera; the build must run `pnpm install` so the models are fetched), playtest, `prefers-reduced-motion` pass, Safari/Firefox, low-end hardware.

## Known issues / gotchas

- **Rive web + WGSL** (details and fixes in `docs/tech-setup.md` §2): `enableGPUCanvas: true` is required; never destroy those instances mid-session; no script 2D canvases on the web; some WGSL compiles in the CLI but draws black on WebGL2 (reserved words like `half`; `u32` colour decoding); `target` is reserved in WGSL itself. When a shader draws black, set the render pass `clearColor` to red: red visible = the pass runs and the problem is in the shader.
- **In-app browser**: the pane is often "hidden", so `requestAnimationFrame` pauses. GSAP, Rive and screenshots look stuck or black until the mouse moves over the page. Phase changes run on timers for this reason. Camera and audio are blocked there.
- **Hydration warning with `bis_skin_checked` / `bis_register`**: a browser extension, not our code. Use incognito.
- The first frames of every Rive canvas can show the watermark on black while the file loads.
- `docs/scenes.md` S10 is superseded by `docs/desktop.md` (case list + CRT switch-off).
- A pnpm error mentioning unrelated packages (alchemy/prisma…) means pnpm is reading another project, or pnpm 11 is in use. See `docs/tech-setup.md` §7.
- `rive login` cannot complete inside cloud containers (localhost OAuth redirect).
- `next dev` rewrites the `AGENTS.md` Next block. Commit it as is.
- `prototype/design-mockup.html` is the old static mockup (placeholder content), reference only.

## Design direction

### Decisions (agreed with the owner)

| Topic | Decision |
|---|---|
| Format | Desktop website simulating a computer OS (not mobile) |
| Mood | Dark psychological thriller; no Halloween clichés, no gore, no jumpscares |
| Main color | **No red or orange** as main color |
| Palette | **"Ink"**: blue-black base, slate greys, bone-white text |
| Neon | One neon, **electric cyan `#00f0ff`**, used sparingly |
| Materials | Frosted glass (windows nearly opaque for reading), film grain, vignette, glitch |
| Narrative arc | Stage 1 "perfect life" → 2 surveillance → 3 corruption |
| Copy | No AI-sounding copy, **no em dashes** in anything the user reads |

#### Palette tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#06080d` | Page background |
| `--glass` | `rgba(15,19,28,.45)` | Icon/widget glass fill (windows use `rgba(11,14,21,.96)`) |
| `--text` | `#d8dce5` | Body text |
| `--muted` | `#646b7a` | Metadata, timestamps only |
| `--accent` | `#eef0f4` | Neutral highlight |
| `--ghost` | `#8a96b3` | Glitch RGB-split colour, the Sign |
| `--neon` | `#00f0ff` | The single neon |

Fonts: Inter Tight (UI), JetBrains Mono (metadata, logs), **Newsreader** (mail bodies and subjects), **Nothing You Could Do** (E.V.'s handwriting on the polaroid). All via `next/font/google`.

#### Neon rule

Cyan always means "something that knows about you".

- **Stage 1:** none.
- **Stage 2:** the `backup_you` folder (breathing glow).
- **Stage 3:** `viewers 3`, `session_0418.log · in progress`, the searchlight tint, glitch RGB-split flashes.

#### Stage behaviour (as built)

| | Stage 1 · Perfect | Stage 2 · Watched | Stage 3 · Corrupted |
|---|---|---|---|
| Overlay grain / vignette / glitch | 0.3 / 0.4 / 0.35 | 0.5 / 0.6 / 0.6 | 0.7 / 0.75 / 0.9, neon |
| Visual glitch every | 6–11 s | 2.5–5 s | 0.8–2 s |
| Glitch sound every | 30–50 s | 18–30 s | 10–16 s |
| Searchlight | 25 % | 60 % | 100 %, cyan tint |
| Room tone | 0.5 | 0.8 | 1 |
| Viewers | 1 | 2 | 3 (neon) |

Glitches and motion are reduced under `prefers-reduced-motion` (no DOM glitch, no typing animation in Notes).

### Design open points

1. The wallpaper is a CSS placeholder (window frames + bokeh) until `ev-home.jpg` exists.
2. The Sign is a first design (`SignGlyph` in `Decor.tsx`): an eye that is also a standing figure. Owner to approve or redraw.
3. A monochrome UI can hide what's clickable: solved with motion (hover glow, breathing) rather than colour; keep checking in playtests.
