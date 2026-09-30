"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { shutter, subThud } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./blink.module.css";

// Every blink is noticed (stage 2+, camera only). The system does not hide it: each
// answered blink gets one of three effects, in turn, so the player learns that their eyes
// are the trigger. No picture of the player is shown before the end (S9 keeps that).
// Nobody explains it.
//  shutter    the whole screen blinks with you, black, for a frame
//  viewfinder corner marks and the Sign lock onto the screen, "captured"
//  drain      the colour drains out of the world for an instant
type Effect = "shutter" | "viewfinder" | "drain";
const ORDER: Effect[] = ["shutter", "viewfinder", "drain"];
// the least time between two captures, per stage (people blink every few seconds)
const GAP_MS: Record<2 | 3, number> = { 2: 5000, 3: 3000 };
const FX_MS: Record<Effect, number> = { shutter: 110, viewfinder: 900, drain: 260 };

type Shot = { n: number; effect: Effect; at: number };

export default function BlinkCapture() {
  const { state, dispatch } = useStory();
  const { tracker } = usePresence();
  const [shot, setShot] = useState<Shot | null>(null);
  const last = useRef(0);
  const count = useRef(0);
  const armed = state.phase === "desktop" && state.stage >= 2 && !state.calm;

  const capture = () => {
    if (!armed) return;
    const now = Date.now();
    if (now - last.current < GAP_MS[state.stage === 3 ? 3 : 2]) return;
    last.current = now;
    dispatch({ type: "blink" });
    // reduced motion: only the quiet one
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effect = reduced ? "drain" : ORDER[count.current % ORDER.length];
    count.current += 1;
    if (effect === "drain") subThud(0.35);
    else shutter();
    setShot({ n: count.current, effect, at: now });
  };

  usePresenceEvent("blink", () => {
    if (tracker.state.source === "camera") capture();
  });

  // Dev only: Alt+K stands in for a blink (the in-app browser has no camera).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const key = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "KeyK") capture();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // Each effect clears itself on a timer (a throttled tab still clears it).
  useEffect(() => {
    if (!shot) return;
    document.body.dataset.blink = shot.effect;
    const t = setTimeout(() => {
      setShot(null);
      delete document.body.dataset.blink;
    }, FX_MS[shot.effect]);
    return () => {
      clearTimeout(t);
      delete document.body.dataset.blink;
    };
  }, [shot]);

  if (!shot) return null;
  const label = `frame ${String(shot.n).padStart(4, "0")} · ${clock(shot.at, true)}`;
  return (
    <div className={styles.layer} aria-hidden="true">
      {shot.effect === "shutter" && <div className={styles.shutter} />}
      {shot.effect === "viewfinder" && (
        <div className={styles.viewfinder}>
          <i />
          <i />
          <i />
          <i />
          <Image className={styles.reticle} src="/sign.png" alt="" width={120} height={120} unoptimized loading="eager" />
          <span>● captured · {label}</span>
        </div>
      )}
      {shot.effect === "drain" && <span className={styles.drainLabel}>{label} · logged</span>}
    </div>
  );
}
