"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fill } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import { clock, daysAgo, today } from "@/lib/story/time";
import styles from "./views.module.css";

/** Fills {{entry}}, {{now}}, {{today}} with the user's own session data. */
export function useFill() {
  const { state } = useStory();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const ctx = { entry: clock(state.openedAt), now: clock(now), today: today(now) };
  return (text: string) => fill(text, ctx);
}

/** "today 23:02", "yesterday", "23 Sep" — like a file listing. */
export function when(days: number, time?: string) {
  if (days === 0) return time ? `today ${time}` : "today";
  if (days === 1) return time ? `yesterday ${time}` : "yesterday";
  return time ? `${daysAgo(days)} ${time}` : daysAgo(days);
}

/** Two-pane app: list on the left, the selected item on the right. */
export function Split({ list, children }: { list: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.split}>
      <ul className={styles.list}>{list}</ul>
      <div className={styles.detail}>{children}</div>
    </div>
  );
}

export function Row({
  active,
  unread,
  onClick,
  title,
  meta,
  preview,
}: {
  active: boolean;
  unread?: boolean;
  onClick: () => void;
  title: ReactNode;
  meta?: ReactNode;
  preview?: ReactNode;
}) {
  return (
    <li>
      <button className={`${styles.row} ${active ? styles.active : ""}`} onClick={onClick}>
        <span className={styles.rowHead}>
          <span className={`${styles.rowTitle} ${unread ? styles.unread : ""}`}>{title}</span>
          {meta && <span className={styles.meta}>{meta}</span>}
        </span>
        {preview && <span className={styles.preview}>{preview}</span>}
      </button>
    </li>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
