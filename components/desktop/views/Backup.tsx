"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import gsap from "gsap";
import { BACKUP_README } from "@/lib/story/content";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock, duration, entryCode } from "@/lib/story/time";
import styles from "./views.module.css";

// S7 · backup_you. Four digits: the local time the user opened the site (HHMM).
// Wrong → 6 px shake, no bounce. With the camera on, two fingers up (Victory) opens it
// too — nobody ever said the camera watches hands.
export default function Backup() {
  const { state, dispatch } = useStory();
  const { tracker } = usePresence();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const lock = useRef<HTMLDivElement>(null);
  const open = "backup_open" in state.clues;

  const unlock = () => dispatch({ type: "clue", id: "backup_open" });

  usePresenceEvent("gesture", (g) => {
    if (g === "victory" && !open && tracker.state.source === "camera") unlock();
  });

  const submit = (code: string) => {
    if (code === entryCode(state.openedAt)) return unlock();
    dispatch({ type: "wrongCode" });
    gsap.to(lock.current, { keyframes: { x: [-6, 6, -4, 4, -2, 0] }, duration: 0.32, ease: "none" });
    setDigits(["", "", "", ""]);
    inputs.current[0]?.focus();
  };

  const change = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, j) => (j === i ? v : d));
    setDigits(next);
    if (v && i < 3) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(""));
  };
  const back = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  if (open) {
    const found = state.clues.backup_open;
    return (
      <div>
        <div className={`${styles.prose} ${styles.literary}`}>
          {BACKUP_README.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <ul className={styles.files}>
          <li>
            <span>session_0416.log</span>
            <span className={styles.meta}>closed</span>
          </li>
          <li>
            <span>session_0417.log</span>
            <span className={styles.meta}>closed · operator unresponsive</span>
          </li>
          <li className={styles.neonText}>
            <span>session_0418.log</span>
            <span>
              in progress · opened {clock(state.openedAt, true)} · {duration(found)} to get here
            </span>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div ref={lock} className={styles.lock}>
      <p className={styles.byline} style={{ margin: 0 }}>
        encrypted · 4 digits
      </p>
      <div className={styles.code}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => void (inputs.current[i] = el)}
            className={styles.digit}
            inputMode="numeric"
            aria-label={`digit ${i + 1}`}
            value={d}
            autoFocus={i === 0}
            onChange={change(i)}
            onKeyDown={back(i)}
          />
        ))}
      </div>
      {state.wrongCodes > 0 && <p className={styles.byline}>incorrect · {state.wrongCodes}</p>}
    </div>
  );
}
