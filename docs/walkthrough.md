# Walkthrough: the story step by step

How to play "recovery" from start to end, what to do at each step and what should happen.
Live: https://halloween-hack.vercel.app · Chrome on a desktop, headphones, webcam if you have one.
A full run takes 10 to 15 minutes. Without a camera everything works with the mouse.

## 0 · Before the case
- First the camera + microphone question (refuse once and it asks again, refuse twice and the case plays with the mouse), then a whisper left and right to check the headphones, then full screen.
- A shared link (`/?case=<token>`) first plays the DM from whoever passed it on: a lock screen, one jump scare, the thread, the case file "CASE 0420 · ASSIGNED". That number is now the player's own case (see "Case numbers" below).
- Screen: "E.V. has been missing for 7 days…"
- **Do:** click **Open**.

## 1 · Boot (S1)
- A recovery log types itself. Note the line `session opened HH:MM:SS`: **that time is the password later.**
- **Do:** click **Start recovery** (the camera answer from the start is used).
- **Expect:** "hold still". Your real face becomes a 3D point cloud, acquired by a light sweep, then turned slowly. Refuse, and a face is guessed anyway: "operator · reconstructed · confidence 0.31".

## 2 · Desktop, stage 1: the perfect life
- An anonymous sender writes: "She kept everything. Start with the mail."
- **Do:** read Mail, Messages, Notes, Phone, History. Nothing is required yet. The clues for the backup code (the "for later" mail, the "backup" note, the Unknown caller, the clickable search) are not there yet: they appear with stage 2, so nobody can skip ahead.
- **The clue:** open **Photos → IMG_0418**. Move the lens over the street. A woman stands by the lamp post, looking up at a lit window. **Hold the lens on her for about a second.**
- She only moves while you are not looking (turn away, or move the mouse off the page).
- Stuck: hints follow one path (the note "lights across" → Theo's chat → IMG_0418 → the lens on her), always the first step not done yet, first after 45 s, then every 50 s. Each opens the exact note, chat or photo; the latest stays under the menubar. Photos gets a red badge once Theo's chat is read.
- The searchlight is not always there: in stage 1 it comes and goes (a few seconds every half minute or so), in stage 2 it is on more often than not, in stage 3 it never leaves. Every ~20 s it flares.

## 3 · Stage 2: someone else is watching
- **Expect:** `viewers 2`, `● REC`, the Camera window opens by itself (a lens that follows you and fires when you blink), a cyan folder `backup_you`, IMG_0419 "source: unknown device", searches typing themselves in History, Mara "typing…" forever.
- **Listen:** Phone → E.V.'s voicemail (dated after she vanished), Mara's two voicemails (the second outside E.V.'s flat), the Unknown caller (the time he names is lost in static; the transcript shows it). Messages → E.V.'s voice note.
- **Do:** open **backup_you** and type the four digits of the time you came in (`HHMM`, from `session opened`). With the camera on, two fingers up opens it too.
- Hints in stage 2: the note "backup" (edited just now) → the No caller ID voicemail, whose transcript writes the time the static covers → after three wrong codes, the **Recovery** menu. Her note dated today is a red herring.

## 4 · Stage 3: corrupted
- **Expect:** "you spent Ns getting here", `viewers 3` in cyan, the screen cracks, the searchlight turns cyan and flares, the polaroid is rewritten, the wallpaper changes the first time you look away (a window lit across the street, someone in it).
- **Try:** show an open palm to the camera (or leave the page with the mouse and come back): the screen goes black for a moment and answers you.
- **Do:** in the backup, open **session_0418.log** ("one of those files is still being written").

## 5 · Session log (S8)
- Your scan again, now live. A log writes itself with your real data: when you came in, your answer to the camera, how long each clue took, how many times you looked away.
- **Try:** look away while it is open. It writes it down at once.
- Close it when you are done ("the operator may close this log.").

## 6 · Interlude: the case goes back to E.V.
- Everything goes quiet: no glitches, no searchlight, `viewers 1`. "operator review 0418 · closed · nothing found", then "case reopened · E.V. · new signal".
- Mara calls (answer or decline; declined, she calls back like the phone in The Ring), then writes: "it says you're across the road. number 17. which flat??"
- **Find My** opens by itself, one numbered step at a time:
  1. **Play Sound**: the ping comes from behind you, closer each time, until the phone is "with you".
  2. **Mark As Lost**: type a lock-screen message; the phone answers.
  3. **View live**: binoculars on 17 Harrow St (head with the camera, mouse without). Moving blurs them, holding still focuses. Follow the ringing to **4A** and hold the look; someone is standing in it. After 5 minutes it happens anyway.

## 7 · Reveal (S9)
- Every window closes by itself, in reverse order. The building across, at night. Lines in second person built from your session.
- A window lights up. Someone steps into the light and **moves exactly as you move** (your head, or your mouse).
- "raise your hand.": raise yours (camera) or move the mouse to the top of the screen; you have 18 s. It raises its arm only if you do.
- Then about a second of **your own room**, recorded a moment earlier (never stored or sent).
- The window corrupts and becomes the live camera of flat 4A: **you**, in cyan 1-bit dither, `● LIVE · 17 HARROW ST · FLAT 4A · CAM 2`, for about 7 s. Without a camera: your guessed face, following the mouse. Then black.

## 8 · Login (S10)
- `RECOVERY/4`, `operator`, an empty field. The caret stops when your face leaves the frame (or the mouse stays still for 5 s).
- **Do:** type a name, press Enter.
- Nothing typed for 6 s: "they want your name."
- **Expect:** a case list: E.V. #0415 missing, the two cases before yours closed, and `#<your case> <your name> open`. The screen switches off like an old tube. "No frames or audio left your device."
- **Download the case file**: page 1 is the session, page 2 the evidence (stills of you taken silently on blinks and key moments, CCTV look; never shown during play, memory only) and tomorrow's case, scheduled at the minute you came in.
- After the download nothing closes: black, the REC light comes back on by itself, "case <yours> · status: open", the sender: "see you tomorrow at HH:MM. …unless someone takes your place." Then **pass it on** (a link for a friend) and a calendar alert for tomorrow's case. The tab stays "● REC · <tomorrow's case>".
- Come back later: the first screen says "welcome back, <name>. you're late."

## Case numbers (the chain)
| | First player | Their friend | The friend's friend |
|---|---|---|---|
| E.V. | #0415 | #0415 | #0415 |
| Your case (briefing, Recovery menu, session log, PDF) | 0418 | 0420 | 0422 |
| Cases before yours (backup, Trash, case list) | 0416, 0417 | 0418, 0419 | 0420, 0421 |
| Tomorrow (reminder, tab title) | 0419 | 0421 | 0423 |
| Passed on | 0420 | 0422 | 0424 |

## Shortcuts for demos (localhost only, `pnpm dev`)
| Keys | Jumps to |
|---|---|
| `Alt+P / B / D / R / L` | premise / boot / desktop / reveal / login |
| `Alt+F` | Find My |
| `/?case=dev` | the DM from a made-up sender, as case 0420 |
| `Alt+1 / 2 / 3` | stage 1 / 2 / 3 |
Jumping straight to the desktop skips the boot, so sound stays off until the first click. `/lab` tests the face tracking, `/lab/scan` the point cloud.
