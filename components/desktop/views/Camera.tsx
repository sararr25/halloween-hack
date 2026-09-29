"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PresenceEye, { type EyeHandle } from "@/components/PresenceEye";
import { shutter } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./views.module.css";

// Camera: opens by itself at stage 2. It does not show you, it shows what watches you:
// a surveillance lens (Rive "Lens") that follows your head, or the mouse when the camera
// was refused. When you blink, its shutter fires.
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
  const fire = () => {
    eye.current?.blink();
    shutter();
  };
  usePresenceEvent("blink", fire);

  // Without a camera there are no blinks: it photographs every click instead.
  useEffect(() => {
    if (tracker.state.source === "camera") return;
    window.addEventListener("pointerdown", fire);
    return () => window.removeEventListener("pointerdown", fire);
  });

  return (
    <div className={styles.camera}>
      <PresenceEye onReady={onEye} artboard="Lens" />
      <span className={styles.camLabel}>● REC · {state.session.camera === "granted" ? "FRONT" : "NO SIGNAL"}</span>
      <span className={styles.camTime}>{clock(now, true)}</span>
    </div>
  );
}
