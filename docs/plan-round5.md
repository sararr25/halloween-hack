# Plan · round 5 (owner feedback, 2026-10-03)

Owner feedback on the preview, plus my own code check. Nothing here is built yet.

## 1 · Hints follow the story, not a fixed list

**Problem.** Hints are two fixed ladders (`LADDER` in `Desktop.tsx`) that step on a timer. They ignore what the player has already done, so stage 1 opens with "listen to the phone" before the photo, and stage 2 jumps notes → phone → mail → mail.

**Fix.** One path, one next step. Each step has a "done" check on clues; the hint always points at the first step not done yet, and never at something the player already did.

| Stage | Step | Done when | Hint (opens) |
|---|---|---|---|
| 1 | read Theo's chat | `chat_theo` | "…Theo asked about a photo she sent him." (Messages, on Theo) |
| 1 | open IMG_0418 | `photo_0418` (new) | "…the photo she sent Theo. IMG_0418." (Photos, on IMG_0418) |
| 1 | hold the lens on her | `photo_figure` | "…not the window. The street. Hold the lens on her." |
| 2 | play the "for later" memo | `memo_forlater` (new) | "…she left you a voice memo. In the mail." (Mail, on "for later") |
| 2 | read the arrival time | first wrong code or 60 s | "…look at when it arrived. Four digits." |
| 2 | (last) | none | "…it's the minute you came in. The Recovery menu remembers it." |

- Hints open the exact item (Theo's chat, IMG_0418, the "for later" mail), not just the app.
- Timer: first hint after 75 s with no progress, then every 60 s. A step done resets it.
- The phone voicemails become atmosphere, not a required stop.

## 2 · Voices

**Problems found.**
- Mum sounds like a man: Athena is tagged "mature, calm, professional". Aura-2 has only one British woman (Pandora, E.V.'s current voice).
- What is said and what is written do not match. The audio script lives in `scripts/make-voices.mjs`, the written text in `content.ts`, and they drifted apart:
  - E.V. voicemail: audio "It's me... I'm by the window." / text "It's me. I'm fine. Don't open the backup…"
  - Mara 1, 2, 3, Mum and the Unknown caller: different wording in each.
  - **Mara's call says "in 4A": that gives away the flat puzzle from round 4.**
- Some lines do not make sense: Mara 3 ("it was showing me… filmed from across the road") contradicts the twist (the camera films the player, not Mara).

**Fix.**
- One source of truth: the spoken text sits in `content.ts`, the script reads it from there. The transcript can differ only where it is meant to (`[inaudible]`, the time eaten by static), and that is marked in the data.
- Rewrite every clip: short, clear, one job each in the story.
- Audition before regenerating (about 6 short clips, a few cents):
  - Mum: `helena` (caring, raspy), `vesta` (empathetic), `hera` (warm).
  - E.V.: `juno` (breathy, expressive), `selene` (expressive), `cora` (melodic, caring).
  - Owner picks by ear, then all clips are regenerated (under $0.10 in total).

## 3 · Mara's live call

**Problem.** After 4.5 s she always answers. If the mic got nothing, she still says "that's not your voice" (`recordVoice` returns a buffer even when it is silence).

**Fix.**
- Real voice check: speech counts only above a level threshold for about 0.4 s in total.
- No speech → Mara: "Ev? I can't hear you. Please, say something. Anything." and listens again (up to 3 tries, about 6 s each).
- Speech → only then "That's not her voice. Who is this?" and the line dies.
- Still nothing after 3 tries, or no mic → the "someone breathing" ending.
- Script rewritten: she does not name the flat. New clip `mara-call-plead`.

## 4 · Case file PDF + an ending that stays with you

**Photos.** The game takes stills of the player on blinks (stage 2+), never shown during play, kept in memory only. The PDF gets a contact sheet "evidence · frames", CCTV look (grey, grain, timestamp under each). No camera → the reconstructed face, "frame unavailable · operator refused".

**After the download.**
1. "case file saved." Black for 3 s.
2. The REC dot turns back on by itself. One line types in: `case 0418 · status: open`.
3. Last message from the unknown sender: "see you tomorrow at {{entry}}." (the same minute they came in).
4. Tab title becomes "● REC · 0419" and stays.
5. Next visit, the first screen: "welcome back, <name>. you're late." (only the name is stored, as now).

## 5 · Other things I found

- **Mara's call names 4A** (see 2): spoils the new puzzle. Highest priority.
- **"if you want it to stop, look away"** can land during the call: stage 3 messages must stop when the log closes.
- **Too many 23:02s** (polaroid, Mum, calendar, lights note): the first wrong code is almost always 2302. Keep polaroid and lights note, drop it from Mum.
- **A hint vanishes after 16 s.** Keep the latest one readable under the objective in the menubar, clickable.
- **Objective in stage 1** stays "read her mail and messages" even after the photo is open: follow the steps in 1.

## Order of work

1. Mara's call (script, voice check, plead loop), remove "4A".
2. Hint path + objective + opening on an item.
3. Voice texts in one place → audition → owner picks → regenerate.
4. Hidden stills + PDF contact sheet.
5. Ending after the download.
6. Small fixes from 5.
7. After each block: lint, build, run in the browser, commit. Then push to the preview.

Cannot be verified here: microphone and camera (blocked in the in-app browser). Owner checks those on the Mac.
