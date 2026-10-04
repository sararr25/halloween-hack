# Plan · round 7 (playtest feedback, 2026-10-04)

Eight notes from the owner's run on the live site, each with its cause and the fix.

| # | Feedback | Cause | Fix |
|---|---|---|---|
| 1 | "find the photo she sent" is unclear | The objective names no app and no file | Every objective names the place: "open IMG_0418 in Photos", "read Theo's messages", "Phone · the call from No caller ID" |
| 2 | Top-left objective must be the short form of the hint on the right, and only appear after it | `objectiveOf` predicted the next step from the clues, so it changed the moment a step was done, before any hint | The objective is set only when a notice is posted (`post()` in `Desktop.tsx`), 1.5 s after it, as its short form. When the step it belongs to is done it reads "keep looking" until the next notice. The hint line under the menubar hides the same way |
| 3 | After the notes, wait at least 60 s before "find the call…" | Same cause as 2: the objective jumped to the next step at once | Fixed by 2. The hint itself already waits for a full idle period (now 75 s) after any new clue |
| 4 | The Recovery menu hint only after 3 wrong codes | The last step opened after one wrong code | The "transcript" step stays until 3 wrong codes; the Recovery menu hint comes at the third, never before |
| 5 | "find where her phone is" shows before the call | A derived objective for the whole interlude | The interlude sets its objectives with its notices: nothing until Mara asks "which flat??" after the call |
| 6 | Find My is passive | Two buttons and a list | The owner chose two options together: **it rings behind you**, then **the hunt by sound** (below) |
| 7 | Decline Mara's call: she calls again, with The Ring's phone | One ring, one ending | First decline: her message, 5 s, then the call comes back ringing like an old telephone bell (`ringBell` in `lib/audio/dread.ts`), status "calling again". Second decline, or no answer: as before |
| 8 | "not now" on the reminder switches everything off before the link can be copied, and some never see the link | The reminder arrived on a timer, and the black screen kept nothing | The reminder waits until the case has been passed on, or 25 s after the button appears. The pass-it-on button moves to the middle of the screen and breathes. After the switch-off, if the case was not passed on, one quiet line stays on the black: "case 0420 is still unassigned · pass it on", with the link to copy |

## 6 · Find My, rebuilt

1. **It rings behind you.** Find My opens on the map as now (phone at no. 17, 20 m). Only "Play Sound". Pressing it: the ping is not far away, it is in the headphones behind on the left, and each ping comes closer. The distance counts down by itself (20 m, 12 m, 6 m, 2 m, 0 m · with you) while the phone's pin slides across the road onto This Mac. The last ping is dead centre, then a breath.
2. **Mark as lost.** As in the real app: a field, "Enter a message to show on the lock screen". The player types anything and sends it. The phone answers in the card, typing first: "i can see you typing." · "you write like she did." · "i'm not behind you. look across the road." The pin flies back to no. 17. "View live" appears.
3. **The hunt by sound (Rear Window).** View live shows the facade of 17 Harrow St at night (4 floors, 8 windows, drawn). A binocular lens follows the mouse (or the head with the camera on); outside it everything is dark. The phone keeps pinging: louder and more centred the closer the lens is to 4A. Resting on a wrong window shows its night in one line (the man asleep, the cat, the kids…). In 2B a silhouette stands still and turns to face you when the lens passes. Holding the lens on 4A for 1.5 s: its light switches on with a stutter, a figure with its hand raised, a glitch, and the reveal starts. Clicking a window works too. If nothing is found: after 40 s "…listen. it rings where she is.", after 80 s "…top floor. On the left."
4. The interlude's timeout moves from 180 s to 300 s so the hunt is not cut short.

## Verification

Lint, build, then in the browser: the hint/objective order on stage 1 and 2 (the objective is empty until the first notice and never names a step before its notice), 3 wrong codes before the Recovery menu, the interlude with no objective until Mara's question, decline → second call, Find My (ping, mark as lost, facade, 4A), and the ending without passing the case on (the line on the black).
