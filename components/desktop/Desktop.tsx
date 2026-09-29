"use client";

import { useEffect, useRef, useState } from "react";
import { usePresenceEvent } from "@/lib/presence/context";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock, duration } from "@/lib/story/time";
import { APPS, type AppDef } from "./apps";
import { CalendarWidget, Crack, Polaroid, TheSign } from "./Decor";
import Notices from "./Notices";
import SoundToggle from "./SoundToggle";
import Window from "./Window";
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

/**
 * Turns clues into story beats: the stage changes only on key clues (photo figure → 2,
 * backup opened → 3) and the anonymous sender "helps" — guidance that looks like help.
 */
function useDirector() {
  const { state, dispatch } = useStory();
  const { stage, clues, wrongCodes, openedAt } = state;
  const said = useRef(new Set<string>());
  const say = (key: string, from: "anon" | "system", text: string, delay = 0) => {
    if (said.current.has(key)) return;
    said.current.add(key);
    setTimeout(() => dispatch({ type: "notify", from, text }), delay);
  };

  useEffect(() => {
    say("welcome", "anon", "She kept everything. Start with the mail.", 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage === 1 && "photo_figure" in clues) {
      dispatch({ type: "stage", stage: 2 });
      say("stage2", "system", "IMG_0419 added · source: unknown device", 1200);
      say("faster", "anon", "You found him faster than the others did.", 5000);
    }
    if (stage === 2 && "backup_open" in clues) {
      dispatch({ type: "stage", stage: 3 });
      say("stage3", "system", `you spent ${duration(clues.backup_open)} getting here`, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, clues]);

  // Act 3: the system admits it sees your hands. An open palm (covering the camera) is answered.
  usePresenceEvent("gesture", (g) => {
    if (stage < 3 || g !== "palm" || said.current.has("palm")) return;
    glitchNow(1);
    say("palm", "anon", "no need to cover yourself.", 400);
  });

  useEffect(() => {
    if (wrongCodes >= 2) say("code", "anon", "…check her notes.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongCodes]);

  // Stuck: one nudge per stage, never more.
  useEffect(() => {
    const t = setTimeout(() => {
      if (stage === 1) say("idle1", "anon", "…look at her photos. Closely.");
      if (stage === 2) say("idle2", "anon", "…it's a time. Four digits.");
    }, IDLE_NUDGE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, Object.keys(clues).length, openedAt]);
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

  // Entering stage 2: the camera opens by itself, once. Closing it keeps it closed.
  const prevStage = useRef(stage);
  useEffect(() => {
    if (prevStage.current < 2 && stage >= 2) dispatch({ type: "open", id: "camera" });
    prevStage.current = stage;
  }, [stage, dispatch]);

  return (
    <div className={styles.desktop} data-stage={stage} data-glitch>
      <div className={styles.wallpaper} aria-hidden="true" />

      <TheSign />

      <header className={`${styles.menubar} ${styles.glass}`}>
        <span className={styles.menuLeft}>
          <span className={styles.owner}>E.V.</span>
          <RecoveryMenu />
        </span>
        <span className={styles.menuRight}>
          {/* the audience: 1 = E.V.'s own session, 2 = someone else, 3 = you are counted */}
          <span className={stage === 3 ? styles.viewersNeon : undefined}>viewers {stage}</span>
          {stage >= 2 && <span className={styles.rec}>● REC</span>}
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
      <Crack />
    </div>
  );
}
