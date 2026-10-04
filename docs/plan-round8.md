# Plan · round 8 (owner feedback, 2026-10-04)

Five notes from the owner, split into tasks, plus suggestions that were not asked for.
Each task says what is wrong today (found in the code) and what changes.

## A · The owner's notes

### A1 · Remove "it's yours now." from the shared link
- **Today:** `Login.tsx` `passOn()` calls `navigator.share({ title: "case 0420", text: "it's yours now.", url })`.
- **Change:** share only the title and the link. Small, first commit.

### A2 · Camera + microphone first, then full screen and headphones
- **Today:** premise → Open → boot → the camera/mic prompt arrives inside S1 as "operator verification".
- **Change:** a new first screen, before the premise and before the friend's DM:
  1. "This case uses your camera and microphone. Nothing leaves your device." → `allow` → the
     browser prompt (`getUserMedia`). The stream is kept and reused by the tracker, so S1
     never asks again (the scan still plays, it just does not prompt).
  2. "Put your headphones on." with a stereo check (a whisper on the left, then the right),
     and "Go full screen" → the Fullscreen API on that click (it also unlocks audio).
  3. Then the premise, as today.
- If the camera is refused: see question Q1.
- The DM's "click to wake the screen" becomes unnecessary (audio is already unlocked) and goes.

### A3 · The phone part (Find My) is unclear
- **Today:** Play Sound → Mark As Lost → type a message → View live, with no line saying what to do.
- **Change:** one instruction at a time on the card, numbered, in the OS voice
  ("1 / 3 · Play a sound and listen where it comes from"), mirrored in the menubar objective.
  Only the current action is clickable; the others are dimmed.

### A4 · The facade: more suspense, the window must not be found at once
- **Today:** 8 windows, 4A is one of only three dark ones, the caption says "the phone is
  ringing in there", the ping is loud and directional from the start, and a click on 4A ends it.
- **Change (in Rive, see A6):**
  - 16 windows (4 floors × 4), lights switching on and off over time: the building is alive.
  - The ping is intermittent and quieter: E.V.'s phone has 4 % battery, the ping comes every
    4-6 s and sometimes misses one. At 1 % it dies, silence, then it rings again: from another
    flat (it was never her phone ringing the first time).
  - The binoculars must be held still to focus: moving blurs and shakes the view, holding
    still for 0.8 s brings it into focus. You cannot sweep the facade fast.
  - The figure in 2B does not just turn: between looks it moves to another window, each time
    closer to 4A. When you finally focus on 4A it is already there.
  - No click shortcut. Finding it takes holding the lens on 4A for 2.5 s while the ping is
    loudest.
  - Wrong windows keep their one line of night, but none mentions the phone.

### A5 · The light / binoculars follow the face or the hands, not the mouse
- **Today:** the lens follows the mouse; the head only when the mouse is still for 1.5 s.
- **Change:** the worker (`public/presence-worker.js`) also sends the palm centre of a raised
  hand (MediaPipe hand landmarks are already computed for gestures). Lens priority: hand if
  visible, else head. A first line explains it: "raise your hand to move the binoculars".
  The mouse is used only without a camera (Q1). The searchlight overlay already follows the head.

### A6 · Use Rive much more (sponsor)
Today Rive draws the overlay effects, IMG_0418, the face scan and the window across. Everything
interactive in the second half is DOM/SVG. Candidates, in order of impact (see Q3):
1. **Facade** artboard: the building with a state machine (window lights, 2B figure moving and
   turning, 4A figure raising its hand reusing the owner's animation), the binocular lens and
   focus blur in WGSL, data binding for lens position, focus, battery, found.
   Rigged characters in the windows (man asleep, cat whose tail moves, kids).
2. **Find My phone** artboard: radar ripples, the pin crossing the road, the distance counter
   and battery as bound text.
3. **The DM's big lines + countdown** as a Rive artboard (the `EndCard` idea from round 6):
   text runs data bound, assembled from 1-bit dither like the Sign.
4. **Mara's incoming call** screen in Rive with listeners (accept/decline in the state machine).

### A7 · More hints toward the photos at the start
- **Today:** the welcome says "Start with what she wrote down" (notes); the first hint comes
  after 120 s; the path is note → Theo's chat → IMG_0418, so photos come third.
- **Change:** first hint after 45 s, then every 50 s, each one more direct, ending in
  "…open IMG_0418. Look at the street." The Photos icon gets a badge (1 new) once Theo's chat
  is read. If the player has opened nothing at 30 s, a very soft pulse on the next icon.

### A8 · "Set reminder" must not download anything
- **Today:** `add reminder` downloads a real `.ics` (`lib/story/reminder.ts`).
- **Change:** see Q2.

### A9 · The friend's DM: the big lines are off brand
- **Today:** "YOU HAVE 12 HOURS / TO FIND HER. / OR YOU'RE NEXT." in 800-weight sans at up to
  168 px, slamming in word by word with shake. The rest of the site is mono, quiet, cyan neon,
  OS-like.
- **Change:** restyle in the site's own language (direction in Q4), possibly in Rive (A6.3).

## B · Suggestions (not asked for)

- **B1 · The shared link on a phone.** Most people open a shared link on their phone, where
  today they get "This device cannot run the recovery. Use a desktop." and never see the DM.
  Fix: the DM plays on phones too, then ends on "case 0420 · open it on a computer. we'll
  wait." with "send it to myself" (share sheet). This is the viral loop, so it matters.
- **B2 · Link preview.** No Open Graph image or text: the link shows up bare in WhatsApp,
  iMessage, Instagram DMs. Add an OG card (the Sign, "case 0420 · assigned to you", dark).
- **B3 · Headphone check that pays off.** The stereo check in A2 doubles as a setup for the
  facade: the same whisper is heard later from the side where 4A is.
- **B4 · The figure across looks back.** In the facade, once 4A is found, the figure copies the
  player's head 1:1 (the S9 trick, earlier and smaller), so the reveal starts already inside
  the binoculars.

## Owner's answers (2026-10-04)

- **Q1 camera refused:** the game continues with the mouse, but first asks again in the
  story's voice: "are you sure you don't want to use the camera? no data leaves your
  computer." A second no continues with the mouse, and the story notices it.
- **Q2 reminder:** story only. No file: the music box, a fake system notice
  "reminder set · tomorrow HH:MM", then the switch-off.
- **Q3 Rive:** all four (Facade, Find My phone, the DM's lines and countdown, Mara's call),
  plus more if there is room. Extra candidates to propose: the permission/headphones gate
  (an animated eye that opens when the camera is allowed), the case-file stamp at the end.
- **Q4 DM style:** the case-file direction (stamps and fields, mono + serif, the countdown
  as data), with thriller sound and motion: hard cuts, held silences, a stamp hit per field,
  the score from round 6b kept under it.

## Order of work

1. A1, A8, A7 (small, safe). Commit.
2. A2 (permission gate, headphones, full screen) + B3. Commit.
3. A3 + A5 (Find My steps, hand tracking). Commit.
4. A4 + A6.1 (Facade in Rive). Commit.
5. A9 (+ A6.3) and B1, B2. Commit.
6. The rest of A6 if time allows.

Each step: lint, build, run in the browser, then commit and push to `main`.
