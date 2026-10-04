"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { key } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { acrossRive, scanRive, useMountedRive } from "@/lib/rive/persistent";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock, duration } from "@/lib/story/time";
import { fadeClose } from "../Window";
import styles from "./session.module.css";

gsap.registerPlugin(useGSAP);

// S8 · session_0418.log: the first time the data is about the user, not E.V.
// Left: the operator scan from S1, now live (the real face mesh every frame, or the guessed
// head turning with the mouse). Right: a log that writes itself from real session data.
// Looking away while it is open is written down at once. The player closes it when they
// have read it (the last line says so); only if they never do, it closes itself after a
// minute. Closing it starts the interlude, then the reveal (useInterlude and useReveal in
// Desktop.tsx).
const CLOSE_AFTER_MS = 60_000;
const LINE_EVERY_MS = 650;

const row = (label: string, value: string) => `${label.padEnd(14, " ")}${value}`;

export default function Session() {
  const { state, dispatch } = useStory();
  const { tracker } = usePresence();
  const { openedAt, session, clues, wrongCodes, interruptions, blinks } = state;
  const root = useRef<HTMLDivElement>(null);
  const scanHost = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [shown, setShown] = useState(0);
  const [asides, setAsides] = useState<string[]>([]);
  const live = tracker.state.source === "camera";

  useMountedRive(scanHost, scanRive);
  // the reveal's scene starts loading now, so its first frame is ready when it is needed
  useEffect(() => void acrossRive(), []);
  // the menubar objective that pointed here is done (Desktop.tsx)
  useEffect(() => dispatch({ type: "clue", id: "session_open" }), [dispatch]);

  // The scan goes live: every analysed frame, or the guess following the mouse.
  useEffect(() => {
    const scan = scanRive();
    scan.set("sweep", -1.3);
    scan.set("reveal", 1);
    scan.set("spin", 0);
    scan.set("yaw", 0);
    scan.set("pitch", 0);
    if (!live) {
      scan.set("mode", 1);
      return;
    }
    scan.set("mode", 0);
    return tracker.onPoints((p) => scan.set("points", p));
  }, [live, tracker]);
  usePresenceEvent("change", (s) => {
    if (live) return;
    scanRive().set("yaw", s.headX * 0.6);
    scanRive().set("pitch", s.headY * 0.35);
  });

  // Fixed facts, taken once when the log opens.
  const [facts] = useState(() => {
    const verified = session.verifiedAt ? clock(session.verifiedAt, true) : "never asked";
    return [
      "case 0418 · operator session · in progress",
      row("opened", clock(openedAt, true)),
      row(
        "verification",
        session.camera === "granted" ? `granted ${verified}` : `refused ${verified} · operator reconstructed`,
      ),
      ...("photo_figure" in clues ? [row("IMG_0418", `figure located after ${duration(clues.photo_figure)}`)] : []),
      ...("backup_open" in clues
        ? [row("backup_you", `opened after ${duration(clues.backup_open)}${wrongCodes ? ` · ${wrongCodes} wrong code${wrongCodes === 1 ? "" : "s"}` : ""}`)]
        : []),
    ];
  });
  const last = interruptions.at(-1);
  const liveRows = [
    row("looked away", `${interruptions.length} ${interruptions.length === 1 ? "time" : "times"}`),
    ...(blinks ? [row("blinks", `${blinks} · each one answered`)] : []),
    row("last time", last ? `${duration(now - last)} ago` : "not yet"),
    row("active", duration(now - openedAt)),
  ];
  const lines = [...facts, ...liveRows, ...asides, row("", "the operator may close this log.")];

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const reveal = setInterval(() => setShown((n) => n + 1), LINE_EVERY_MS);
    const close = setTimeout(() => dispatch({ type: "close", id: "session" }), CLOSE_AFTER_MS);
    return () => {
      clearInterval(tick);
      clearInterval(reveal);
      clearTimeout(close);
    };
  }, [dispatch]);

  // Looking away while it is open is written down straight away.
  const seen = useRef(interruptions.length);
  useEffect(() => {
    if (interruptions.length <= seen.current) return;
    seen.current = interruptions.length;
    glitchNow(0.7);
    setAsides((a) => [...a, row("", `operator looked away · ${clock(Date.now(), true)}`)]);
  }, [interruptions.length]);

  // Each new line types in with keystrokes.
  useGSAP(
    () => {
      const items = root.current?.querySelectorAll<HTMLElement>(`.${styles.log} li`);
      const el = items?.[Math.min(shown, lines.length) - 1];
      if (!el || el.dataset.typed) return;
      el.dataset.typed = "1";
      const n = el.textContent?.length ?? 10;
      const t = { c: 0 };
      let at = 0;
      gsap.to(t, {
        c: n,
        duration: Math.min(0.8, n * 0.02),
        ease: "none",
        onUpdate: () => {
          const c = Math.floor(t.c);
          if (c !== at) {
            at = c;
            key();
          }
          el.style.clipPath = `inset(0 ${100 - (c / n) * 100}% 0 0)`;
        },
      });
    },
    { scope: root, dependencies: [shown, lines.length] },
  );

  return (
    <div ref={root} className={styles.session}>
      <div className={styles.feed}>
        <div ref={scanHost} className={styles.scan} />
        <span className={styles.feedLabel}>{live ? "operator · live" : "reconstructed · live"}</span>
      </div>
      <ol className={styles.log} aria-live="polite">
        {lines.slice(0, shown).map((l, i) => (
          <li key={i} className={i >= facts.length && i < facts.length + liveRows.length ? styles.liveRow : undefined}>
            {i === lines.length - 1 ? (
              // the way out of the log is the log's own last line
              <button className={styles.closeLog} onClick={() => fadeClose("session", dispatch)}>
                {l}
              </button>
            ) : (
              l
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
