# Handover

> **2026-09-30 · improvement pass on `feat/playtest-pass`** (not on production yet). From the owner's first real playtests: 20 s case briefing, objective line, avatars (+ a chat and a voicemail from Mum), the new Sign, blink captures with four effects and stills kept in backup_you, searchlight flares every ~5 s from stage 2, "cover the camera" invitation, S9 in waiting beats ("don't move.", "raise your hand." with the figure's new raised hand, "that was your room."), explicit S10 presence line, procedural score (calm → suspense with a riser at the code), faster and more urgent voices + two new voicemails, fixed final screen. Details and status: `docs/roadmap.md`. Dev keys added: `Alt+I` briefing, `Alt+K` fake blink.

Status as of 2026-09-29 (night, 3) · live at **https://halloween-hack.vercel.app** · work on `claude/youthful-pascal-m6eofy`, fast-forwarded into the default branch `claude/epic-hopper-x8tj3e` (Vercel production).

Read in this order: this file → `docs/roadmap.md` (the current improvement pass, from the first real playtests) → `docs/walkthrough.md` (the story step by step, how to play it) → `project.md` (concept, twist, scene outline, checklist) → `docs/desktop.md` (experience decisions, desktop structure, decor, sound, copy rules) → `docs/scenes.md` (per-scene spec + implementation status) → `docs/tech-setup.md` (install, Rive CLI, WGSL traps, MediaPipe, troubleshooting) → `docs/image-prompts.md` (photos to generate).

## TL;DR

- **What it is:** Contra × Rive Halloween challenge, solo, 18 days. A psychological thriller on a fake desktop OS. The user "recovers" the files of E.V., missing for 7 days; the twist is that the user is the one being watched, built from real session data (entry time, time to each clue, camera answer).
- **Playable today at `/`, end to end:** premise → S1 boot → desktop → stage 1 → 2 → 3 → S8 session log → S9 reveal → S10 login → credits. AI photos wired (Photos, wallpaper, polaroid, chat photo); IMG_0418 is now a real photo in Rive; voicemails and the voice note play (Deepgram voices + procedural sound), plus a new voicemail from Mara outside E.V.'s flat. What is left is shipping.
- **Rive + WGSL in use:** four Rive projects. `presence` (Eye for `/lab`, Lens for the Camera window, no scripts), `effects` (full-screen overlay: grain, vignette, glitch tears, searchlight, CRT switch-off), `photo` (IMG_0418 drawn entirely in a WGSL shader, with a magnifying lens), `story` (the operator face scan as a 3D point cloud, S1 + S8; the window across with the figure that copies the user, S9).
- **Sound:** procedural Web Audio, no files. Keystrokes, four glitch sounds (rare), notification, shutter, room tone, scan sweep, light switch, tube switch-off, room recording playback (S9). Voices: Deepgram files in `public/audio` played by `lib/audio/voices.ts` (with phone line, static, breathing, sash window, traffic).
- **Full screen:** the Open click asks for real full screen (Fullscreen API, no tabs or address bar). Esc leaves it; a `full screen` toggle sits next to `sound on`.
- **Searchlight:** a soft, out-of-focus beam (gaussian, no rings) whose spot follows the head. Intermittent: stage 1 on 5-8 s every 35-60 s, stage 2 on 12-20 s / off 8-15 s, stage 3 always; off in the interlude. Every 18 to 24 s it flares for half a second in a colder violet-blue (cyan-white at stage 3).
- **Not verified yet:** everything that needs a real camera + microphone: the real face mesh in the S1 scan and live in S8, the S9 figure following a real head, the room recording played back in S9, the S10 caret waiting on `faceLost`. Plus the searchlight on a head, Lens shutter on blink, palm answer, and the sound mix.
- **Waiting on the owner:** a Mac test with webcam and headphones, a read of the copy in `lib/story/content.ts`, the Rive plan decision (watermark), a playtest on the live URL.

## Deploy (Vercel)

- Project `sararuffini-projects/halloween-hack` (Hobby), connected to `github.com/sararr25/halloween-hack`. A push to `claude/epic-hopper-x8tj3e` (the repo's default branch) deploys production to https://halloween-hack.vercel.app; other branches get preview URLs.
- To publish work: `git push origin claude/youthful-pascal-m6eofy` then `git push origin HEAD:claude/epic-hopper-x8tj3e` (fast-forward).
- The build runs `pnpm install`, whose postinstall fetches the MediaPipe models; no environment variables are needed on Vercel (the Deepgram key is only for `scripts/make-voices.mjs`, locally).
- `.vercelignore` mirrors `.gitignore`, so a CLI deploy can never upload `.env.local`. `vercel link` added a `VERCEL_OIDC_TOKEN` line to `.env.local` (git-ignored, harmless).
- The `-sararuffini-projects.vercel.app` URLs answer 302 (Vercel protection on team URLs); use `halloween-hack.vercel.app`.

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
- `/lab/scan`: sliders for every `scan/*` value of the Rive operator scan (sweep, reveal, mode, spin, yaw, pitch). Without camera there are no real points: use mode 1.
- Dev: `Alt+R` jumps to the reveal, `Alt+L` to the login.

| Script | Does |
|---|---|
| `pnpm rive:build` | compiles `rive/presence` → `public/rive/presence.riv` (no scripts, unsigned is fine) |
| `pnpm rive:publish` | signs `rive/effects`, `rive/photo` and `rive/story` → `public/rive/*.riv` (**Mac only**, needs `rive login`; commit the output). The Rive CLI 1.2.0 sometimes segfaults while signing: rerun |
| `pnpm rive:publish:story` | signs only `rive/story` |
| `pnpm lint` / `pnpm build` | both clean at the last commit |

## The experience today, step by step

| Phase | What happens | Where |
|---|---|---|
| Premise | "E.V. has been missing for 7 days…", Open, "best with headphones", sound toggle bottom right | `Experience.tsx` |
| S1 boot | Recovery log typed with keystrokes, including `session opened HH:MM:SS` (the future password). Camera + mic in **one** prompt as "operator verification". On "hold still" **one frame of the user's real face mesh** (478 MediaPipe landmarks) becomes a 3D point cloud in Rive: a structured-light sweep passes top to bottom with a descending tone, the points fall from noise into the face, a counter runs `000 / 478 pts`, then the head turns slowly like evidence. Refused (or no face in view): a face is guessed anyway, jittering, with dropouts, `operator · reconstructed · confidence 0.31`. It never follows the user live | `Boot.tsx`, `rive/story` Scan |
| Desktop, stage 1 | Anonymous sender: "She kept everything. Start with the mail." Apps on the left, files on the right, calendar, polaroid, the Sign on the wallpaper, searchlight at 25 % | `Desktop.tsx`, `Decor.tsx` |
| → stage 2 | IMG_0418 is the Harrow St photo (IMG_0413's view) with the woman by the lamp post lifted out as a cut-out: she stands by the lamp or 259 px to the left, and only moves while you look away. A lit window above her, someone behind the curtain (stronger each stage). Hold the lens on her for 700 ms. REC, `viewers 2`, Camera opens by itself (Rive Lens), `backup_you` (neon), IMG_0419 "source: unknown device", E.V.'s voicemail dated after she vanished, searches typed live, Mara "typing…" that never sends, calendar event "23:02 leave the light on", cracked glass, searchlight 60 % | `PhotoLens.tsx`, `useDirector` |
| → stage 3 | `backup_you` code = the local time the page was opened, `HHMM` (or two fingers up with the camera on). Two wrong codes → "…check her notes." Contents: E.V.'s readme + `session_0418.log · in progress`. Toast "you spent Ns getting here", `viewers 3` in neon, full crack, polaroid rewritten "it was never the window", calendar "HH:MM operator", cyan searchlight. Open palm → "no need to cover yourself." | `Backup.tsx`, `useDirector` |
| → stage 3 answers | Open palm to the camera, or (mouse) leaving the page and coming back: the screen goes black for 1.3 s with one mono line, "no need to cover yourself." / "no need to hide." (once each) | `Desktop.tsx`, `Decor.tsx` Blackout |
| → wrong backup codes | Each one sends the anonymous sender to a place where the time is written: 1 "for later" mail, 2 the unknown voicemail transcript, 3 the live searches in History, 4+ "…it's the minute you came in." (the dated note is left as a red herring) | `Desktop.tsx` `CODE_HINTS` |
| → S8 | Stage 3 nudge after 7 s: "one of those files is still being written." (idle: "…open the one in progress."). `session_0418.log` in the backup is a link. The window shows the **same Rive scan, now live** (every analysed frame with camera; without, the guessed head turning with the mouse) and a log that types itself from real data: entry time, verification answer, time to the figure, time to the backup + wrong codes, then live rows in neon: times looked away, last time, active time. Looking away while it is open writes `operator looked away · HH:MM:SS` at once, with a glitch. Closes itself after 20 s | `views/Session.tsx` |
| → interlude | When the log closes (by hand or by itself): calm (no glitches, no searchlight, no flares, `viewers 1`, low drone). System: "operator review 0418 · closed · nothing found", "case reopened · E.V. · new signal". Mara (typed notices): E.V.'s phone just came back on, in 4A across the road. Find My opens by itself: Harrow St map, E.V.'s home at 16, her phone at 17 flat 4A, the dot drifting with the user's head; "Play sound" pings in the user's headphones; "View live" starts the reveal (after 30 s "…go on. look.", after 55 s it starts anyway) | `Desktop.tsx` `useInterlude`, `views/Locate.tsx` |
| → S9 | "View live" (or the timeout): every window shuts itself in reverse open order, each collapsing like an old screen, one glitch each. Then full screen Rive: the building across at night, second-person lines ("You came in at 21:14.", "You found him in 4m 12s.", "You held still when you were asked." / "You said no at … It made no difference.", "You looked away N times."). A window lights up with the stutter of a tube (switch click), the camera pushes in, **a figure steps into the light and copies the user's head 1:1, no lag**. At 9 s it records 1.2 s of the room (mic granted in S1, memory only), plays it back at 12.4 s (no mic: a tape warble). At 13 s the window corrupts and resolves into the **live webcam** as the camera of flat 4A (mirrored, 1-bit cyan Bayer dither, scanlines, tearing rows, `● LIVE · 17 HARROW ST · FLAT 4A · CAM 2`) for ~7 s; no camera: the guessed face following the mouse. Tear, black, login | `Reveal.tsx`, `rive/story` Across |
| → S10 | `RECOVERY/4`, `operator` and an empty field with a block caret. The caret blinks while someone is there and stops when the face is lost (camera) or the mouse has been still 5 s. Enter → case list: `#0415 E.V. missing · 7 days`, `#0416 redacted closed`, `#0417 redacted closed · operator unresponsive`, `#0418 <typed name> open` (neon). Then the tube switches off (overlay shader `crt` + DOM squash + falling whine), black, "No frames or audio left your device." The name stays in `localStorage` (`recovery.case0418`): next visit the premise adds "case 0418 is still open, <name>." | `Login.tsx`, `rive/effects` |

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

StoryProvider (lib/story/store.tsx): phase, stage, windows, clues, openedAt, session, notices, wrongCodes, interruptions
   ├─▶ useDirector (Desktop.tsx): clues → stages, anonymous nudges
   └─▶ useReveal (Desktop.tsx): session log closed → windows close in reverse → phase reveal

tracker.onPoints / capturePoints ──face mesh as text (lib/presence/face.ts)──▶ scan/points (rive/story Scan)
lib/rive/persistent.ts: Rive GPU instances created once, moved in and out of the DOM (scanRive, acrossRive)

Overlay (Experience.tsx): glitch scheduler → fx/pulse (shader tear) + body.glitching (DOM split) + glitchSound()
```

| Path | What |
|---|---|
| `lib/story/content.ts` | **All story text**: mails (+ sign-in, usage, tracking, contact sheet, books blocks), photos, chats, notes, searches, calls/voicemails, trash, backup readme, invitation, manual, calendar, polaroid. Tokens `{{entry}}`, `{{now}}`, `{{today}}` |
| `lib/story/store.tsx` | reducer: `phase`, `stage`, `windows` (open order kept for S9), `clues` (ms since start), `openedAt`, `session` (camera/mic answer + time), `notices`, `wrongCodes`, `interruptions` (epoch ms of each look away). Dev shortcuts |
| `lib/story/time.ts` | `clock`, `entryCode` (backup password), `duration`, `daysAgo`, `today` |
| `lib/story/glitch.ts` | `glitchNow(strength, { sound })`: story moments ask for a glitch now |
| `lib/audio/sfx.ts` | Web Audio engine: `unlockAudio`, `key`, `glitch`, `staticSwell`, `tapeWarble`, `subThud`, `glitchSound` (rotates the four), `shutter`, `blip`, `drone`, mute (`recovery.muted` in localStorage) |
| `lib/presence/tracker.ts` | `PresenceTracker`: `startMouse()`, `startCamera(video, { withMic })`, `calibrate()`, `stop()`. Tuning constants at the top |
| `lib/presence/context.tsx` | `PresenceProvider`, `usePresence`, `usePresenceEvent`, `useLookingAway` |
| `lib/presence/face.ts` | `encodeFace`: landmarks → text for the Rive scan (6 chars per point, base 90). Keep in sync with `scan.luau` |
| `lib/rive/persistent.ts` | `persistentRive`, `useMountedRive`, `scanRive`, `acrossRive`: never-destroyed Rive GPU instances |
| `components/desktop/Experience.tsx` | phase switch, the single persistent `Overlay` (glitch scheduler, drone, searchlight, CRT), `Interruptions` (records looking away), `Returning`, `FloatingSound`, small-screen block |
| `components/desktop/Reveal.tsx` + `reveal.module.css` | S9 |
| `components/desktop/LiveFeed.tsx` | the live camera at the end of S9 (canvas dither, frames never stored) |
| `components/desktop/views/Locate.tsx` + `locate.module.css` | the interlude's Find My |
| `components/desktop/Login.tsx` + `login.module.css` | S10 + credits |
| `components/desktop/Boot.tsx` + `boot.module.css` | S1 |
| `components/desktop/Desktop.tsx` | menubar (E.V., Recovery menu, `viewers N`, REC, sound, battery, clock), app icons, files, `useDirector`, windows, Notices, Crack |
| `components/desktop/Decor.tsx` | `SignGlyph`, `TheSign`, `Crack`, `CalendarWidget`, `Polaroid` |
| `components/desktop/apps.tsx` | app registry: title, glyph, size, `iconFrom` stage, `place: "file"` for desktop files, body |
| `components/desktop/views/*` | one file per app: `Mail` (+ `mail.module.css`), `Messages` (+ `messages.module.css`), `Photos`, `PhotoLens`, `Notes`, `History`, `Phone`, `Trash`, `Backup`, `Camera`, `Docs` (invitation, manual, screenshot), `Session` (S8, + `session.module.css`), `shared` |
| `components/desktop/Window.tsx` | glass window: open from icon, fade close, drag, focus/z-order |
| `components/desktop/Notices.tsx` | notifications; the anonymous sender types with keystrokes |
| `components/desktop/SoundToggle.tsx` | mute toggle (`useSyncExternalStore`) |
| `components/FxOverlay.tsx` | mounts `effects.riv`; `levels` prop + `onVm` for per-frame values |
| `components/PresenceEye.tsx` | `presence.riv`, `artboard="Eye"` or `"Lens"` |
| `rive/presence/` | Eye + Lens artboards, RML only, `Presence` view model |
| `rive/effects/` | `overlay_fx.wgsl` + `fx.luau`: grain, vignette, scanlines, tears on `pulse`, searchlight |
| `rive/photo/` | `lens.luau` draws the real photo (`plate_soft/sharp.jpg`) and the figure cut-out (`figure_soft/sharp.png`), the lens by clip + transform of the 2D renderer; `photo_lens.wgsl` adds the lit window, grain, lens rim. Images built by `scripts/make-photo-plates.py` from `public/photos/IMG_0413.jpg` |
| `lib/audio/voices.ts` + `views/VoicePlayer.tsx` | voicemails (Phone) and E.V.'s voice note (Messages) |
| `lib/fullscreen.ts` + `FullscreenToggle.tsx` | real full screen |
| `public/photos/`, `public/wallpaper/` | the AI photos (IMG_0418.jpg is only the grid thumbnail) |
| `rive/story/` | `Scan` artboard: `face_cloud.wgsl` (one quad per landmark, sweep band, additive) + `scan.luau` (decodes `scan/points`). `Across` artboard: `window_across.wgsl` (building, lit room, bust with smooth-union head/neck/shoulders, sheer curtain, block corruption) + `across.luau` |
| `app/lab/scan/` | test bench for the scan |
| `app/lab/` | the original eye test bench (own overlay, no glitch scheduler) |
| `docs/image-prompts.md` | prompts, names and folders for every AI image |

### Key decisions and why

- **Rive GPU instances are never destroyed mid-session.** With `enableGPUCanvas` the runtime's `cleanup()` can crash (`glDeleteTextures` on an undefined context); the error unmounted the page and switched the camera off. So: one overlay for the whole experience, and the photo lens is a singleton whose canvas is detached, not destroyed.
- **IMG_0418 is a real photo drawn by the 2D renderer in Luau**, not sampled in WGSL: on the web an image asset's `view()` samples as zeros and `context:canvas()` fails, so the lens is the sharp photo drawn again, scaled around the lens centre and clipped to a circle path. The shader only adds marks on top.
- **Voices are Deepgram Aura-2 files** (`public/audio/*.mp3`, made once by `scripts/make-voices.mjs`, key in the git-ignored `.env.local`, never shipped). Aura-2 has no emotion control, so the feeling is in the writing (hesitations, repeats, broken sentences) and the speed. Voices: E.V. `pandora`, Mara `theia`, the unknown caller `draco`. The phone line, static, breathing, window and street are added live by `lib/audio/voices.ts`. The unknown caller's time is covered by static on purpose: only the transcript shows it. No screams: the design rule is no jumpscares.
- **Glitches are scheduled by the page**, not by Luau: that's the only way the shader tear, the DOM split and the sound land on the same frame.
- **Glitch sound is much rarer than the visual glitch** (owner feedback: it broke reading) and rotates between four sounds.
- **Presence values that change every frame go straight to the view model** (`onVm` setter), not through React state.
- **No eye in the boot** (owner feedback): showing tracking that early spoils it. Tracking becomes visible in stage 2 (Camera Lens, searchlight) and explicit in stage 3 (palm, S8 live scan).
- **The boot silhouette is a measurement, not a drawing** (owner feedback: the traced outline looked childish). One still frame of the real face mesh, turned like evidence; never live in S1. The same scan comes back live in S8, and the figure in S9 copies the head: three steps of the same idea.
- **The face mesh reaches Rive as a string** (`scan/points`): a view model string is the only way to hand a list of numbers to a Rive script. The worker computes landmarks only while someone listens.
- **S9 figure is a shader bust, not a webcam feed**: a Rive script cannot sample a `<video>`, and a figure that only moves like you is more ambiguous than your own face.
- **One click opens** icons: people expect a web page to answer a single click.
- **MediaPipe in a classic worker, self-hosted assets, camera asked inside the fiction, mouse fallback for everything**: unchanged.

## Verified vs not

| | Status |
|---|---|
| Real face + gestures on the owner's Mac (Chrome), `/lab` | ✅ |
| S1 boot with real camera + mic on the owner's Mac | ✅ ran; the teardown crash it caused is fixed (`c101230`). ⚠️ not re-tested since the point-cloud scan |
| Refusal path, whole flow to stage 3 (in-app browser, camera blocked) | ✅ |
| WGSL overlay (grain, tears, searchlight following the mouse) in a browser | ✅ |
| IMG_0418 (real photo, cut-out figure, lens), found → stage 2 | ✅ CLI renders + in-app browser (WebGL2) |
| Whole story, mouse path, premise → login, re-run 2026-09-29 | ✅ in-app browser, no console errors, lines built from the session |
| Stage 3 blackout answer (mouse: leave and come back) | ✅ in-app browser; palm version needs the webcam |
| AI photos, wallpaper swap at stage 3, voice files served and decoded | ✅ in-app browser |
| Rive Lens in the Camera window (follow, narrow on look-away) | ✅ CLI renders + in-app browser |
| S1 scan, reconstructed path (Rive point cloud on WebGL2) | ✅ `/lab/scan` + boot in the in-app browser |
| S1 scan with a real face mesh, S8 live scan with camera | ❌ needs the owner's webcam |
| S8 log, reverse window close, S9 scene, S10 case list, CRT, returning line | ✅ in-app browser (mouse path) |
| S9 figure on a real head, room recording playback, live webcam dither | ❌ needs webcam + microphone |
| Interlude (calm, notices, Find My, View live → reveal), reveal fallback without camera | ✅ in-app browser |
| Lens shutter on a real blink, searchlight on a real head, palm answer | ❌ needs the owner's webcam |
| Sound (keystrokes, glitch rotation, shutter, drone, scan, flare, tube) and Deepgram voices | ⚠️ unheard: the in-app browser has no audio. The owner heard only an early mix |
| Searchlight flare, full screen on Open | ⚠️ written, not seen in a real browser (in-app pane throttles frames and blocks full screen) |
| Rive free-plan mark hidden (overlay fade-in, prewarmed photo and reveal) | ⚠️ timing guessed (4 s); check on a real load |
| Mail and Messages redesign | ✅ in-app browser |
| Safari / Firefox, low-end hardware | ❌ untested |
| Vercel deploy | ✅ https://halloween-hack.vercel.app (page, models, audio, Rive files served; `.env.local` absent) |

## Owner actions pending

1. **Listen to the voices** (Phone: E.V., Mara x2, Unknown; Messages: E.V.'s voice note). To redo one clip: edit its text in `scripts/make-voices.mjs`, then `node scripts/make-voices.mjs <id>` (uses Deepgram credits, about $0.03 per 1,000 characters).
2. **Test on the Mac with webcam and headphones**, incognito, whole run: boot scan with your real face, searchlight on the head, Lens shutter on a blink, palm at stage 3, S8 live scan + "looked away" lines, S9 figure copying you and your room played back, S10 caret stopping when you leave the frame, sound levels.
3. **Read the copy** in `lib/story/content.ts` (mails, chats, notes, invitation, manual) and mark what's off in tone.
4. **Rive plan:** every published Rive file opens with the Rive mark (checked: even a pushed project is watermarked on the free plan). It is hidden by timing now; only a paid plan (Cadet or higher) + `rive push` of each project removes it.

## Next steps (recommended order)

Superseded by `docs/roadmap.md` (2026-09-30), which folds in the owner's playtest feedback. Kept below for reference.

1. **Webcam + headphones playtest** (owner), whole run, and tuning from it: scan scale (`face.ts`, `face_cloud.wgsl`), S9 figure range and beat timings (`window_across.wgsl`, `Reveal.tsx`), voice levels and timing (`voices.ts`), searchlight flare strength (`overlay_fx.wgsl`, `FLASH_STROKES`).
2. **Playtest on the deployed URL** (HTTPS, so the camera works for anyone): `prefers-reduced-motion` pass, Safari/Firefox, low-end hardware.
3. **Rive plan** (owner decision, see above).
4. **Copy pass** after the owner's read of `lib/story/content.ts`.

## Known issues / gotchas

- **Rive web + WGSL** (details and fixes in `docs/tech-setup.md` §2): `enableGPUCanvas: true` is required; never destroy those instances mid-session; no script 2D canvases on the web; some WGSL compiles in the CLI but draws black on WebGL2 (reserved words like `half`; `u32` colour decoding); `target` is reserved in WGSL itself. When a shader draws black, set the render pass `clearColor` to red: red visible = the pass runs and the problem is in the shader.
- **In-app browser**: the pane is often "hidden", so `requestAnimationFrame` pauses. GSAP, Rive and screenshots look stuck or black until the mouse moves over the page. Phase changes run on timers for this reason. Camera and audio are blocked there.
- **Hydration warning with `bis_skin_checked` / `bis_register`**: a browser extension, not our code. Use incognito.
- **Rive free-plan mark:** every published file opens with the Rive mark on black, even when pushed (`rive push`); only a paid plan removes it. Hidden in the experience: the overlay fades in 4 s after load, the S1 scan stays invisible until the sweep, IMG_0418 and the S9 scene are pre-rendered off screen (`prewarmLens` at desktop start, `acrossRive()` during S8). In the in-app browser, where frames are throttled, it can still show.
- `docs/scenes.md` S10 is superseded by `docs/desktop.md` (case list + CRT switch-off).
- A pnpm error mentioning unrelated packages (alchemy/prisma…) means pnpm is reading another project, or pnpm 11 is in use. See `docs/tech-setup.md` §7.
- `rive login` cannot complete inside cloud containers (localhost OAuth redirect).
- After any Rive build on the Mac, `scene.rml` may change (the CLI writes ids back). Commit it along with the `.riv`.
- If a push is rejected on the Mac: `git stash && git pull --rebase && git push && git stash pop`.
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

1. The Sign is a first design (`SignGlyph` in `Decor.tsx`): an eye that is also a standing figure. Owner to approve or redraw.
2. A monochrome UI can hide what's clickable: solved with motion (hover glow, breathing) rather than colour; keep checking in playtests.
