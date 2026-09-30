# Roadmap · improvement pass (from 2026-09-30)

Written after the owner's first real playtests (4-5 full runs, webcam + headphones). Contest submission comes after this pass.

Work happens on the branch `feat/playtest-pass` (pushed, preview URL on Vercel), not on production, until the owner has played it.

Owner decisions (2026-09-30): briefing 20 s max; more visual/sound effects on blinks, Black Mirror style; **the name ending stays exactly as it is** (no alternative choice); music generated in code; avatars mapped by Claude (older woman = Mum, the new young man = R. Hale).

## Diagnosis

The playtests confirm one root problem: **the webcam mechanics exist but nobody sees them.** Blink shutter, open palm, the S9 figure copying you, the room recording, the S10 caret: the owner played 4-5 times and noticed none of them. Two causes:

1. **Nothing asks for them.** The palm only answers if you happen to raise a palm. The caret only reacts if you happen to leave the frame. A mechanic the player never triggers does not exist.
2. **Nothing confirms them.** When a blink fires the shutter, the only feedback is inside a small window. The S9 figure copies you 1:1 for a few seconds while text is on screen, so the eye reads the text.

Plus: after the code the experience runs by itself (S8 closes itself after 20 s, the interlude and the reveal run on timers, S9 lasts about 20 s). The most important part of the story is the least interactive and the fastest.

And: the story is not clear at the start. The player does not know who E.V. is, who they are, or what they are supposed to do.

**Rule for everything below:** every camera mechanic gets (a) a moment that invites it, (b) a visible and audible confirmation, (c) a trace later (a log line, a photo, a line in the reveal).

## Phase 0 · Housekeeping

- [x] `/video-rec/` ignored by git and Vercel (screen recordings live there). `assets/` stays tracked.
- [x] Avatars: 192 px WebP in `public/avatars/` (sources in `assets/`), in Mail and Messages. E.V. = the EV badge, avatar1 = Mum (new chat + voicemail), avatar2 = Mara, avatar3 = Ines Arden, avatar4 = Theo, avatar5 = R. Hale.
- [x] The Sign: `assets/symbol.png` (the reticle) recoloured to bone + cyan as `public/sign.png`; used on the wallpaper, the Parallax letter, the briefing flicker, the blink viewfinder and the last screen. `assets/symbol_2.png` (the glitched V) is unused for now.

## Phase 1 · Story you can follow

- [x] **Case briefing after the scan, before the desktop** (`Briefing.tsx`, ~19 s, skip button always there). Beats:
  1. `CASE 0418` · E.V., missing 7 days. Her photo fades in, then glitches.
  2. Last known: her flat, 16 Harrow St. Her laptop was left on.
  3. "You are the recovery operator. Her files are on this machine."
  4. Objective, typed: "Find out what she saw."
  5. One quiet wrong note (the scan of the player's face flickers for a frame in the corner). Plants the twist without spoiling it.
  Built in DOM + GSAP over the Rive overlay (grain, tears), sound: sub drop per card, keystrokes.
- [x] **Objective line** in the menubar (`objective · read her mail` → `find the photo` → `open backup_you` → …). Updates per stage. Solves "what do I do now" without extra hints.
- [ ] Re-read the three acts so each has one clear question: Act 1 "where is she?", Act 2 "who was watching her?", Act 3 "who is watching me?".

## Phase 2 · Camera mechanics you notice

- [x] **Searchlight:** flare every 4-6.5 s from stage 2 (stage 1 keeps 18-24 s, so tracking is not shown early), instead of 18-24 s (owner feedback), shorter and softer so it does not tire. On the first flare of stage 2 the beam snaps to the head with a sound, once, so the link "it follows me" is made. Tune in `overlay_fx.wgsl` / `FLASH_STROKES`.
- [x] **Blink captures** (`BlinkCapture.tsx`, stage 2+, camera only, at most one every 5 s / 3 s at stage 3): four effects in turn, shutter (screen goes black for a frame), still (your dithered face slides in and flies into backup_you), viewfinder (corner marks + the Sign, "captured"), drain (colour drains out). Stills kept in `backup_you/you`, a `frames N` counter in the menubar, a row in the S8 log, a line in S9. Dev: `Alt+K` fakes a blink.
- [x] **Open palm:** invite it. At stage 3 the anonymous sender writes "if you want it to stop, cover the camera." Palm → blackout + "no need to cover yourself." Mouse users get the same invitation with "look away" (leave the tab), which already works.
- [x] **S9 figure: raise your hand.** (`hand` input added to `window_across.wgsl`, `story.riv` republished.) Also "don't move." first, so the copying is noticed. Echo E.V.'s voice note ("I raised my hand… it raised its hand too"). In the reveal a single line: "raise your hand." The figure in 4A raises its hand *with* the player. Uses the existing palm gesture. This is the scene people will remember and record. Mouse fallback: the figure copies the cursor.
- [x] **Room recording:** longer (3 s instead of 1.2 s), played back louder (compressed), only if the mic was granted in S1, with a line "this is your room. 3 seconds ago." Needs the mic granted in S1.
- [x] **S10 caret:** make it explicit. Under the field: "stay in frame to keep the case open." When the face is lost the field shows `operator absent` in neon and the tube starts to die; coming back revives it.

## Phase 3 · Pacing after the code

- [x] S8 log does not close itself: it waits for the player (close button appears after the live rows start). Remove the 20 s auto-close (`CLOSE_AFTER_MS` in `views/Session.tsx`) or raise it to 60 s.
- [x] Interlude: Find My requires the player to press "View live" (keep the 55 s fallback only as a safety net, raise it to 90 s).
- [x] S9 from ~20 s to ~60 s, in beats that wait for input: lines appear one at a time on click/key, then "raise your hand", then the room playback, then the live feed. Each beat holds until done or a generous timeout.
- [x] ~~One real choice at the end~~: dropped, the owner wants the name ending as it is. Fixed instead: the last screen ("No frames or audio left your device.") never appeared (its timer was cleared), now it does, with the Sign.

## Phase 4 · Music and sound

- [x] `lib/audio/music.ts`. Before: no music, only a procedural drone (`sfx.ts` `drone`). Add a two-layer score:
  - Stage 1-2: sparse ambient (pad + distant piano notes), procedural, calm.
  - **After the correct code:** switch to a suspense layer (slow pulse, low drone rising, heartbeat-like sub), with a riser on the code acceptance. Silence for the interlude, then the suspense layer returns harder at "View live".
  - Options: procedural Web Audio (zero cost, full control, fits the current setup) or a CC0 track (Freesound / Pixabay Music, check the licence). Default: procedural.
- [ ] Mix pass after the music exists: voices must sit above it.

## Phase 5 · Voices

Owner feedback: first part too slow, the worried one does not sound worried, all voices too calm, almost sad.

- [x] Rewrite for urgency (shorter sentences, interruptions, breath) and raise speed: E.V. voicemail 0.82 → ~0.95, Mara-1 0.9 → ~1.05, Mara-2 1.08 → ~1.15, the unknown caller stays slow on purpose.
- [ ] Audition other Aura-2 voices for Mara and E.V. (a few cents per try) and pick with the owner.
- [x] New clips: Mum (days 4), Mara-3 (days 1, inside the flat, the line dies mid-word). Not done: E.V. voice note 2, narrator. Original idea: Mara-3 (panicked, the night E.V. vanished, cut off), E.V. voice note 2 (whispered, "it's in my flat now"), optional narrator line for the briefing. Aura-2 has no emotion control: the feeling must come from the writing and the speed. If still flat, look for a TTS with emotion control on a free tier (to be checked before promising it).

## Phase 6 · Visual polish

- [x] Avatars in Mail and Messages (Phone and Find My not yet).
- [x] The Sign appears in key moments: briefing end card, stage 3 wallpaper, last frame after the CRT switch-off.
- [ ] Clickable things still hard to spot in a monochrome UI: re-check with a first-time player.

## Phase 7 · Verify and playtest

- [ ] Each phase: `pnpm lint` + `pnpm build`, run in the browser, commit, deploy.
- [ ] Owner run on the Mac (webcam + headphones) after Phases 1-3.
- [ ] **Blind playtest with someone who has never seen it.** Watch, do not help. Note where they stop, what they say out loud, whether they notice the searchlight, blink, hand, room. This is the real test of this pass.
- [ ] Safari, Firefox, `prefers-reduced-motion`, a slow laptop.

## Phase 8 · Contest

After the above: read the Contra challenge rules (deadline, format, what to submit), cut the trailer from `video-rec/`, write the submission.

## Open questions for the owner

1. Avatar mapping: which face is which character?
2. The symbol: is it `avatar EV.png`, or a separate file still to add?
3. Music: procedural (default) or a free CC0 track?
