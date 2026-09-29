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
| Audio | Rich sound design, with a mute toggle and no sudden loud sounds. Originally planned last; **brought forward on 2026-09-29 at the owner's request** (procedural, see "Sound as built") |
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

## Phone, reveal & ending decisions

| Topic | Decision |
|---|---|
| Voicemail | **Phone app synced to the laptop** (Continuity-style, plain and familiar). It has an **AI transcription that is unreliable**: audio and transcript do not match, and only the transcript contains details from the user's session (e.g. the entry time). One voicemail comes **from E.V.'s own number, dated after she disappeared**. The app list becomes: Mail, Photos, Messages, Notes, Browser History, Phone, Trash (+ Camera, `backup_you`) |
| S9 ending | The silhouette in the lit window copies the user's movements 1:1, then ~1 s of the user's own ambient audio plays, then black |
| S10 login | **Supersedes `docs/scenes.md` S10.** When the user types a name and presses Enter, a case list appears with a new entry, `Case #0418 — <typed name>` (you are next). Then a CRT-style screen switch-off animation (the image collapses to a line, then a dot, then black) |
| Credits | After the switch-off, one small mono line: "No frames or audio left your device." + hackathon credits |

## Changes after the first playtest (2026-09-29)

Owner feedback from the first run on the Mac, and what was done about it.

| Feedback | Decision |
|---|---|
| "Sounds are missing, more glitch" | Procedural sound design (below) and glitches synced across shader, page and sound |
| "The glitch sound is too much, I can't read" | Glitch sound much rarer than the visual glitch, rotating between four different sounds |
| "Keyboard sound when the terminal writes" | Keystrokes on every text that types itself |
| "Don't show the eye moving in the boot, it spoils the tracking" | No eye in S1. On "hold still" the operator's silhouette is traced instead |
| "The Camera eye is fine, but make it a robot eye / a camera" | The Camera window is a surveillance lens in Rive (`Lens` artboard) |
| "Turning the head should move something that follows me, like a searchlight" | A searchlight in the overlay shader follows the head (mouse without camera) |
| "Clicking a folder does nothing" | Icons and files open with a single click |
| "The desktop has no themed decoration" | Desktop decor (below) |
| "Mail and messages layout too plain, no AI copy, no em dashes, another font for mail" | Mail and Messages rebuilt (below). Rule: **no em dashes and no AI-sounding copy in anything the user reads** |

## Sound as built

Procedural Web Audio (`lib/audio/sfx.ts`), no files, nothing recorded, one compressor on the master so stacked sounds can't spike. Unlocked by the "Open" click. Mute toggle bottom right before the desktop, in the menubar after; the choice is kept in `localStorage`.

| Sound | When |
|---|---|
| Keystroke (filtered noise + low thock, throttled) | boot log, the anonymous sender's notes, E.V.'s dated note, live searches |
| Glitch sounds: digital tear, static swell, warped tape, sub thud (in rotation) | with a visual glitch, but rarely: every 30–50 s / 18–30 s / 10–16 s per stage; story moments (a refusal, the crack appearing) always sound |
| Shutter (two dry clicks) | the Camera lens fires on a blink, or on a click without camera |
| Notification (two low sine tones) | any notice |
| Room tone (detuned low hum) | from the boot on, heavier each stage |

## Desktop decor

Everything invented; references in `project.md` §2.

| Element | Behaviour | Reference |
|---|---|---|
| The Sign | faint on the wallpaper; moves to a new place only while you look away, with a silent glitch on your return; fades when the cursor gets near | Black Mirror's recurring glyph |
| `viewers 1 / 2 / 3` in the menubar | counts the audience; at stage 3 you are counted (neon) | White Bear's audience |
| Cracked glass | appears at stage 2, spreads at stage 3, on top of everything | Black Mirror's title card |
| `invitation.pdf` | letter from "Parallax · private experiences": "It ends when you stop looking for the edges" | The Game (CRS) |
| `operator_manual.pdf` | the recovery system's rules, clinical: "The operator is not informed that the session is observed" | The Game, the ending |
| `Screenshot 23.02.png` | dated 7 days ago, shows the windows you have open now | Black Mirror |
| Polaroid | E.V.'s handwriting; opens Photos; at stage 3 the caption becomes "it was never the window" | Memento |
| Calendar widget | her plans, plus events nobody created ("23:02 leave the light on", then "HH:MM operator") | The Game |
| Searchlight | a cold beam from above whose spot follows your head | Rear Window, surveillance |
| Wallpaper | placeholder (window frames + bokeh) until the AI photo exists | the "perfect life" |

## Mail and Messages as built

- **Mail**: sender initials, a real header (sender, address, recipient, date), body in **Newsreader** serif at 16.5 px. Each mail has its own kind and some carry a drawn block: sign-in "40 m from your home" with a "This wasn't me" button that answers "We have noted that it was you"; the energy bill's usage by hour, high at night; the parcel route ending "signed for by E.V." at the empty flat; the lab's contact sheet with frame 6 burned (opens Photos); a newsletter of invented novels about unreliable narrators; E.V.'s "for later" as a scheduled send delivered today at your entry time; Mara's mail with a quoted older reply and "Read receipt sent to Mara".
- **Messages**: contact header with "last seen", "Read HH:MM" under E.V.'s messages, a deleted message that Mara asks about, the photo E.V. sent Theo (opens Photos), voice messages with a transcript, and from stage 2 "typing…" in Mara's chat that never sends. Looking away with a chat open still adds "…are you still there?".
- Windows are nearly opaque so text never mixes with the window behind it.
