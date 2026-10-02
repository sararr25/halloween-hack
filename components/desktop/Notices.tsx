"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { blip, key } from "@/lib/audio/sfx";
import { useStory, type Notice } from "@/lib/story/store";
import styles from "./desktop.module.css";

gsap.registerPlugin(useGSAP);

const SHOW_MS = 8000;
// a hint that points somewhere stays long enough to be read and followed
const HINT_MS = 16000;
const LABEL: Record<Notice["from"], string> = { anon: "unknown sender", system: "system", mara: "Mara · Messages" };

// Mono notifications, top right. The anonymous sender and Mara type; the system just appears.
export default function Notices() {
  const { state } = useStory();
  return (
    <div className={styles.notices} aria-live="polite">
      {/* never more than two at once: a stack of messages reads as noise (playtest) */}
      {state.notices.slice(-2).map((n) => (
        <Item key={n.id} notice={n} />
      ))}
    </div>
  );
}

function Item({ notice }: { notice: Notice }) {
  const { dispatch } = useStory();
  const el = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const text = el.current?.querySelector("p");
    if (!el.current || !text) return;
    gsap.from(el.current, { opacity: 0, y: -6, duration: 0.28, ease: "power3.out" });
    blip();
    if (notice.from !== "system") {
      // someone is typing it, key by key
      const n = notice.text.length;
      const typed = { n: 0 };
      let shown = 0;
      text.style.clipPath = "inset(0 100% 0 0)";
      gsap.to(typed, {
        n,
        duration: n * 0.045,
        delay: 0.3,
        ease: "none",
        onUpdate: () => {
          const c = Math.floor(typed.n);
          if (c !== shown) {
            shown = c;
            key();
          }
          text.style.clipPath = `inset(0 ${100 - (c / n) * 100}% 0 0)`;
        },
      });
    }
  });

  // Dismissal runs on a timer so a throttled tab still clears it.
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: "dismiss", id: notice.id }), notice.open ? HINT_MS : SHOW_MS);
    return () => clearTimeout(t);
  }, [dispatch, notice.id, notice.open]);

  const target = notice.open;
  const follow = () => {
    if (!target) return;
    dispatch({ type: "open", id: target, item: notice.item });
    dispatch({ type: "dismiss", id: notice.id });
  };



  return (
    <div
      ref={el}
      className={`${styles.notice} ${styles.glass} ${target ? styles.noticeLink : ""}`}
      // a hint: one click takes you where it points
      {...(target && {
        role: "button",
        tabIndex: 0,
        onClick: follow,
        onKeyDown: (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && follow(),
      })}
    >
      <span>{LABEL[notice.from]}</span>
      <p>{notice.text}</p>
    </div>
  );
}
