"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { blip, key } from "@/lib/audio/sfx";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import { SignGlyph } from "./Decor";
import desk from "./desktop.module.css";
import styles from "./briefing.module.css";

gsap.registerPlugin(useGSAP);

// The case briefing, between the scan (S1) and the desktop, in the same language as the
// rest of the OS: one glass window, the case file, filled in by the system line by line
// (mono labels, keystrokes), E.V.'s photo, then one line in her world (serif) and the
// objective. The window collapses like the others do in S9; for an instant the Sign and a
// recording light are on the operator, not on her. Under 20 s, skippable. Steps run on
// timers, not on tweens, so a throttled tab still reaches the desktop.
const ROWS: [label: string, value: string][] = [
  ["subject", "E.V., 29, photographer"],
  ["status", "missing · 7 days"],
  ["last seen", "at home · 16 Harrow St"],
  ["found", "front door open · laptop on"],
  ["police", "search suspended"],
  ["assigned", "recovery operator · you"],
];
const OPEN_AT = 0.3;
const ROW_AT = 1.0;
const ROW_EVERY = 1.2;
const LINE_AT = ROW_AT + ROWS.length * ROW_EVERY + 0.3;
const GOAL_AT = LINE_AT + 3;
const CLOSE_AT = GOAL_AT + 3.4;
const END_AT = CLOSE_AT + 1.6;
export const BRIEFED_KEY = "recovery.briefed";

export default function Briefing() {
  const { state, dispatch } = useStory();
  const root = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0); // rows written so far
  const [line, setLine] = useState(false);
  const [goal, setGoal] = useState(false);
  const [flicker, setFlicker] = useState(false);

  const done = () => {
    try {
      localStorage.setItem(BRIEFED_KEY, "1");
    } catch {
      // storage blocked: the briefing just plays again next time
    }
    dispatch({ type: "phase", phase: "desktop" });
  };

  useEffect(() => {
    const at = (s: number, run: () => void) => setTimeout(run, s * 1000);
    const timers = [
      at(OPEN_AT, () => {
        blip();
        gsap.fromTo(win.current, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" });
      }),
      ...ROWS.map((_, i) => at(ROW_AT + i * ROW_EVERY, () => setShown(i + 1))),
      at(LINE_AT, () => setLine(true)),
      at(GOAL_AT, () => setGoal(true)),
      at(CLOSE_AT, () => {
        glitchNow(0.8);
        gsap.to(win.current, { scaleY: 0.02, opacity: 0, duration: 0.24, ease: "power2.in" });
      }),
      at(CLOSE_AT + 0.5, () => {
        glitchNow(0.9);
        setFlicker(true);
      }),
      at(CLOSE_AT + 0.95, () => setFlicker(false)),
      at(END_AT, done),
    ];
    return () => timers.forEach(clearTimeout);
    // runs once for the whole briefing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whatever was just written types in, with a keystroke per character.
  const type = (el: Element | null | undefined, cps = 32) => {
    if (!el) return;
    const n = el.textContent?.length ?? 10;
    const t = { c: 0 };
    let at = 0;
    (el as HTMLElement).style.clipPath = "inset(0 100% 0 0)";
    gsap.to(t, {
      c: n,
      duration: n / cps,
      ease: "none",
      onUpdate: () => {
        const c = Math.floor(t.c);
        if (c !== at) {
          at = c;
          key();
        }
        (el as HTMLElement).style.clipPath = `inset(0 ${100 - (c / n) * 100}% 0 0)`;
      },
    });
  };
  useGSAP(() => type(root.current?.querySelector(`[data-row="${shown}"] dd`)), { scope: root, dependencies: [shown] });
  useGSAP(() => void (line && type(root.current?.querySelector("[data-line]"), 40)), { scope: root, dependencies: [line] });
  useGSAP(() => void (goal && type(root.current?.querySelector("[data-goal]"), 22)), { scope: root, dependencies: [goal] });
  useGSAP(
    () => {
      if (shown >= 3) gsap.fromTo("[data-photo]", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power1.out" });
    },
    { scope: root, dependencies: [shown >= 3] },
  );

  return (
    <div ref={root} className={styles.briefing} data-glitch>
      <div ref={win} className={`${desk.glass} ${styles.window}`} style={{ opacity: 0 }}>
        <div className={styles.titlebar}>
          <i />
          <span>case_0418 · RECOVERY/4</span>
        </div>
        <div className={styles.body}>
          <div className={styles.file}>
            <span className={styles.face}>
              <Image src="/avatars/ev.webp" alt="" width={96} height={96} />
            </span>
            <dl className={styles.rows}>
              {ROWS.slice(0, shown).map(([label, value], i) => (
                <div key={label} data-row={i + 1} className={i === 1 ? styles.status : undefined}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <figure data-photo className={styles.photo} style={{ opacity: 0 }}>
              <Image src="/photos/IMG_0413.jpg" alt="" width={300} height={200} />
              <figcaption>last photo on her camera roll · Harrow St</figcaption>
            </figure>
          </div>

          {line && (
            <p data-line className={styles.line}>
              Her laptop is on this screen. Mail, photos, messages, notes, voicemails.
            </p>
          )}
          {goal && (
            <p className={styles.goal}>
              <span>objective</span> <b data-goal>find out what she saw</b>
            </p>
          )}
        </div>
      </div>

      {flicker && (
        <>
          <SignGlyph size={120} className={styles.sign} />
          <p className={styles.rec} aria-hidden="true">
            ● REC · operator · {clock(state.openedAt, true)}
          </p>
        </>
      )}

      <button className={styles.skip} onClick={done}>
        skip
      </button>
    </div>
  );
}
