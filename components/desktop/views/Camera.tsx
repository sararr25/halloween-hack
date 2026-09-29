"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PresenceEye, { type EyeHandle } from "@/components/PresenceEye";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./views.module.css";

// Camera: opens by itself at stage 2. It does not show you — it shows what watches you.
// The Rive eye follows your head (or the mouse, when the camera was refused).
export default function Camera() {
  const { state } = useStory();
  const { tracker } = usePresence();
  const eye = useRef<EyeHandle | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const onEye = useCallback(
    (h: EyeHandle) => {
      eye.current = h;
      h.update(tracker.state);
    },
    [tracker],
  );
  usePresenceEvent("change", (s) => eye.current?.update(s));
  usePresenceEvent("blink", () => eye.current?.blink());

  return (
    <div className={styles.camera}>
      <PresenceEye onReady={onEye} />
      <span className={styles.camLabel}>● REC · {state.session.camera === "granted" ? "FRONT" : "NO SIGNAL"}</span>
      <span className={styles.camTime}>{clock(now, true)}</span>
    </div>
  );
}
