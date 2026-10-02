"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { key } from "@/lib/audio/sfx";
import { LAST_SEARCH_RESULT, LIVE_SEARCHES, SEARCHES } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import { useFill, when } from "./shared";
import styles from "./views.module.css";

gsap.registerPlugin(useGSAP);

// S6 · Browser history. The newest search is the only one that opens: it points at the
// session log (the password). Stage 2+: new searches appear while you read.
export default function History() {
  const { state, dispatch } = useStory();
  const f = useFill();
  const [live, setLive] = useState<string[]>([]);
  const [result, setResult] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.stage < 2 || live.length >= LIVE_SEARCHES.length) return;
    const t = setTimeout(() => setLive((l) => [LIVE_SEARCHES[l.length], ...l]), 6000 + Math.random() * 3000);
    return () => clearTimeout(t);
  }, [state.stage, live.length]);

  // a live search is typed in, as if someone is still at the keyboard
  useGSAP(
    () => {
      const first = root.current?.querySelector<HTMLElement>(`.${styles.live} .${styles.q}`);
      if (!first || !live.length) return;
      const n = first.textContent?.length ?? 10;
      gsap.fromTo(
        first,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: n * 0.05, ease: `steps(${n})`, onUpdate: key },
      );
    },
    { scope: root, dependencies: [live.length] },
  );

  const openLast = () => {
    setResult((r) => !r);
    dispatch({ type: "clue", id: "history_last" });
  };

  const [last, ...rest] = SEARCHES;

  return (
    <div ref={root}>
      <ul className={styles.searches}>
        {live.map((q) => (
          <li key={q} className={`${styles.search} ${styles.live}`}>
            <span className={styles.q}>{f(q)}</span>
            <span className={styles.meta}>just now</span>
          </li>
        ))}
        <li className={styles.search}>
          {/* it hints at the backup code: it only opens once the backup exists */}
          {state.stage >= 2 ? (
            <button className={`${styles.searchBtn} ${styles.link}`} onClick={openLast}>
              {last.q}
            </button>
          ) : (
            <span>{last.q}</span>
          )}
          <span className={styles.meta}>{when(last.days, last.time)}</span>
        </li>
        {result && (
          <li className={styles.result}>
            {LAST_SEARCH_RESULT.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </li>
        )}
        {rest.map((s) => (
          <li key={s.q} className={styles.search}>
            <span>{s.q}</span>
            <span className={styles.meta}>{when(s.days, s.time)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
