"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
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

// Faces of the people in E.V.'s life (public/avatars, sources in assets/). Anyone without a
// photo gets initials, like a real contact list.
const FACES: Record<string, string> = {
  "E.V.": "ev",
  "E.V. (mobile)": "ev",
  Mum: "mum",
  Mara: "mara",
  "Ines Arden": "ines",
  Theo: "theo",
};

/** A contact's round avatar: their photo, or their initials. `className` sets the size. */
export function Avatar({ name, className }: { name: string; className: string }) {
  const face = FACES[name];
  if (face)
    return <Image className={className} src={`/avatars/${face}.webp`} alt="" width={96} height={96} aria-hidden="true" />;
  const letters = name
    .replace(/[^A-Za-z. ]/g, "")
    .split(/[ .]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className={className} aria-hidden="true">
      {letters}
    </span>
  );
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
