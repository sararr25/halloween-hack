"use client";

import { useEffect, useRef, useState } from "react";
import FxOverlay, { type FxLevels } from "@/components/FxOverlay";
import { useStory, type Stage } from "@/lib/story/store";
import { APPS } from "./apps";
import Window from "./Window";
import styles from "./desktop.module.css";

// Overlay intensity per stage (HANDOVER stage table: low / medium / high).
const STAGE_FX: Record<Stage, FxLevels> = {
  1: { grain: 0.25, vignette: 0.35, glitch: 0.1, neon: 0 },
  2: { grain: 0.45, vignette: 0.55, glitch: 0.35, neon: 0 },
  3: { grain: 0.7, vignette: 0.75, glitch: 0.7, neon: 1 },
};

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span>
      {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{" "}
      {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

export default function Desktop() {
  const { state, dispatch } = useStory();
  const { stage, windows } = state;

  // Entering stage 2: the camera opens by itself, once. Closing it keeps it closed.
  const prevStage = useRef(stage);
  useEffect(() => {
    if (prevStage.current < 2 && stage >= 2) dispatch({ type: "open", id: "camera" });
    prevStage.current = stage;
  }, [stage, dispatch]);

  return (
    <div className={styles.desktop} data-stage={stage}>
      <div className={styles.wallpaper} aria-hidden="true" />

      <header className={`${styles.menubar} ${styles.glass}`}>
        <span className={styles.owner}>E.V.</span>
        <span className={styles.menuRight}>
          {stage >= 2 && <span className={styles.rec}>● REC</span>}
          <Clock />
        </span>
      </header>

      <nav className={styles.icons} aria-label="Desktop">
        {APPS.filter((a) => a.iconFrom !== null && stage >= a.iconFrom).map((a) => (
          <button
            key={a.id}
            data-icon={a.id}
            className={`${styles.icon} ${a.id === "backup" ? styles.neon : ""}`}
            onDoubleClick={() => dispatch({ type: "open", id: a.id })}
            onKeyDown={(e) => e.key === "Enter" && dispatch({ type: "open", id: a.id })}
          >
            <span className={`${styles.glyph} ${styles.glass}`}>{a.glyph}</span>
            <span>{a.title}</span>
          </button>
        ))}
      </nav>

      {windows.map((w) => (
        <Window key={w.id} win={w} />
      ))}

      <FxOverlay levels={STAGE_FX[stage]} />
    </div>
  );
}
