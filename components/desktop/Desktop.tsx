"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { blackout, glitchNow } from "@/lib/story/glitch";
import { useStory, type AppId } from "@/lib/story/store";
import { clock, duration } from "@/lib/story/time";
import { APPS, type AppDef } from "./apps";
import BlinkCapture from "./BlinkCapture";
import { Blackout, CalendarWidget, Crack, Polaroid, TheSign, Wallpaper } from "./Decor";
import Notices from "./Notices";
import FullscreenToggle from "./FullscreenToggle";
import SoundToggle from "./SoundToggle";
import Window from "./Window";
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

// Hints that get warmer, one step at a time: every HINT_EVERY without progress (and, at
// stage 2, every wrong code) the anonymous sender points at the next place to look. Each
// hint opens that app when clicked. The ladders lead through the voicemails and the notes,
// so nobody skips them (owner playtest).
type Hint = [text: string, open?: AppId];
const HINT_EVERY: Record<1 | 2, number> = { 1: 55_000, 2: 45_000 };
const LADDER: Record<1 | 2, Hint[]> = {
  1: [
    ["…listen to what people left on her phone.", "phone"],
    ["…Theo asked her about a photo. Read their messages.", "messages"],
    ["…her last photo. Not the window. The street under it.", "photos"],
    ["…in IMG_0418, hold the lens on the woman by the lamp post.", "photos"],
  ],
  2: [
    ["…she set the code herself. Read her notes.", "notes"],
    ["…someone called her about tonight. Listen, then read what the phone heard.", "phone"],
    ["…she left a voice memo in a mail for later. Listen to it.", "mail"],
    ["…look at when that mail arrived. Four digits, like a clock.", "mail"],
    ["…it's the minute you came in. The Recovery menu remembers it."],
  ],
};

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
  const say = (key: string, from: "anon" | "system", text: string, delay = 0, open?: AppId) => {
    if (said.current.has(key)) return;
    said.current.add(key);
    setTimeout(() => {
      // the interlude has its own voices: a late message from the sender stays unsent
      if (from === "anon" && calm.current) return;
      dispatch({ type: "notify", from, text, open });
    }, delay);
  };
  const level = useRef<Record<1 | 2, number>>({ 1: 0, 2: 0 });
  const hint = (st: 1 | 2) => {
    const i = level.current[st];
    const step = LADDER[st][i];
    if (!step) return;
    level.current[st] = i + 1;
    say(`hint${st}-${i}`, "anon", step[0], 0, step[1]);
  };

  useEffect(() => {
    say("welcome", "anon", "She kept everything. Start with the mail.", 2500, "mail");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage === 1 && "photo_figure" in clues) {
      dispatch({ type: "stage", stage: 2 });
      say("stage2", "system", "IMG_0419 added · source: unknown device", 1200);
      say("faster", "anon", "You found the one in the street faster than the others did.", 5000);
    }
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
    say("log", "anon", "one of those files is still being written.", 7000);
    say(
      "cover",
      "anon",
      tracker.state.source === "camera" ? "if you want it to stop, cover the camera." : "if you want it to stop, look away.",
      19000,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, clues]);

  // A wrong code is a step down the ladder at once.
  useEffect(() => {
    if (wrongCodes > 0 && stage === 2) hint(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongCodes]);

  // No progress for a while: the next hint. Any new clue restarts the wait.
  useEffect(() => {
    if (stage === 3) return;
    const t = setInterval(() => hint(stage), HINT_EVERY[stage]);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, Object.keys(clues).length]);

  // Stage 3: one nudge, never more.
  useEffect(() => {
    if (stage !== 3) return;
    const t = setTimeout(() => {
      if (!calm.current) say("idle3", "anon", "…open the one in progress.", 0, "backup");
    }, IDLE_NUDGE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, Object.keys(clues).length, openedAt]);
}

const CLOSE_GAP_MS = 420;
// The interlude: after the session log closes, how long until "View live" happens anyway.
const LOCATE_NUDGE_MS = 40_000;
const LOCATE_TIMEOUT_MS = 90_000;

/**
 * The interlude after S8. When session_0418.log closes (by the user or by itself) the case
 * seems to go back to E.V.: everything goes quiet (no glitches, no searchlight, one viewer),
 * the system reopens her case, Mara writes that E.V.'s phone just came back on, across the
 * road, and Find My opens by itself on flat 4A. Its "View live" starts the reveal.
 */
function useInterlude() {
  const { state, dispatch } = useStory();
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
        dispatch({ type: "calm", calm: true });
        dispatch({ type: "notify", from: "system", text: "operator review 0418 · closed · nothing found" });
      }),
      at(3200, () => dispatch({ type: "notify", from: "system", text: "case reopened · E.V. · new signal" })),
      at(6500, () => dispatch({ type: "notify", from: "mara", text: "ev?? your phone just came on" })),
      at(11000, () => dispatch({ type: "notify", from: "mara", text: "it says you're in 4A. across the road. the empty one" })),
      at(15500, () => {
        dispatch({ type: "notify", from: "system", text: "Find My · E.V.'s iPhone is online" });
        dispatch({ type: "open", id: "locate" });
      }),
      at(15500 + LOCATE_NUDGE_MS, () => dispatch({ type: "notify", from: "anon", text: "…go on. look." })),
      at(15500 + LOCATE_TIMEOUT_MS, () => dispatch({ type: "clue", id: "look_live" })),
    ];
    return () => timers.forEach(clearTimeout);
  }, [sessionOpen, dispatch]);
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
 * What to do now, in the menubar: the operator's task list, one line. It moves on with the
 * key clues, so nobody is left wondering what the game wants.
 */
function objectiveOf(state: ReturnType<typeof useStory>["state"]) {
  const { stage, clues, calm } = state;
  if (calm) return "find where her phone is";
  if (stage === 3) return "open the file still being written";
  if (stage === 2) return "open backup_you · four digits";
  if ("mail_for_later" in clues || "chat_window" in clues) return "look closely at her photos";
  return "read her mail and messages";
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
  return (
    <span className={styles.objective}>
      objective · <span ref={el}>{text}</span>
    </span>
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
          {stage >= 2 && <span className={styles.rec}>● REC</span>}
          <FullscreenToggle className={styles.soundMenu} />
          <SoundToggle className={styles.soundMenu} />
          <span>71%</span>
          <Clock />
        </span>
      </header>

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
      <BlinkCapture />
      <Blackout />
      <Crack />
    </div>
  );
}
