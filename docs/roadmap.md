# Roadmap · improvement pass (from 2026-09-30)

Written after the owner's first real playtests (4-5 full runs, webcam + headphones). Contest submission comes after this pass.

## Diagnosis

The playtests confirm one root problem: **the webcam mechanics exist but nobody sees them.** Blink shutter, open palm, the S9 figure copying you, the room recording, the S10 caret: the owner played 4-5 times and noticed none of them. Two causes:

1. **Nothing asks for them.** The palm only answers if you happen to raise a palm. The caret only reacts if you happen to leave the frame. A mechanic the player never triggers does not exist.
2. **Nothing confirms them.** When a blink fires the shutter, the only feedback is inside a small window. The S9 figure copies you 1:1 for a few seconds while text is on screen, so the eye reads the text.

Plus: after the code the experience runs by itself (S8 closes itself after 20 s, the interlude and the reveal run on timers, S9 lasts about 20 s). The most important part of the story is the least interactive and the fastest.

And: the story is not clear at the start. The player does not know who E.V. is, who they are, or what they are supposed to do.

**Rule for everything below:** every camera mechanic gets (a) a moment that invites it, (b) a visible and audible confirmation, (c) a trace later (a log line, a photo, a line in the reveal).

## Phase 0 · Housekeeping

- [x] `/video-rec/` ignored by git and Vercel (screen recordings live there). `assets/` stays tracked.
- [ ] Avatars: convert `assets/*.png` (1254 px, 2 MB each) to 256 px WebP in `public/avatars/`, keep the PNG sources in `assets/`. Wire them into Mail, Messages, Phone, Find My. **Needs the owner's mapping** (which face is Mara, Theo, Ines, R. Hale…).
- [ ] The Sign: owner's new symbol replaces `SignGlyph` in `Decor.tsx`. **Needs the file** (or confirmation that `avatar EV.png` is it).

## Phase 1 · Story you can follow

- [ ] **Case briefing after the scan, before the desktop.** Black screen, motion graphics, 35-45 s, skippable after the first view (key: `recovery.briefed` in `localStorage`). Beats:
  1. `CASE 0418` · E.V., missing 7 days. Her photo fades in, then glitches.
  2. Last known: her flat, 16 Harrow St. Her laptop was left on.
  3. "You are the recovery operator. Her files are on this machine."
  4. Objective, typed: "Find out what she saw."
  5. One quiet wrong note (the scan of the player's face flickers for a frame in the corner). Plants the twist without spoiling it.
  Built in DOM + GSAP over the Rive overlay (grain, tears), sound: sub drop per card, keystrokes.
- [ ] **Objective line** in the menubar (`objective · read her mail` → `find the photo` → `open backup_you` → …). Updates per stage. Solves "what do I do now" without extra hints.
- [ ] Re-read the three acts so each has one clear question: Act 1 "where is she?", Act 2 "who was watching her?", Act 3 "who is watching me?".

## Phase 2 · Camera mechanics you notice

- [ ] **Searchlight:** flare every ~5 s instead of 18-24 s (owner feedback), shorter and softer so it does not tire. On the first flare of stage 2 the beam snaps to the head with a sound, once, so the link "it follows me" is made. Tune in `overlay_fx.wgsl` / `FLASH_STROKES`.
- [ ] **Blink shutter:** every captured blink gets a toast `frame captured · operator · HH:MM:SS` + shutter sound at full level, and the frames (the dithered webcam image) pile up in `backup_you/you/`. Stage 3 can show the count: "14 frames of you".
- [ ] **Open palm:** invite it. At stage 3 the anonymous sender writes "if you want it to stop, cover the camera." Palm → blackout + "no need to cover yourself." Mouse users get the same invitation with "look away" (leave the tab), which already works.
- [ ] **S9 figure: raise your hand.** Echo E.V.'s voice note ("I raised my hand… it raised its hand too"). In the reveal a single line: "raise your hand." The figure in 4A raises its hand *with* the player. Uses the existing palm gesture. This is the scene people will remember and record. Mouse fallback: the figure copies the cursor.
- [ ] **Room recording:** longer (3 s instead of 1.2 s), played back louder, with a line "this is your room. 3 seconds ago." Needs the mic granted in S1.
- [ ] **S10 caret:** make it explicit. Under the field: "stay in frame to keep the case open." When the face is lost the field shows `operator absent` in neon and the tube starts to die; coming back revives it.

## Phase 3 · Pacing after the code

- [ ] S8 log does not close itself: it waits for the player (close button appears after the live rows start). Remove the 20 s auto-close (`CLOSE_AFTER_MS` in `views/Session.tsx`) or raise it to 60 s.
- [ ] Interlude: Find My requires the player to press "View live" (keep the 55 s fallback only as a safety net, raise it to 90 s).
- [ ] S9 from ~20 s to ~60 s, in beats that wait for input: lines appear one at a time on click/key, then "raise your hand", then the room playback, then the live feed. Each beat holds until done or a generous timeout.
- [ ] One real choice at the end: type your name (case stays open, current ending) **or** cover the camera / close the tab (alternative line: "closing it does not close the case."). Both remembered next visit.

## Phase 4 · Music and sound

- [ ] Today there is no music, only a procedural drone (`sfx.ts` `drone`). Add a two-layer score:
  - Stage 1-2: sparse ambient (pad + distant piano notes), procedural, calm.
  - **After the correct code:** switch to a suspense layer (slow pulse, low drone rising, heartbeat-like sub), with a riser on the code acceptance. Silence for the interlude, then the suspense layer returns harder at "View live".
  - Options: procedural Web Audio (zero cost, full control, fits the current setup) or a CC0 track (Freesound / Pixabay Music, check the licence). Default: procedural.
- [ ] Mix pass after the music exists: voices must sit above it.

## Phase 5 · Voices

Owner feedback: first part too slow, the worried one does not sound worried, all voices too calm, almost sad.

- [ ] Rewrite for urgency (shorter sentences, interruptions, breath) and raise speed: E.V. voicemail 0.82 → ~0.95, Mara-1 0.9 → ~1.05, Mara-2 1.08 → ~1.15, the unknown caller stays slow on purpose.
- [ ] Audition other Aura-2 voices for Mara and E.V. (a few cents per try) and pick with the owner.
- [ ] New clips: Mara-3 (panicked, the night E.V. vanished, cut off), E.V. voice note 2 (whispered, "it's in my flat now"), optional narrator line for the briefing. Aura-2 has no emotion control: the feeling must come from the writing and the speed. If still flat, look for a TTS with emotion control on a free tier (to be checked before promising it).

## Phase 6 · Visual polish

- [ ] Avatars everywhere a person appears (Phase 0).
- [ ] The Sign appears in key moments: briefing end card, stage 3 wallpaper, last frame after the CRT switch-off.
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
