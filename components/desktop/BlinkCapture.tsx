"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { shutter, subThud } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { grabStill } from "@/lib/presence/still";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./blink.module.css";

// Every blink is a photograph (stage 2+, camera only). The system does not hide it: each
// captured blink answers with one of four effects, in turn, so the player learns that
// their eyes are the trigger. Each capture keeps a still of the player (lib/presence/still)
// that ends up in backup_you. Nobody explains it.
//  shutter    the whole screen blinks with you, black, for a frame
//  still      your face, dithered, slides in and is filed away
//  viewfinder corner marks and the Sign lock onto the screen, "captured"
//  drain      the colour drains out of the world for an instant
type Effect = "shutter" | "still" | "viewfinder" | "drain";
const ORDER: Effect[] = ["shutter", "still", "viewfinder", "drain"];
// the least time between two captures, per stage (people blink every few seconds)
const GAP_MS: Record<2 | 3, number> = { 2: 5000, 3: 3000 };
const FX_MS: Record<Effect, number> = { shutter: 110, still: 2600, viewfinder: 900, drain: 260 };

type Shot = { n: number; effect: Effect; src: string | null; at: number };

export default function BlinkCapture() {
  const { state, dispatch } = useStory();
  const { tracker, video } = usePresence();
  const [shot, setShot] = useState<Shot | null>(null);
  const last = useRef(0);
  const count = useRef(0);
  const stillEl = useRef<HTMLDivElement>(null);
  const armed = state.phase === "desktop" && state.stage >= 2 && !state.calm;

  const capture = () => {
    if (!armed) return;
    const now = Date.now();
    if (now - last.current < GAP_MS[state.stage === 3 ? 3 : 2]) return;
    last.current = now;
    const src = grabStill(video());
    if (src) dispatch({ type: "frame", frame: { at: now, src } });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let effect = ORDER[count.current % ORDER.length];
    // no picture to show: the shutter instead; reduced motion: only the quiet ones
    if (effect === "still" && !src) effect = "shutter";
    if (reduced) effect = src ? "still" : "drain";
    count.current += 1;
    if (effect === "drain") subThud(0.35);
    else shutter();
    setShot({ n: count.current, effect, src, at: now });
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

  // The still is filed away: it flies to backup_you and shrinks into it.
  useEffect(() => {
    if (shot?.effect !== "still" || !stillEl.current) return;
    const el = stillEl.current;
    const target = document.querySelector('[data-icon="backup"]')?.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const tl = gsap.timeline();
    tl.from(el, { y: 16, opacity: 0, duration: 0.25, ease: "power3.out" });
    if (target)
      tl.to(
        el,
        {
          x: target.left + target.width / 2 - (box.left + box.width / 2),
          y: target.top + target.height / 2 - (box.top + box.height / 2),
          scale: 0.08,
          opacity: 0.2,
          duration: 0.6,
          ease: "power3.in",
        },
        1.6,
      );
    return () => void tl.kill();
  }, [shot]);

  if (!shot) return null;
  const label = `frame ${String(shot.n).padStart(4, "0")} · ${clock(shot.at, true)}`;
  return (
    <div className={styles.layer} aria-hidden="true">
      {shot.effect === "shutter" && <div className={styles.shutter} />}
      {shot.effect === "still" && shot.src && (
        <div ref={stillEl} className={styles.still}>
          {/* a data URL made on this device, nothing to optimise */}
          <Image src={shot.src} alt="" width={128} height={96} unoptimized />
          <span>{label} · eyes closed</span>
        </div>
      )}
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
