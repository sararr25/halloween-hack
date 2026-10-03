# Plan · round 6 (playtest feedback, 2026-10-03)

Two parts. **A** fixes the seven playtest notes (each one traced to the line that causes it).
**B** rebuilds the second half of the experience (from the moment the code is accepted) so
the end is unmistakable and leaves a cliffhanger. **C** says where Rive and `/genjutsu:paint`
fit. Nothing here is built yet.

---

## A · Playtest fixes (root causes found in the code)

| # | Feedback | Cause | Fix |
|---|---|---|---|
| A1 | Text too small, above all on the first screen | Premise is `.mono` 13px (`desktop.module.css:11`). Boot log 11-12px, briefing 12px, notices 12.5px with a 10px label, menubar 11.5px, reveal lines 13/15px, login 14px. | One type scale as tokens in `globals.css` (`--fs-xs` 13, `--fs-sm` 14.5, `--fs-md` 16, `--fs-lg` 20, `--fs-xl` clamp(22px, 2.4vw, 30px)) and every module uses them. Premise becomes `--fs-xl`, one sentence per line, typed in. Boot log and briefing rows 15px. Notices 14.5px, label 11.5px. Reveal lines 18px, order lines 22px. Login field 18px. Nothing on screen under 12px. |
| A2 | Notifications top right vanish too fast | `SHOW_MS = 8000` for every message whatever its length, and `slice(-2)` in `Notices.tsx` hides the older one the moment a third arrives, even if it is still "alive". | Reading time, not a fixed time: `max(10 s, 3 s + 0.5 s per word)`. Hover or focus pauses the timer. A queue instead of `slice(-2)`: at most two on screen, the next one waits its turn, nothing is pushed off unread. A small `inbox · N` item in the menubar opens the list of every message so far (re-readable, clickable when it points somewhere). |
| A3 | Clues still come too fast and disappear, from the photo on | Finding the figure fires everything at once: stage 2, REC, `viewers 2`, the Camera window opening, the cyan folder, and the "for later" mail notice after only 1.5 s (`Desktop.tsx:123`). | Stage 2 becomes a sequence of beats, each with room to land: 0 s glitch + REC · 6 s Camera window opens · 20 s `viewers 2` and `backup_you` appear · 40 s (or when the Camera window is closed, whichever is later) the "for later" mail arrives. One new thing at a time. |
| A4 | Hints at the top are not in sync with the ones on the right | Two separate sources. The objective (`objectiveOf`) uses its own clue ids (`chat_window` where the hint path uses `chat_theo`) and its own wording. `HintLine` keeps the last hint until the stage changes, so it still says "read Theo's messages" after you have read them. | One function `nextStep(state)` built on `PATH`. Each step carries both its `objective` and its `hint`. The objective shows the current step; the hint line shows the current step's hint only once it has been sent, and hides the moment the step is done. Same step, same words, same item opened. |
| A5 | Theo's hint arrives too fast | `HINT_FIRST = 75_000` from the moment the desktop mounts, while the player is still reading the first mails (which do not count as progress). | Stage 1: first hint at 150 s, then every 90 s. Count only active time: the tab is visible and no voice clip is playing. Opening any mail or chat counts as activity and pushes the hint back by 30 s (progress on the right path still resets it). |
| A6 | Hint for E.V.'s mail arrives too fast after the backup unlocks | The stage 2 hint timer starts at the stage change, together with the mail notice (see A3), so the first nudge to "listen to the voice memo" comes before the player has even seen the mail. | The stage 2 timer starts when the "for later" mail notice is shown, not at the stage change. First hint at 120 s after that, then 75 s. Second wrong code still gives the next hint at once (kept: that one was liked). |
| A7 | In the PDF, text sits on top of the photos | Page 2 contact sheet is 2 × 3 at 480 × 360 px. The third row spans y 1280-1640, the NEXT block starts at y 1364 (`casefile.ts`, `by = H - 330`). With 5-6 frames they overlap. | Grid 3 × 2 (six frames, about 307 × 230 px) and the NEXT block placed from the bottom of the grid, not from the page bottom. Add a `/lab/casefile` page that renders the PDF with 0, 2 and 6 fake frames so the layout is checked in the browser every time. |

Verification for A: lint, build, then a full browser run with a stopwatch on the hint and
notice timings (the dev shortcut `Alt+1/2/3` for each stage), and the PDF generated from the
lab page with 6 frames.

---

## B · The second half: from the code to the end

### What is wrong now

- **The end does not read as an end.** After the name, the screen switches off, then "No
  frames or audio left your device." This is a privacy note, and it lands where the final
  line should be: the tension drops to zero right before the last beat. Then the download,
  then a quiet "see you tomorrow". There is no title card, no sting, no moment where the
  player knows "this was the ending".
- **No cliffhanger.** "See you tomorrow" is a threat with nothing behind it. We never learn
  what happened to E.V., and we never learn what *we* are now.
- **The act runs on rails.** S8, interlude, reveal: the player mostly watches.

### Psychology to borrow (and what each one gives us)

| Source | Device | How we use it |
|---|---|---|
| **The Game** (Fincher, 1997) | The game knows your life. A false ending, then the real one. "Discover the object of the game." | A fake end: credits start rolling after "case closed · nothing found", then tear apart (B3). The real end then has to look different, which is exactly what makes it read as an end. |
| **The Housemaid** (McFadden) | Part two retells part one from the other woman's point of view, and everything you read flips meaning. The lock is on the outside of the door. | After the code, the session is retold from the watcher's side: their notes about you (B2). And the final flip: E.V. was not the victim of the case, she was the previous operator. You took her place (B5). |
| **Caché** (Haneke, 2005) | Tapes of your own house, filmed from across the street, never explained. | Already our core image (flat 4A across the road). Push it: the CCTV frames of the player arrive *as tapes*, unannounced, in the case file and in the after-screen. |
| **Black Mirror · White Bear** | The protagonist turns out to be the one being watched, then the day resets. | The loop: case 0419 tomorrow, same minute, and a returning player is greeted as late (B6). |
| **Black Mirror · Shut Up and Dance** | An anonymous sender who knows what the webcam saw, giving small orders that escalate. | The sender's orders in S9 escalate in intimacy: "don't move", "raise your hand", then "say her name" (microphone). Your own voice later becomes E.V.'s replacement voicemail for the next operator (B5). |
| **Black Mirror · Bandersnatch** | The illusion of choice; the viewer realises they are the one being steered. | One fake choice in S9: `keep watching` / `look away`. Looking away is detected and logged ("you looked away at 23:14:07. she didn't."). Both paths lead to the same place. (The name ending stays as it is: this is a different moment.) |
| **Rear Window / Searching** | Watching neighbours through windows; a story told only through screens. | The flat picker becomes the facade of 17 Harrow St, each window a life (B4). |
| **The Ring** | The curse ends only by passing it on. | Optional share link: "assign case 0420". The friend who opens it starts with "you were recommended by <name>". The player decides; nothing is sent by us. |
| **Peak-end rule** (Kahneman) | People remember the peak and the last moment, not the average. | Most of the effort goes into the last 90 seconds. |
| **Zeigarnik effect** | Unfinished things stay in the head. | The last screen shows a live countdown to tomorrow's session. The tab keeps it. The case is never closed. |
| **Hitchcock's bomb** | Suspense is the audience knowing something the character does not. | The player sees the REC dot and the watcher's cursor before the story admits them. |

### The new sequence

**B1 · Code accepted (stage 3).** Keep the crack and `you spent N getting here`. Then the
cursor is taken away for 2 seconds (the mouse does nothing, a second cursor moves on its own
to `session_0418.log` and hovers there). Loss of control is the clearest possible "someone
else is here". Then it is given back.

**B2 · The watcher's notes (S8, rewritten).** The log becomes a diary written *about* the
player, in the watcher's voice, timestamped, a little contemptuous, built from real data:
- what we already track (entry time, camera answer, time per clue, looks away)
- plus small things nobody thinks are noticed: how long the cursor rested on a file before
  opening it, the wrong codes typed (and the ones deleted before Enter), the mail they never
  opened, the moment they paused the tab.
- Example lines: `23:09:41 · they read Theo's chat twice. they always do.` ·
  `23:12:03 · typed 2302. deleted it. typed it again.` · `they never opened Mum's mail.`
- The last line is written live, as it happens: `23:14:52 · they are reading this.`

**B3 · The false ending (interlude).** "operator review 0418 · closed · nothing found",
music resolves, the screen fades, and **credits start rolling** (title, a few names) as if it
were over. Six seconds in, the credits stutter, a line is torn out, Mara's message breaks
through: "ev?? your phone just came on". From here Find My as now. The fake credits teach the
player what an end looks like, so the real one can contrast with it.

**B4 · The building (Find My → pick the flat).** Instead of a list of eight cameras, the
facade of 17 Harrow St at night, eight windows (a Rive scene, see C). Hover lights a window and
shows a two-second glimpse of that flat. Some show ordinary nights. Two show earlier
operators: **#0416** and **#0417** (the "closed · operator unresponsive" from the case list),
each sitting still at a laptop, lit by the screen. Nobody explains them. 4A, the empty one,
opens the feed as now.

**B5 · Reveal (S9) with the flip.**
1. Lines in the second person, the figure copying you, "don't move.", "raise your hand." (as now).
2. New: "say her name." The microphone records 2 s of the player saying "E.V." (or anything).
   Played back distorted: "that's how she sounded the first night, too."
3. The fake choice: `keep watching` / `look away` (logged either way).
4. The room playback, then the live feed of 4A showing the player (as now).
5. **The flip.** The feed cuts. E.V.'s photo from the briefing appears in the lit window
   across, and she is *outside* the building, on the street, by the lamp post: exactly where
   the woman in IMG_0418 was standing. She looks up at your window. She raises her hand.
   Meaning, without a word: she was the operator before you; she got out the day you came in.
   The woman in the first photo was the one before her. The lock is on the outside.

**B6 · Login and the real end.**
1. Name, case list as now. Then the E.V. row rewrites itself:
   `#0415 · E.V. · missing · 7 days` → `#0415 · E.V. · released · replaced by operator 0418`.
   A stamp lands on `#0418 <name> · open`.
2. Hard cut to black. Two seconds of silence. One sting.
3. **Title card**, centred, large: `RECOVERY` · `session 0418 · end`. This is the signal the
   playtest asked for. Held for 4 s.
4. Real credits, short (team, tools), and *only here* the honest line, small:
   "No frames or audio left your device." It is a credit, not the last line.
5. **Post-credits beat** (after 3 s of black, the Marvel trick: people who wait are rewarded):
   the REC dot turns on by itself, a live countdown types in:
   `case 0419 · operator: <name> · starts in 23:59:41`, ticking. Under it, E.V.'s voice, the
   only time we hear her calm: "thank you." Then the sender: "see you tomorrow at HH:MM."
6. Two buttons: `download case file 0418` (the evidence) and `assign case 0420` (optional
   share link, B "The Ring"). Tab title: `● REC · 0419 · 23:59:41`, counting down.
7. If the player comes back: "welcome back, <name>. you're late." (as now). If they come back
   at the exact minute, the first line of the boot log reads `operator 0418 · on time.`

### Why this fixes "it doesn't feel finished" and "no cliffhanger"

- Finished: a false ending first, then a real one with its own grammar (silence, sting, title
  card, credits). The contrast is the signal.
- Cliffhanger: three open loops instead of one vague threat. What happened to #0416 and #0417?
  Where did E.V. go? What happens tomorrow at HH:MM? And the countdown makes the last one
  concrete.

---

## C · Tools

### Rive (`rive` CLI is installed; projects in `rive/`, published to `public/rive/`)

What already exists in `rive/story`: the Scan artboard (point cloud, `face_cloud.wgsl`) and
the Across artboard (the window, `window_across.wgsl`, inputs `headX/headY/zoom/light/
corruption/figure/neon/hand`). New work, all data bound from React like the existing ones:

1. **`Facade` artboard** (B4): the building front with eight windows. View model: `hover`
   (0-8), `lit[8]`, `pick`, `glimpse` (0..1). Reuses the lighting and grain of
   `window_across.wgsl`. Each window's glimpse is a still frame drawn into the shader slot,
   the two old operators as silhouettes. Replaces the list in `Locate.tsx`.
2. **`Street` state in Across** (B5 flip): a new `ev` input (0..1) that brings E.V.'s figure
   in under the lamp post, plus `evHand`. The lamp post plate already exists in the photo
   assets (IMG_0418), so the composition rhymes with the first clue.
3. **`Operators` artboard** (B6, credits or case file page): a row of point-cloud faces,
   #0415 to #0418. The first three reconstructed and still, the last one the player's real
   scan, turning to look at the camera. Same `scan.luau`, several instances.
4. **`EndCard` artboard** (B6): the title card and the countdown. The Sign assembles from
   1-bit dither, the REC dot pulses, the countdown digits are a bound string. A sting on the
   assembly. Keeps the end inside the same visual material as the rest instead of plain DOM.
5. **Effects** (`rive/effects`): a `tear` input for the fake credits (B3) so the credits are
   ripped by the same glitch language as the rest of the game.

Each one: `rive . --verify`, `rive . --screenshot --advance=1` to look at it, then
`pnpm rive:publish:story` and check it in the app.

### `/genjutsu:paint`

Paint is a full pipeline (brainstorm one question at a time, visual and interaction thesis
you approve, a `MASTER.md` of tokens, implementation page by page, audit). It should not
redesign the whole game: acts 1-2 work. Use it in **partial mode on Act 3 only**, to give the
second half its own visual register: the watcher's universe.

Brief to bring to the brainstorm (so the answers are ready):
- **Feeling:** being watched by something patient. Clinical, not gory. The Housemaid's
  attic, Caché's tapes, Black Mirror's hard cuts.
- **Visual thesis (proposal):** act 1-2 is a warm, lived-in OS. Act 3 drains it: 1-bit cyan
  dither, CCTV timecode, case-file typography (mono for data, serif for the watcher's
  sentences), large type. The end card is the only fully centred, symmetric screen in the
  game.
- **Interaction thesis (proposal):** cuts, not tweens. Held silences (2 s minimum before every
  big beat). Text that types at human speed, never faster than it can be read. The cursor can
  be taken away. Forbidden: bouncy easing, fades longer than 400 ms, two new things at once.
- **Tokens it should produce:** the type scale from A1, reading-time rules for messages from
  A2, the beat spacing from A3, colour roles for act 3 (`--watcher`, `--rec`, `--evidence`).

Then `/genjutsu:cast` for the single effects (cursor takeover, credits tear, case-list
rewrite, stamp) using GSAP, which the project already uses.

---

## Order of work

1. **A1-A7** (the playtest fixes). Small, safe, testable. Commit per group.
2. **B6** the real end (title card, credits, post-credits countdown, E.V. row rewrite).
   Biggest gain for the least work, and it fixes both ending notes on its own.
3. **B2** watcher's notes (new tracking for hover dwell and deleted codes, new log voice).
4. **B3** false ending.
5. `/genjutsu:paint` partial on Act 3, then **B1** cursor takeover.
6. Rive: `EndCard`, then `Street` flip (B5), then `Facade` (B4), then `Operators`.
7. **B5** "say her name" and the fake choice.
8. Optional: "assign case 0420" share link.

After each block: lint, build, full run in the browser, commit, push to the preview.
Camera and microphone cannot be tested in the in-app browser: the owner checks those on the Mac.

## Decisions for the owner

- **The flip (B5/B6):** E.V. as the previous operator who got out. It changes what the story
  *means*. Yes or no before anything in B5-B6 is written.
- **Fake credits (B3):** risky if the player thinks it really ended and closes the tab. Keep
  them short (6 s) and interrupt them with sound, or drop them.
- **Share link (The Ring):** fun for virality, but it is the only feature that touches another
  person. Keep it optional and clearly the player's choice, or leave it out.
