# Walkthrough: the story step by step

How to play "recovery" from start to end, what to do at each step and what should happen.
Live: https://halloween-hack.vercel.app · Chrome on a desktop, headphones, webcam if you have one.
A full run takes 10 to 15 minutes. Without a camera everything works with the mouse.

## 0 · Premise
- Screen: "E.V. has been missing for 7 days…"
- **Do:** click **Open**. Sound unlocks and the page goes full screen (Esc leaves it; `full screen` bottom right brings it back).

## 1 · Boot (S1)
- A recovery log types itself. Note the line `session opened HH:MM:SS`: **that time is the password later.**
- **Do:** click **Start recovery**, then allow camera + microphone ("operator verification").
- **Expect:** "hold still". Your real face becomes a 3D point cloud, acquired by a light sweep, then turned slowly. Refuse, and a face is guessed anyway: "operator · reconstructed · confidence 0.31".

## 2 · Desktop, stage 1: the perfect life
- An anonymous sender writes: "She kept everything. Start with the mail."
- **Do:** read Mail, Messages, Notes, Phone, History. Nothing is required yet. The clues for the backup code (the "for later" mail, the "backup" note, the Unknown caller, the clickable search) are not there yet: they appear with stage 2, so nobody can skip ahead.
- **The clue:** open **Photos → IMG_0418**. Move the lens over the street. A woman stands by the lamp post, looking up at a lit window. **Hold the lens on her for about a second.**
- She only moves while you are not looking (turn away, or move the mouse off the page).
- Stuck: hints follow one path (Theo's chat → IMG_0418 → the lens on her), always the first step not done yet, first after 75 s, then every 60 s. Each opens the exact chat or photo; the latest stays under the menubar.
- The searchlight is not always there: in stage 1 it comes and goes (a few seconds every half minute or so), in stage 2 it is on more often than not, in stage 3 it never leaves. Every ~20 s it flares.

## 3 · Stage 2: someone else is watching
- **Expect:** `viewers 2`, `● REC`, the Camera window opens by itself (a lens that follows you and fires when you blink), a cyan folder `backup_you`, IMG_0419 "source: unknown device", searches typing themselves in History, Mara "typing…" forever.
- **Listen:** Phone → E.V.'s voicemail (dated after she vanished), Mara's two voicemails (the second outside E.V.'s flat), the Unknown caller (the time he names is lost in static; the transcript shows it). Messages → E.V.'s voice note.
- **Do:** open **backup_you** and type the four digits of the time you came in (`HHMM`, from `session opened`, also in the menubar **Recovery** menu). With the camera on, two fingers up opens it too.
- Hints in stage 2: the "for later" voice memo → when that mail arrived → "…it's the minute you came in." A second wrong code brings the next hint at once. Her note dated today is a red herring.

## 4 · Stage 3: corrupted
- **Expect:** "you spent Ns getting here", `viewers 3` in cyan, the screen cracks, the searchlight turns cyan and flares, the polaroid is rewritten, the wallpaper changes the first time you look away (a window lit across the street, someone in it).
- **Try:** show an open palm to the camera (or leave the page with the mouse and come back): the screen goes black for a moment and answers you.
- **Do:** in the backup, open **session_0418.log** ("one of those files is still being written").

## 5 · Session log (S8)
- Your scan again, now live. A log writes itself with your real data: when you came in, your answer to the camera, how long each clue took, how many times you looked away.
- **Try:** look away while it is open. It writes it down at once.
- It closes by itself after 20 s.

## 6 · Interlude: the case goes back to E.V.
- Everything goes quiet: no glitches, no searchlight, `viewers 1`. "operator review 0418 · closed · nothing found", then "case reopened · E.V. · new signal".
- Mara writes: E.V.'s phone just came back on, in 4A across the road, the empty one.
- **Find My** opens by itself: a map of Harrow St, E.V.'s home at 16, her phone pulsing at 17, flat 4A.
- **Try:** Play sound (it pings in your own headphones). Move: the dot moves a little with you.
- **Do:** click **View live**, then pick the flat: 8 building cameras, only **4A** (the empty one, named by Hale, Mara, the parcel and the police draft) opens the feed. Wrong flats show someone else's night and a glitch; after 2 and 4 wrong picks the sender hints. After 3 minutes it happens anyway.

## 7 · Reveal (S9)
- Every window closes by itself, in reverse order. The building across, at night. Lines in second person built from your session.
- A window lights up. Someone steps into the light and **moves exactly as you move** (your head, or your mouse).
- Then about a second of **your own room**, recorded a moment earlier (never stored or sent).
- The window corrupts and becomes the live camera of flat 4A: **you**, in cyan 1-bit dither, `● LIVE · 17 HARROW ST · FLAT 4A · CAM 2`, for about 7 s. Without a camera: your guessed face, following the mouse. Then black.

## 8 · Login (S10)
- `RECOVERY/4`, `operator`, an empty field. The caret stops when your face leaves the frame (or the mouse stays still for 5 s).
- **Do:** type a name, press Enter.
- **Expect:** a case list: E.V. missing, two closed cases, and `#0418 <your name> open`. The screen switches off like an old tube. "No frames or audio left your device."
- **Download the case file**: page 1 is the session, page 2 the evidence (stills of you taken silently on blinks and key moments, CCTV look; never shown during play, memory only) and "case 0419 · session scheduled tomorrow" at the minute you came in.
- After the download nothing closes: black, the REC light comes back on by itself, "case 0418 · status: open", and the sender: "see you tomorrow at HH:MM." The tab stays "● REC · 0419".
- Come back later: the first screen says "welcome back, <name>. you're late."

## Shortcuts for demos (localhost only, `pnpm dev`)
| Keys | Jumps to |
|---|---|
| `Alt+P / B / D / R / L` | premise / boot / desktop / reveal / login |
| `Alt+1 / 2 / 3` | stage 1 / 2 / 3 |
Jumping straight to the desktop skips the boot, so sound stays off until the first click. `/lab` tests the face tracking, `/lab/scan` the point cloud.
