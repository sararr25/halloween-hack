"use client";

import { useState } from "react";
import { TRASH } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import { Empty, Row, Split, when } from "./shared";
import styles from "./views.module.css";

// Trash. Among the noise: the log of a previous recovery session (case 0417).
export default function Trash() {
  const { dispatch } = useStory();
  const [openId, setOpenId] = useState<string | null>(null);
  const file = TRASH.find((t) => t.id === openId);

  const open = (id: string) => {
    setOpenId(id);
    if (id === "log-0417") dispatch({ type: "clue", id: "trash_0417" });
  };

  return (
    <Split
      list={TRASH.map((t) => (
        <Row key={t.id} active={t.id === openId} onClick={() => open(t.id)} title={t.name} meta={when(t.days)} />
      ))}
    >
      {!file ? (
        <Empty>{TRASH.length} items · emptied automatically after 30 days</Empty>
      ) : (
        <article>
          <p className={styles.byline}>
            {file.name} · deleted {when(file.days)}
          </p>
          <div className={`${styles.prose} ${file.name.endsWith(".log") ? styles.mono : ""}`}>
            {file.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
      )}
    </Split>
  );
}
