"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useStory, type Notice } from "@/lib/story/store";
import styles from "./desktop.module.css";

gsap.registerPlugin(useGSAP);

const SHOW_MS = 8000;

// Mono notifications, top right. The anonymous sender types; the system just appears.
export default function Notices() {
  const { state } = useStory();
  return (
    <div className={styles.notices} aria-live="polite">
      {state.notices.map((n) => (
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
    if (notice.from === "anon") {
      const n = notice.text.length;
      gsap.fromTo(text, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: n * 0.045, delay: 0.3, ease: `steps(${n})` });
    }
  });

  // Dismissal runs on a timer so a throttled tab still clears it.
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: "dismiss", id: notice.id }), SHOW_MS);
    return () => clearTimeout(t);
  }, [dispatch, notice.id]);

  return (
    <div ref={el} className={`${styles.notice} ${styles.glass}`}>
      <span>{notice.from === "anon" ? "unknown sender" : "system"}</span>
      <p>{notice.text}</p>
    </div>
  );
}
