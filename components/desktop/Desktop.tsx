"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { grabFrame } from "@/lib/story/frames";
import { blackout, glitchNow } from "@/lib/story/glitch";
import { usePost, useStory, type AppId, type Until } from "@/lib/story/store";
import { clock, duration } from "@/lib/story/time";
import { APPS, type AppDef } from "./apps";
import BlinkCapture from "./BlinkCapture";
import IncomingCall, { CALL_EVENT } from "./IncomingCall";
import Reflection from "./Reflection";
import { Blackout, CalendarWidget, Crack, Polaroid, TheSign, Wallpaper } from "./Decor";
import Notices from "./Notices";
import FullscreenToggle from "./FullscreenToggle";
import SoundToggle from "./SoundToggle";
import Window, { fadeClose } from "./Window";
import { prewarmLens } from "./views/PhotoLens";
import styles from "./desktop.module.css";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span>
      {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{" "}
      {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

const IDLE_NUDGE_MS = 100_000;

// Hints follow one path through the story (owner playtest: a fixed list sent people to the
// phone before the photo, and back and forth in stage 2). Each step knows when it is done;
// the sender only ever points at the first step not done yet, and the hint opens the exact
// note, chat, photo or call. Nothing is said while the player is making progress.
// The path crosses apps on purpose (owner playtest: everything led to the mail): each item
// on it names the next place to look, so the player can follow it without any hint.
//  stage 1  note "lights across" → Theo's chat → IMG_0418 → the figure in the street
//  stage 2  note "backup" (changed tonight) → the No caller ID voicemail → the code
// The objective in the menubar is the same step in a few words, and it only shows once the
// hint for that step has been posted on the right (usePost), never ahead of it.
type Clues = Record<string, number>;
type Step = { done: Until; objective: string; text: string; open?: AppId; item?: string };
const PATH: Record<1 | 2, Step[]> = {
  1: [
    {
      done: (c) => "note_lights" in c || "chat_theo" in c || "photo_0418" in c,
      objective: "Notes · read “lights across”",
      text: "…she wrote down every night the light came on. Her notes.",
      open: "notes",
      item: "lights",
    },
    {
      done: (c) => "chat_theo" in c || "photo_0418" in c,
      objective: "Messages · read her chat with Theo",
      text: "…she sent it to the only one who looks properly. Her brother.",
      open: "messages",
      item: "theo",
    },
    {
      done: (c) => "photo_0418" in c,
      objective: "Photos · open IMG_0418, the photo she sent Theo",
      text: "…the photo she sent Theo. IMG_0418.",
      open: "photos",
      item: "IMG_0418",
    },
    {
      done: (c) => "photo_figure" in c,
      objective: "IMG_0418 · hold the lens on the woman in the street",
      text: "…not the window. The street under it. Hold the lens on her.",
      open: "photos",
      item: "IMG_0418",
    },
  ],
  2: [
    {
      done: (c, wrong) => "note_code" in c || "voicemail_unknown" in c || wrong > 0,
      objective: "Notes · read “backup”",
      text: "…one of her notes changed tonight. “backup”.",
      open: "notes",
      item: "code",
    },
    {
      done: (c, wrong) => "voicemail_unknown" in c || wrong > 0,
      objective: "Phone · play the call from No caller ID",
      text: "…No caller ID, the night she went. Read what the phone wrote, not what you hear.",
      open: "phone",
      item: "unknown",
    },
    {
      // the Recovery menu is given away only after three wrong codes (owner playtest)
      done: (_, wrong) => wrong >= RECOVERY_HINT_AFTER,
      objective: "backup_you · the four digits are in the transcript",
      text: "…the transcript heard what the static covered. Four digits, like a clock.",
      open: "phone",
      item: "unknown",
    },
    {
      done: () => false,
      objective: "Recovery menu · the minute you came in",
      text: "…it's the minute you came in. The Recovery menu remembers it.",
    },
  ],
};
const RECOVERY_HINT_AFTER = 3;
const stepOf = (stage: 1 | 2, clues: Clues, wrong: number) => PATH[stage].find((p) => !p.done(clues, wrong));
// first hint after this long without progress, then the next one after HINT_AGAIN
// (long enough to wander: the path is meant to be found by reading; never under 60 s)
const HINT_FIRST = 120_000;
const HINT_AGAIN = 75_000;

/**
 * Turns clues into story beats: the stage changes only on key clues (photo figure → 2,
 * backup opened → 3) and the anonymous sender "helps" — guidance that looks like help.
 */
function useDirector() {
  const { state, dispatch } = useStory();
  const { stage, clues, wrongCodes, openedAt } = state;
  const said = useRef(new Set<string>());
  // the interlude has its own voice: no idle nudges once it has started
  const calm = useRef(state.calm);
  useEffect(() => {
    calm.current = state.calm;
  });
  const post = usePost();
  const say = (
    key: string,
    from: "anon" | "system",
    text: string,
    delay = 0,
    open?: AppId,
    item?: string,
    objective?: { text: string; until?: Until },
  ) => {
    if (said.current.has(key)) return;
    said.current.add(key);
    setTimeout(() => {
      // the interlude has its own voices: a late message from the sender stays unsent
      if (from === "anon" && calm.current) return;
      post({ from, text, open, item }, objective);
    }, delay);
  };
  // the latest hint stays under the menubar until its step is done (HintLine)
  const lastHint = useRef<string | null>(null);
  const hint = (st: 1 | 2, wrong = wrongCodes) => {
    if (calm.current) return;
    const step = stepOf(st, clues, wrong);
    if (!step || lastHint.current === step.text) return;
    lastHint.current = step.text;
    post({ from: "anon", text: step.text, open: step.open, item: step.item }, { text: step.objective, until: step.done });
    dispatch({ type: "hint", text: step.text, open: step.open, item: step.item, until: step.done });
  };

  useEffect(() => {
    const first = PATH[1][0];
    say("welcome", "anon", "She kept everything. Notes, calls, photos. Start with what she wrote down.", 2500, "notes", "lights", {
      text: first.objective,
      until: first.done,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the key moments are photographed too, silently (case file, page 2)
  const { video } = usePresence();
  const shot = useRef(new Set<string>());
  useEffect(() => {
    const moments: Record<string, string> = {
      photo_0418: "opens IMG_0418",
      photo_figure: "finds her in the street",
      "heard_ev-forlater": "listens to her",
      backup_open: "opens backup_you",
      look_live: "looks into 4A",
    };
    for (const [id, label] of Object.entries(moments)) {
      if (id in clues && !shot.current.has(id)) {
        shot.current.add(id);
        grabFrame(video(), label);
      }
    }
  }, [clues, video]);

  useEffect(() => {
    if (stage === 1 && "photo_figure" in clues) {
      dispatch({ type: "stage", stage: 2 });
      // the clues for the code arrive with the backup, not before (no skipping ahead);
      // the first one is a note that changed by itself, and it points at the phone
      const first = PATH[2][0];
      say("stage2", "system", "Notes · “backup” · edited just now", 1500, "notes", "code", { text: first.objective, until: first.done });
    }
    // the mail she scheduled lands once the phone has been heard: a second voice, not the first
    if (stage === 2 && "voicemail_unknown" in clues) say("forlater", "system", "1 new mail · E.V. · for later · scheduled", 9000, "mail", "for-later");
    if (stage === 2 && "backup_open" in clues) {
      dispatch({ type: "stage", stage: 3 });
      say("stage3", "system", `you spent ${duration(clues.backup_open)} getting here`, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, clues]);

  // Act 3: the system admits it sees you. An open palm (covering the camera) is answered on a
  // black screen; without a camera, so is coming back after leaving the page.
  // Covering the lens hides the face rather than showing a palm, so either one counts.
  const covered = () => {
    if (stage < 3 || calm.current || said.current.has("palm")) return;
    said.current.add("palm");
    glitchNow(1);
    blackout("no need to cover yourself.");
  };
  usePresenceEvent("gesture", (g) => {
    if (g === "palm") covered();
  });
  const wasAway = useRef(false);
  usePresenceEvent("change", (s) => {
    if (s.source === "camera" && s.faceLost) covered();
    const back = wasAway.current && !s.lookingAway;
    wasAway.current = s.lookingAway;
    if (stage < 3 || s.source !== "mouse" || !back || said.current.has("hide")) return;
    said.current.add("hide");
    glitchNow(1);
    blackout("no need to hide.");
  });

  // Stage 3: the log about the user is waiting. Then the sender offers a way out that is not
  // one: covering the camera (or leaving the page) is answered, on a black screen.
  const { tracker } = usePresence();
  useEffect(() => {
    if (stage !== 3 || !("backup_open" in clues)) return;
    say("log", "anon", "one of those files is still being written.", 7000, undefined, undefined, {
      text: "backup_you · open the file still being written",
      until: (c) => "session_open" in c,
    });
    say(
      "cover",
      "anon",
      tracker.state.source === "camera" ? "if you want it to stop, cover the camera." : "if you want it to stop, look away.",
      19000,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, clues]);

  // A second wrong code is a hint at once (the first one may just be a typo); the third
  // gives the Recovery menu away.
  useEffect(() => {
    if ((wrongCodes === 2 || wrongCodes === RECOVERY_HINT_AFTER) && stage === 2) hint(2, wrongCodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongCodes]);

  // No progress for a while: the hint for the next step. Any new clue restarts the wait.
  const hints = useRef(0);
  useEffect(() => {
    if (stage === 3) return;
    let t: ReturnType<typeof setTimeout>;
    const next = (ms: number) => {
      t = setTimeout(() => {
        hint(stage);
        hints.current += 1;
        next(HINT_AGAIN);
      }, ms);
    };
    next(hints.current ? HINT_AGAIN : HINT_FIRST);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, Object.keys(clues).length, wrongCodes]);

  // Stage 3: one nudge, never more.
  useEffect(() => {
    if (stage !== 3) return;
    const t = setTimeout(() => {
      if (!calm.current) say("idle3", "anon", "…open the one in progress.", 0, "backup", undefined, {
        text: "backup_you · open session_0418.log",
        until: (c) => "session_open" in c,
      });
    }, IDLE_NUDGE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, Object.keys(clues).length, openedAt]);
}

const CLOSE_GAP_MS = 420;
// The interlude: after the session log closes, how long until "View live" happens anyway.
// (Find My has its own nudges now: views/Locate.tsx)
const LOCATE_TIMEOUT_MS = 300_000;

/**
 * The interlude after S8. When session_0418.log closes (by the user or by itself) the case
 * seems to go back to E.V.: everything goes quiet (no glitches, no searchlight, one viewer),
 * the system reopens her case, Mara writes that E.V.'s phone just came back on, across the
 * road, and Find My opens by itself on flat 4A. Its "View live" starts the reveal.
 */
function useInterlude() {
  const { state, dispatch } = useStory();
  const post = usePost();
  const wasOpen = useRef(false);
  const started = useRef(false);
  const sessionOpen = state.windows.some((w) => w.id === "session");

  useEffect(() => {
    if (sessionOpen) wasOpen.current = true;
    if (sessionOpen || !wasOpen.current || started.current) return;
    started.current = true;
    const at = (ms: number, run: () => void) => setTimeout(run, ms);
    const timers = [
      at(400, () => {
        glitchNow(0.6);
        // the interlude starts clean: no stage 3 message lands over Mara's call
        dispatch({ type: "clearNotices" });
        dispatch({ type: "calm", calm: true });
        // the case seems over: no task until the story gives one again (after Mara's call)
        dispatch({ type: "objective", text: "" });
        dispatch({ type: "notify", from: "system", text: "operator review 0418 · closed · nothing found" });
      }),
      at(3200, () => dispatch({ type: "notify", from: "system", text: "case reopened · E.V. · new signal" })),
      at(6500, () => dispatch({ type: "notify", from: "mara", text: "ev?? your phone just came on" })),
      // she calls it, live (IncomingCall.tsx); Find My waits for the call to end
      at(9500, () => window.dispatchEvent(new Event(CALL_EVENT))),
    ];
    return () => timers.forEach(clearTimeout);
  }, [sessionOpen, dispatch]);

  const called = "call_done" in state.clues;
  useEffect(() => {
    if (!called) return;
    const at = (ms: number, run: () => void) => setTimeout(run, ms);
    const timers = [
      // she does not say which flat: the player has to know it (Find My asks)
      at(1500, () => dispatch({ type: "notify", from: "mara", text: "it says you're across the road. number 17. which flat??" })),
      at(5000, () => {
        post(
          { from: "system", text: "Find My · E.V.'s iPhone is online" },
          { text: "Find My · play a sound on her phone", until: (c) => "locate_ping" in c },
        );
        dispatch({ type: "open", id: "locate" });
      }),
      at(5000 + LOCATE_TIMEOUT_MS, () => dispatch({ type: "clue", id: "look_live" })),
    ];
    return () => timers.forEach(clearTimeout);
  }, [called, dispatch, post]);
}

/**
 * S9 starts on the desktop: once "View live" is chosen in Find My (or the interlude times
 * out), every window shuts itself in reverse open order, each one collapsing like an old
 * screen, then the phase moves to the reveal.
 */
function useReveal() {
  const { state, dispatch } = useStory();
  const started = useRef(false);
  const look = "look_live" in state.clues;
  const order = useRef(state.windows.map((w) => w.id));
  useEffect(() => {
    order.current = state.windows.map((w) => w.id);
  });

  useEffect(() => {
    if (!look || started.current) return;
    started.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const rest = [...order.current].reverse();
    rest.forEach((id, i) => {
      timers.push(
        setTimeout(() => {
          glitchNow(0.8, { sound: i === 0 });
          gsap.to(`[data-win="${id}"]`, {
            scaleY: 0.02,
            opacity: 0,
            duration: 0.22,
            ease: "power2.in",
            onComplete: () => dispatch({ type: "close", id }),
          });
        }, 600 + i * CLOSE_GAP_MS),
      );
    });
    // on a timer, not on the tweens: a throttled tab still reaches the reveal
    timers.push(setTimeout(() => dispatch({ type: "phase", phase: "reveal" }), 600 + rest.length * CLOSE_GAP_MS + 1200));
    return () => timers.forEach(clearTimeout);
  }, [look, dispatch]);
}

/** Menubar "Recovery" menu: the session log, where the entry time can be read again. */
function RecoveryMenu() {
  const { state } = useStory();
  const [open, setOpen] = useState(false);
  const { camera, verifiedAt } = state.session;
  return (
    <span className={styles.menu}>
      <button className={styles.menuButton} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Recovery
      </button>
      {open && (
        <ul className={`${styles.menuList} ${styles.glass}`}>
          <li>RECOVERY/4 · case 0418</li>
          <li>session opened {clock(state.openedAt, true)}</li>
          {verifiedAt && (
            <li>
              operator verification {camera === "granted" ? "recognised" : "refused"} · {clock(verifiedAt, true)}
            </li>
          )}
        </ul>
      )}
    </span>
  );
}

/**
 * What to do now, in the menubar: the short form of the last notice that gave one (usePost),
 * so it is never ahead of the notices. Once that step is done it says only "keep looking"
 * until the next notice. Reading the session log is the one thing it follows by itself.
 */
function objectiveOf(state: ReturnType<typeof useStory>["state"]) {
  const { objective, clues, wrongCodes, windows } = state;
  if (windows.some((w) => w.id === "session")) return "read it. close it when you're ready";
  if (!objective) return "";
  if (objective.until?.(clues, wrongCodes)) return "keep looking";
  return objective.text;
}

function Objective() {
  const { state } = useStory();
  const text = objectiveOf(state);
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(text);
  useEffect(() => {
    // a new task types itself in; the first one is simply there
    if (!el.current || shown.current === text) return;
    shown.current = text;
    const t = gsap.fromTo(el.current, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "steps(24)" });
    return () => void t.kill();
  }, [text]);
  // nothing to do yet: the first notice has not arrived
  if (!text) return null;
  return (
    <span className={styles.objective}>
      objective · <span ref={el}>{text}</span>
    </span>
  );
}

/** The latest hint, kept under the menubar: a notification is gone in 16 s, this is not. */
function HintLine() {
  const { state, dispatch } = useStory();
  const h = state.hint;
  // gone the moment its step is done, like the objective
  if (!h || state.calm || state.stage === 3 || h.until?.(state.clues, state.wrongCodes)) return null;
  return (
    <button
      className={`${styles.hintLine} ${styles.glass}`}
      onClick={() => h.open && dispatch({ type: "open", id: h.open, item: h.item })}
      disabled={!h.open}
    >
      {h.text}
    </button>
  );
}

/** One click opens (people expect a web page to answer a single click). */
function Icon({ app }: { app: AppDef }) {
  const { dispatch } = useStory();
  return (
    <button
      data-icon={app.id}
      className={`${styles.icon} ${app.id === "backup" ? styles.neon : ""} ${app.place === "file" ? styles.file : ""}`}
      onClick={() => dispatch({ type: "open", id: app.id })}
    >
      <span className={`${styles.glyph} ${styles.glass}`}>{app.glyph}</span>
      <span>{app.title}</span>
    </button>
  );
}

export default function Desktop() {
  const { state, dispatch } = useStory();
  const { stage, windows } = state;
  useDirector();
  useInterlude();
  useReveal();
  useEffect(prewarmLens, []);

  // Esc closes the window in front, like any desktop; not once the reveal has begun
  const front = useRef<AppId | null>(null);
  const revealing = "look_live" in state.clues;
  useEffect(() => {
    front.current = windows.length ? windows.reduce((a, b) => (b.z > a.z ? b : a)).id : null;
  });
  useEffect(() => {
    if (revealing) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && front.current) fadeClose(front.current, dispatch);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [revealing, dispatch]);

  // Entering stage 2: the camera opens by itself, once. Closing it keeps it closed.
  const prevStage = useRef(stage);
  useEffect(() => {
    if (prevStage.current < 2 && stage >= 2) dispatch({ type: "open", id: "camera" });
    prevStage.current = stage;
  }, [stage, dispatch]);

  return (
    <div className={styles.desktop} data-stage={stage} data-glitch>
      <Wallpaper />

      <TheSign />

      <header className={`${styles.menubar} ${styles.glass}`}>
        <span className={styles.menuLeft}>
          <span className={styles.owner}>E.V.</span>
          <RecoveryMenu />
          <Objective />
        </span>
        <span className={styles.menuRight}>
          {/* the audience: 1 = E.V.'s own session, 2 = someone else, 3 = you are counted */}
          <span className={stage === 3 && !state.calm ? styles.viewersNeon : undefined}>viewers {state.calm ? 1 : stage}</span>
          {stage >= 2 && !state.calm && <span className={styles.rec}>● REC</span>}
          <FullscreenToggle className={styles.soundMenu} />
          <SoundToggle className={styles.soundMenu} />
          <span>71%</span>
          <Clock />
        </span>
      </header>

      <HintLine />

      <nav className={styles.icons} aria-label="Apps">
        {APPS.filter((a) => !a.place && a.iconFrom !== null && stage >= a.iconFrom).map((a) => (
          <Icon key={a.id} app={a} />
        ))}
      </nav>

      <CalendarWidget />

      <nav className={styles.files} aria-label="Files on the desktop">
        {APPS.filter((a) => a.place === "file").map((a) => (
          <Icon key={a.id} app={a} />
        ))}
      </nav>

      <Polaroid />

      {windows.map((w) => (
        <Window key={w.id} win={w} />
      ))}

      <Notices />
      <IncomingCall />
      <BlinkCapture />
      <Reflection />
      <Blackout />
      <Crack />
    </div>
  );
}
