# Plan: QA pass fixes (browser run 2026-09-30)

## Status (owner approved everything, 2026-09-30)

Owner decisions after the report:
- All 12 tasks approved, including the mouse raise-hand.
- Captions: **every voice clip** (Mara's call, the voicemails in Phone, E.V.'s voice note in Messages, the "for later" memo). The text is hidden until the clip plays, then appears word by word in time with the voice, **no typing sound** (the voice is already there). It stays after the first listen. Task 8 grows into this.
- Stage 3 window pile: **dim the windows behind** the front one (Task 13).
- S9: **the same building** as the photos, the Harrow St terrace (Task 14).
- Find My: a **realistic map like Apple's Find My** (Task 15).
- Later message (after 1-15): the moment the live camera shows the player gives the ending away, it must be much subtler (16); the figure behind the window is badly animated, redo it from the SVGs in `assets/` (17, owner pointed at the Remotion skill); the recording of the player's voice cannot be heard (18).

| Task | Status |
|---|---|
| 1 last screen visible | done · verified in browser (button 211×34, PDF reachable) |
| 2 code input | done · verified ("2302" typed in one burst keeps 4 digits; pasting "17:46" opens) |
| 3 one hint at a time | done · verified (one hint after a wrong code) |
| 4 plural | done · verified ("1 wrong code") |
| 5 closing windows | done · verified (Esc closes the front window; the log's last line closes it; 25 px target) |
| 6 objective | done · verified ("read it. close it when you're ready", "view live") |
| 7 readable desktop | done · verified (labels readable, Mail/Notes open on an item). Photos: 5 landscape tiles a row; the window keeps its height because the single photo with the lens needs it |
| 8 captions on every voice | done · verified without sound (call, voicemail). Sync with real audio: owner check |
| 9 mouse raise-hand | done · verified (cursor to the top raises it; hint "move the mouse up.") |
| 10 calm interlude | done · verified (no REC, "closed · nothing found") |
| 11 "click to go on" | done (11 px, fades in after 1.5 s) |
| 12 S10 case list | done · verified (list readable ~5 s) |
| 13 dim windows behind | done · verified |
| 14 S9 same building | done · verified (the Harrow St terrace redrawn in window_across.wgsl, story.riv republished; the figure layer still lines up) |
| 15 Find My map | done · verified (dark map like Apple's: streets, terraces, park, canal; device list; this Mac at 16, the iPhone at 17, 20 m) |
| 16 live camera moment more subtle | pending (owner, after 1-15) |
| 17 S9 figure animation redone from the owner's SVGs | pending (owner, after 1-15) |
| 18 the player's recorded voice is not audible in S9 | pending (owner, after 1-15) |

## Summary
A full browser run of the experience (premise → boot → briefing → stages 1-3 → S8 log → interlude call → Find My → S9 → S10 → last screen) on `feat/playtest-pass`, mouse path only (camera and mic are blocked in the test browser). It found two real bugs that break the game (the last screen is invisible, the backup code drops digits), a few logic slips (two hints at once, stale objective, plural), and UX gaps that make key moments easy to miss. This plan fixes them in small, isolated changes.

## User Story
As a first-time player, I want every step to respond the way I expect (codes I type are kept, the log can be closed, the ending is visible), so that the story reaches me instead of the UI getting in the way.

## Problem → Solution
Bugs and friction found in the run → each one fixed at its source, with no new systems.

## Metadata
- **Complexity**: Medium
- **Source PRD**: N/A (input: `/ecc:browser-qa` run)
- **PRD Phase**: N/A
- **Estimated Files**: 10

---

## QA Report · http://localhost:3000 · 2026-09-30 17:04-17:11

### Smoke
- Console: 0 errors. Warnings: Rive `stateMachines` deprecation (ours), WebGL "framebuffer zero size" (a Rive canvas at 0×0 while hidden, harmless).
- Network: no failures seen.
- Not verified: anything that needs a real camera or microphone (face scan, blink captures, palm, reflection, S9 figure following the head, room recording, call recording, S10 caret on face lost). The test browser blocks capture.

### Interactions
- [✓] Premise, boot (refused path), briefing, desktop, single-click icons
- [✓] IMG_0418 lens clue → stage 2 (REC, viewers 2, Camera window, backup_you)
- [✗] **backup_you code drops digits when typed fast**: "2302" typed quickly became "2", "1706" became "6". Pasting a code also fails.
- [✗] **Two hints arrive at the same moment** after a wrong code (the ladder timer is not reset by the wrong-code hint).
- [✓] Correct code → stage 3, crack, polaroid rewritten, "you spent 3m 06s getting here"
- [✗] S8 log: the only way forward is an **11×11 px grey dot**. Esc does nothing.
- [✗] S8 row reads "1 wrong codes".
- [✗] Objective stays "open the file still being written" while the log is already open; stays "find where her phone is" while Find My shows it.
- [✓] Interlude: "operator review 0418 · closed", call from Mara, Accept, "microphone off", Find My, View live
- [✗] The live call has **no captions**: muted players (or a phone call in a silent room) get nothing.
- [✓] S9 beats, "don't move.", "raise your hand.", reconstructed face, S10 login, CRT switch-off
- [✗] **The last screen ("No frames or audio left your device." + "download case file 0418") is invisible**: it renders inside a div squashed to `scale(0, 0.004)`, size 0×0, not clickable.

### Visual
- [✗] Desktop icon labels are `var(--muted)` (rgb 100,107,122), 12 px, no shadow, over a photo wallpaper: "Photos", "History", "Notes" are hard to read.
- [✗] Mail and Notes open with an empty reading pane ("10 messages · inbox", "8 notes").
- [✗] Photos window is twice as tall as its grid (empty lower half).
- [✗] S9 "click to go on" is 10 px at 50 % opacity on black: nearly invisible.
- [✗] During the calm interlude `● REC` keeps blinking and backup_you still says "session_0418.log · in progress".
- [~] Notifications cover the calendar widget (by design, opaque). OK.
- [✓] 1280×720: no overlap (polaroid and Screenshot icon 3 px apart). 375 px: clear "use a desktop" block.

### Accessibility (manual, no axe run)
- Window close targets 11 px (WCAG 2.2 target size wants 24 px).
- Icon labels below AA contrast on the wallpaper.
- No keyboard way to close a window.

### Verdict: DO NOT SHIP as is (2 blockers: invisible last screen, code input). SHIP WITH FIXES after Tasks 1-2.

---

## UX Design

### Before
```
S8 log open ─▶ find an 11 px dot ─▶ (Esc does nothing) ─▶ interlude
S10 name ─▶ case list ─▶ tube off ─▶ black screen forever (download unreachable)
backup_you ─▶ type 4 digits fast ─▶ 1 digit kept ─▶ "incorrect"
```

### After
```
S8 log open ─▶ objective "read it. close it when you're ready" ─▶ big close / Esc / "close log" row ─▶ interlude
S10 name ─▶ case list ─▶ tube off ─▶ Sign + "No frames or audio left your device." + download
backup_you ─▶ type or paste 4 digits ─▶ all kept ─▶ open
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Last screen | invisible, 0×0 | visible, clickable | Task 1 |
| backup_you digits | stale state, paste ignored | every key kept, paste fills all | Task 2 |
| Hints | two can fire together | one at a time, timer restarts | Task 3 |
| Window close | 11 px dot, no Esc | 25 px hit area, Esc closes the top window | Task 5 |
| S8 log | "the operator may close this log." (text) | same line is a button | Task 5 |
| Objective | stale at S8 and Find My | follows the moment | Task 6 |
| Mara's call | audio only | captions in the call panel | Task 8 |
| S9 "raise your hand" (mouse) | nothing to do | cursor to the top of the screen = raise | Task 9 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `components/desktop/Login.tsx` | 67-131 | GSAP squashes `screen.current`; React reuses that div for the credits |
| P0 | `components/desktop/views/Backup.tsx` | 17-45, 84-97 | digit inputs with stale closure |
| P0 | `components/desktop/Desktop.tsx` | 40-172 | `LADDER`, `hint()`, idle interval, wrong-code effect |
| P0 | `components/desktop/Desktop.tsx` | 290-320 | `objectiveOf`, `Objective` |
| P1 | `components/desktop/Window.tsx` | 12-70 | window close, focus/z-order |
| P1 | `components/desktop/desktop.module.css` | 57-99 | `.objective`, `.icon`, `.glyph`, `.close` |
| P1 | `components/desktop/views/Session.tsx` | 70-80 | log rows, "may close this log" |
| P1 | `components/desktop/IncomingCall.tsx` | 80-140 | call steps `talking/listening/reply` |
| P1 | `scripts/make-voices.mjs` | 58-80 | exact words of `mara-call-1/2/silent` (captions must match) |
| P1 | `components/desktop/Reveal.tsx` | 27-31, 170-210, 297 | beat timings, hand beat, `.next` hint |
| P2 | `lib/story/store.tsx` | all | `calm`, `windows`, `clues`, actions |
| P2 | `lib/presence/context.tsx`, `lib/presence/tracker.ts` | all | `usePresence`, `tracker.state` (`headY`, `source`) |

## External Documentation
No external research needed: fixes use React and GSAP patterns already in the codebase.

---

## Patterns to Mirror

### NAMING / CONSTANTS
```ts
// SOURCE: components/desktop/Reveal.tsx:27-31
const LINE_MIN_MS = 1200;
const LINE_MAX_MS = 4200;
const HAND_WAIT_MS = 10_000;
```
Timing constants: `SCREAMING_SNAKE`, `_MS` suffix, numeric separators, top of the file.

### ERROR HANDLING
```ts
// SOURCE: components/desktop/Login.tsx:59-63
try {
  localStorage.setItem(CASE_KEY, typed);
} catch {
  // storage blocked: the case still opens for this session
}
```
Only catch where the browser can refuse (storage, media). Every catch says why.

### STORY STATE
```ts
// SOURCE: components/desktop/Desktop.tsx:75-83
const say = (key: string, from: "anon" | "system", text: string, delay = 0, open?: AppId) => {
  if (said.current.has(key)) return;
  said.current.add(key);
  setTimeout(() => {
    if (from === "anon" && calm.current) return;
    dispatch({ type: "notify", from, text, open });
  }, delay);
};
```
Story beats go through `dispatch`; each one-shot is keyed so it never repeats.

### COMMENTS AND COPY
One short line above a block, giving the story reason. No em dashes in player-facing strings; lower case, `·` as separator.

### TESTS
No test runner in the project. Verification is `pnpm lint`, `pnpm build`, and a browser run.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `components/desktop/Login.tsx` | UPDATE | key each root so the credits get a fresh div; longer case list |
| `components/desktop/views/Backup.tsx` | UPDATE | functional state, paste; "closed" row once calm |
| `components/desktop/Desktop.tsx` | UPDATE | hint timer reset, objective states, REC hidden in calm |
| `components/desktop/views/Session.tsx` | UPDATE | plural, close row as a button |
| `components/desktop/Window.tsx` | UPDATE | Esc closes the top window |
| `components/desktop/desktop.module.css` | UPDATE | close hit area, icon label contrast |
| `components/desktop/views/Mail.tsx`, `views/Notes.tsx` | UPDATE | open on an item |
| `components/desktop/IncomingCall.tsx` + `call.module.css` | UPDATE | captions |
| `components/desktop/Reveal.tsx` + `reveal.module.css` | UPDATE | mouse raise-hand, visible "click to go on" |
| `components/desktop/apps.tsx` | UPDATE | Photos window height |

## NOT Building

- Anything on the camera/mic path beyond the mouse fallback in Task 9 (needs the owner's Mac run).
- A new S9 building matching the Harrow St photos (see Notes).
- A richer Find My map (Notes).
- Window auto-tidying (Notes).
- Voice changes, music, copy beyond captions and the status strings listed.

---

## Step-by-Step Tasks

### Task 1: Make the last screen visible (blocker)
- **ACTION**: in `Login.tsx`, give each returned root its own `key`, so React mounts a new element instead of reusing the squashed one.
- **IMPLEMENT**: `<div key="off" className={styles.black} />`, `<div key="credits" className={styles.black}>`, `<div key="screen" className={styles.screen} ref={screen} …>`.
- **MIRROR**: existing JSX in the file.
- **GOTCHA**: GSAP writes an inline `transform` on `screen.current`; React leaves inline styles it did not set. Keys are the clean fix.
- **VALIDATE**: `Alt+L`, type a name, Enter. After the switch-off the Sign, the line and the download button are visible; the button's rect is non-zero; clicking it downloads the PDF.

### Task 2: Code input keeps every digit, accepts paste (blocker)
- **ACTION**: rewrite `change` in `Backup.tsx`.
- **IMPLEMENT**: keep a `useRef` mirror of `digits` updated synchronously in the handler, so two keys before a re-render both land. Take all digits from `e.target.value`; if more than one (paste, autofill), fill from box `i` onward. Focus the next empty box; submit once when four are set. `onPaste` on each input: strip non-digits from `clipboardData` ("17:04" → "1704") and fill from box 0.
- **MIRROR**: current `change`/`back` handlers and the shake in `submit`.
- **GOTCHA**: reset both the ref and state in `submit` on a wrong code.
- **VALIDATE**: type `2302` in one burst: four boxes fill, "incorrect · 1". Paste `17:04` (the real entry code): opens. Backspace still steps back.

### Task 3: One hint at a time
- **ACTION**: `Desktop.tsx:156-161`, restart the idle interval when a wrong code fires a hint.
- **IMPLEMENT**: deps `[stage, Object.keys(clues).length, wrongCodes]`.
- **VALIDATE**: stage 2, wait ~40 s, wrong code: one hint; the next one ≥45 s later.

### Task 4: Plural in the S8 log
- **ACTION**: `Session.tsx:76`: `` `${wrongCodes} wrong code${wrongCodes === 1 ? "" : "s"}` ``.
- **VALIDATE**: one wrong code → "1 wrong code".

### Task 5: Closing windows is easy
- **IMPLEMENT**:
  - `.close` in `desktop.module.css:98`: keep the 11 px dot, add `position: relative` and a `::before` with `inset: -7px` (25 px hit area); brighter dot (`rgba(255,255,255,0.3)`) while the window is hovered.
  - Esc: one `keydown` listener in `Desktop.tsx` that closes the last window in `state.windows` with the same fade as `Window.tsx:31-32` (lift the fade into a small helper both can call).
  - `Session.tsx`: "the operator may close this log." becomes a `<button>` that closes the log the same way.
- **GOTCHA**: ignore Esc outside the desktop phase and during a blackout. Esc also exits browser full screen: acceptable.
- **VALIDATE**: S8 open → Esc closes it and the interlude starts; the row button does the same; a click 6 px outside the dot also closes.

### Task 6: Objective follows the moment
- **ACTION**: extend `objectiveOf` (`Desktop.tsx:295`).
- **IMPLEMENT** (first match wins):
  1. `windows` has `locate` → `"view live"`
  2. `calm` → `"find where her phone is"` (as now)
  3. `stage === 3` and `windows` has `session` → `"read it. close it when you're ready"`
  4. rest unchanged.
- **VALIDATE**: objective at S8 and at Find My matches.

### Task 7: Readable desktop, useful first view
- **IMPLEMENT**:
  - `.icon` (`desktop.module.css:70-74`): label `color: var(--text)` at `opacity: .8` with `text-shadow: 0 1px 3px rgba(0,0,0,.85)`; hover to full.
  - `Mail.tsx`, `Notes.tsx`: open on the first item. Check first how clues are recorded (`mail_for_later`, `chat_window` drive `objectiveOf`); auto-select must not record a clue, so select a non-clue item or record clues only on click.
  - `apps.tsx`: Photos height fitted to the 3-row grid.
- **VALIDATE**: desktop screenshot, labels readable on the bright wallpaper; Mail and Notes open with content; objective still moves only after the player opens a mail.

### Task 8: Captions for Mara's call
- **IMPLEMENT**: in `IncomingCall.tsx`, a `CAPTIONS: Record<CallLine, string>` with the exact texts from `scripts/make-voices.mjs:58-80`. Show `mara-call-1` in `talking`, `mara-call-2` or `mara-call-silent` in `reply`. Reveal word by word over the clip length (read `duration` from the playing element if `playCallLine` exposes it, otherwise add that to `lib/audio/voices.ts`). The last word stays cut.
- **GOTCHA**: small mono muted text inside the panel; no em dashes; nothing shown if declined or missed.
- **VALIDATE**: with sound off, accept: the lines appear in time; with sound on they track the voice.

### Task 9: Mouse players can raise their hand
- **ACTION**: `Reveal.tsx:198`, replace the mouse path `(await sleep(3500), false)` with a real input.
- **IMPLEMENT**: without camera, `await until(raisedByMouse, HAND_WAIT_MS)` where `raisedByMouse` resolves when the pointer is in the top 15 % of the viewport or held down 600 ms. On success the same `to({ hand: 1 }, 0.3, "power3.out")` and a mouse line (e.g. `"it raised its hand with you."`); on timeout keep `"it didn't wait for you."`.
- **GOTCHA**: read `lib/presence/tracker.ts` for how the mouse source maps `headY` before using it; a plain `pointermove` listener scoped to the beat is simpler and safer.
- **VALIDATE**: at "raise your hand." move the cursor to the top: the arm rises at once.

### Task 10: Calm interlude is really calm
- **IMPLEMENT**: `Desktop.tsx:368` → `stage >= 2 && !state.calm`; `Backup.tsx:71` shows `closed · nothing found` when `state.calm`.
- **VALIDATE**: close the log: REC gone, row changed.

### Task 11: "click to go on" visible
- **IMPLEMENT**: `reveal.module.css:56-59` `.next`: `font-size: 11px; opacity: .75`, fade in 1.5 s after the line.
- **VALIDATE**: S9 screenshot: the hint reads on black.

### Task 12: S10 case list readable
- **IMPLEMENT**: `Login.tsx:72-81`: named constants `CASES_HOLD_MS = 7000`, `CASES_BLACK_MS = 8600` (now 4200 / 5800: rows take 1.8 s, leaving 2.4 s to read the payoff).
- **VALIDATE**: ~5 s of full case list before the switch-off.

### Task 13: Dim the windows behind
- **IMPLEMENT**: in `Window.tsx`, a window that is not the top one gets `data-behind`; CSS `filter: brightness(.6) saturate(.8)` with a 200 ms transition. Focus (press) brings it back.
- **VALIDATE**: stage 3 with six windows: only the front one is bright.

### Task 14: S9 is the same building as the photos
- **IMPLEMENT**: redraw the facade in `rive/story/window_across.wgsl` as the Harrow St terrace of IMG_0413/IMG_0418 and the wallpaper: dark brick, white-framed sash windows, porches and doors at street level, parapet and chimneys on the roofline, a lamp post, wet street. Keep the lit window contract (`LIT`, `HALF`) so `Reveal.tsx` (`ART`, `LIT`, `WIN`) and the figure layer still line up. Republish with `pnpm rive:publish:story` (needs `rive login`).
- **VALIDATE**: S9 screenshots before/after side by side with IMG_0418.

### Task 15: Find My like Apple's
- **IMPLEMENT**: `views/Locate.tsx` + `locate.module.css`: macOS Find My layout, dark map drawn in SVG (street grid around Harrow St with names, building footprints, a park, labels), E.V.'s device pin with the pulsing accuracy ring, her home marked at 16, a sidebar list (Devices: "E.V.'s iPhone · 17 Harrow St · Now", "E.V.'s MacBook · this Mac"), the Play Sound / View live actions. Keep the dot drifting with the head and the existing actions and timings.
- **VALIDATE**: screenshot next to the current one; Play sound and View live still work.

---

## Testing Strategy

### Edge Cases Checklist
- [ ] Code: fast typing, paste "1704", paste "17:04", Backspace across boxes
- [ ] Esc with no windows, during a blackout, during the reveal
- [ ] Call declined / missed: no captions
- [ ] Sound muted: captions carry the call
- [ ] Mouse never moves in the hand beat: timeout path unchanged
- [ ] S10 with `localStorage` blocked

---

## Validation Commands

```bash
pnpm lint
```
EXPECT: clean

```bash
pnpm build
```
EXPECT: clean

```bash
pnpm dev
```
EXPECT: full mouse run premise → last screen, every ✗ in the QA report now ✓.

### Manual Validation (owner, Mac, webcam + headphones)
- [ ] Camera path unchanged: palm, blink, reflection, S9 hand with a real palm, room playback, S10 caret
- [ ] Mouse raise-hand does not fire on camera runs

---

## Acceptance Criteria
- [ ] Tasks 1-12 done
- [ ] `pnpm lint` and `pnpm build` clean
- [ ] Last screen visible, PDF downloads
- [ ] No em dash in new player-facing strings

## Completion Checklist
- [ ] Constants named, top of file
- [ ] Comments give the story reason
- [ ] No new dependencies
- [ ] `docs/roadmap.md` gets a "QA pass" section

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mail auto-select records a clue early | Medium | objective skips a beat | select a non-clue item, or clues only on click |
| Esc closes a window mid-beat | Low | S8/interlude timing | only in desktop phase, not in blackout |
| Captions drift from audio | Medium | looks broken | time words on the real clip duration |
| Mouse raise-hand fires by accident | Low | beat ends early | listen only during the hand beat |

## Notes · ideas for the owner (not in this plan)
- **S9 building**: the reveal shows a flat grid of square windows, while the photos and the wallpaper show a Victorian brick terrace (Harrow St). Matching the facade would make "that was your room" land harder. Rive/WGSL job.
- **Find My**: the map is grey boxes. A dark street drawn like the photos (lamp post, 16 and 17) would sell the "new signal" moment.
- **Window pile-up**: by stage 3 six windows are stacked. A stage change could dim the older ones so the new one reads.
- **Boot, refused path**: the guessed face is a few faint dots and reads as "nothing". Brighter points would make "confidence 0.31" unsettling instead of empty.
- **Blind playtest** (roadmap Phase 7) is still the most valuable step after these fixes.
