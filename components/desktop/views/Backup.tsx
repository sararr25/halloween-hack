"use client";

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import gsap from "gsap";
import { BACKUP_README } from "@/lib/story/content";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock, duration, entryCode } from "@/lib/story/time";
import { caseId } from "@/lib/story/caseno";
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

  // the boxes as they are right now: two keys can land before React renders again
  const current = useRef(["", "", "", ""]);
  const show = (next: string[]) => {
    current.current = next;
    setDigits(next);
  };

  const submit = (code: string) => {
    if (code === entryCode(state.openedAt)) return unlock();
    dispatch({ type: "wrongCode" });
    gsap.to(lock.current, { keyframes: { x: [-6, 6, -4, 4, -2, 0] }, duration: 0.32, ease: "none" });
    show(["", "", "", ""]);
    inputs.current[0]?.focus();
  };

  /** Writes `typed` from box `from` on (one key, or a whole pasted code). */
  const fill = (from: number, typed: string) => {
    const next = [...current.current];
    let i = from;
    for (const d of typed) {
      if (i > 3) break;
      next[i++] = d;
    }
    show(next);
    if (next.every(Boolean)) return submit(next.join(""));
    inputs.current[Math.min(i, 3)]?.focus();
  };

  const change = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value.replace(/\D/g, "");
    if (!typed) return show(current.current.map((d, j) => (j === i ? "" : d)));
    // a box that already held a digit: the new key is the last one
    fill(i, typed.length > 1 && current.current[i] ? typed.slice(-1) : typed);
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const typed = e.clipboardData.getData("text").replace(/\D/g, "");
    if (typed) fill(0, typed);
  };
  const back = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !current.current[i] && i > 0) inputs.current[i - 1]?.focus();
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
            <span>session_{caseId(state.caseNo - 2)}.log</span>
            <span className={styles.meta}>closed</span>
          </li>
          <li>
            <span>session_{caseId(state.caseNo - 1)}.log</span>
            <span className={styles.meta}>closed · operator unresponsive</span>
          </li>
          <li className={styles.neonText}>
            {/* S8: the one file that is about the user */}
            <button className={styles.fileOpen} onClick={() => dispatch({ type: "open", id: "session" })}>
              session_{caseId(state.caseNo)}.log
            </button>
            <span>
              {/* the interlude pretends the review is over */}
              {state.calm
                ? "closed · nothing found"
                : `in progress · opened ${clock(state.openedAt, true)} · ${duration(found)} to get here`}
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
            onPaste={paste}
          />
        ))}
      </div>
      {state.wrongCodes > 0 && <p className={styles.byline}>incorrect · {state.wrongCodes}</p>}
    </div>
  );
}
