# Desktop structure & experience decisions

Agreed with the owner on 2026-09-29 (Q&A session). Scene specs stay in `docs/scenes.md`; palette/stages in `HANDOVER.md`.

## Experience decisions

| Topic | Decision |
|---|---|
| Nature | Interactive narrative storytelling, **not a game** (no score, no fail state) |
| Length | 8–15 minutes |
| Language | English |
| Tone | Mixed: the system speaks clinical/dry (logs, prompts); the missing person is literary in Notes/Messages |
| Missing person | Initials only: **E.V.** (no full name anywhere) |
| Premise | Anonymous message before boot: "You've been given access to E.V.'s files…" |
| Progression | **Hybrid**: Mail, Photos, Messages, Notes, History, Trash open from the start; stages advance only on key clues (photo zoom → stage 2, backup password → stage 3); `backup_you` appears only at stage 2 |
| Audio | Rich sound design, with a mute toggle and no sudden loud sounds. **Built last**, after the story works in silence |
| Mobile / small screens | Blocked with a diegetic message ("This device cannot run the recovery. Use a desktop.") |

## Desktop structure

- **Single route `/`**, state machine: `premise → boot (S1) → desktop → reveal (S9) → login (S10)`. `/lab` stays as a test bench.
- **OS style**: invented, neutral, macOS-inspired without branding. Thin menubar, frosted glass, no coloured dock.
- **Menubar**: `E.V.`, real clock; REC indicator from stage 2.
- **Wallpaper**: a serene "perfect life" photo of E.V. that degrades with the stages.
- **Icons (left column)**: Mail, Photos, Messages, Notes, Browser History, Trash. `backup_you` (neon) from stage 2. The Camera app opens **on its own** in stage 2 (REC).
- **Window manager**: multiple free windows (drag, z-order, focus); open with GSAP Flip from the icon, close with fade. It keeps the open order so S9 can close the windows in reverse.
- **Global state**: `stage` 1–3, clues found, open windows, session data (open time, time to each clue, back-navigation, camera denied). Client-side only.
- **FX overlay** on top of everything, driven by `stage`.

## The Sign (recurring symbol)

- An invented, unexplained pictogram in the spirit of Black Mirror's "White Bear" glyph. The design is still to be drawn.
- **Rule:** it moves **only when you are not looking** (`lookingAway`; without the camera: mouse far away or `document.hidden`), and each reappearance comes with a glitch flash. It moves more often as the stage rises. This keeps it inside the interaction thesis: it reacts to you and never loops for decoration.
- **Where:** desktop/wallpaper, inside the apps (a photo, a mail, a reflection), and the final login (S10).
- **Not clickable:** it vanishes when the cursor gets near.

## Content & puzzle decisions

| Topic | Decision |
|---|---|
| Volume | "Rich" desktop (~10 mails, 15 photos, 3 chats, 8 notes, 25 searches, Trash files), but **mixed**: a few key items truly worth reading or **listening to** (voice memos / audio), and the rest is unrelated everyday noise, skimmable by title or preview. The noise must still feed the core theme: a perfect life that slowly feels observed, anxiety and dread, never filler for its own sake |
| Photos | AI-generated + retouched, so hidden details (blurred figure, the Sign) are fully controlled |
| Backup password | **The local time the user opened the site**, `HHMM` (e.g. `2114`) |
| Password clue | Cryptic note by E.V. ("the password is when they came in"). Entry time is visible in boot log / menubar history. A nudge follows 2 wrong tries |
| Nudges | Sent by the **anonymous sender** as mono notifications ("…check her notes."). They look like help, but they are guidance, which foreshadows The Game |

## Audio & voice decisions

| Topic | Decision |
|---|---|
| Listening content | E.V.'s voice memos (Notes attachments or a Voice Memos app), voice messages in Messages chats, voicemail from someone who never introduces themselves, and a recording in the S9 reveal |
| Voices | Quality AI TTS (e.g. ElevenLabs free tier). **Check the licence and credits before use** |
| Microphone | **Yes, in S9**: the reveal plays back ~1 s of the user's own ambient audio, processed locally and never stored or sent. The permission must be asked **in S1 together with the camera** (diegetic "operator verification"), because a browser prompt in the middle of the reveal would break it. If the user refuses, S9 falls back to a reconstructed recording |
| Premise text | Cold and short: "E.V. has been missing for 7 days. You have access now. Look carefully." |

Open: voicemail needs a home (a Phone/Voicemail app, or files in Mail?).
