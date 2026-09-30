"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { subThud } from "@/lib/audio/sfx";
import { usePresence } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import styles from "./reflection.module.css";

// The black mirror. Once, a little after the backup opens (stage 3), the screen dims for a
// moment like a monitor saving power, and in the dark glass there might be someone: the
// webcam, mirrored, reduced to a shape, barely there. It must leave a doubt, not an answer
// (owner playtest: a clear face gave the ending away). Without a camera the glass stays
// empty and only the glare moves. The frames are drawn on the page and never kept.
const AFTER_MS = 16_000;
const HOLD_MS = 1400;
// so few pixels that only a shape survives: a head, shoulders, never a face
const GHOST = { w: 40, h: 23 };

export default function Reflection() {
  const { state } = useStory();
  const { tracker, video } = usePresence();
  const [on, setOn] = useState(false);
  const done = useRef(false);
  const layer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glare = useRef<HTMLElement>(null);
  const armed = state.phase === "desktop" && state.stage === 3 && !state.calm;

  useEffect(() => {
    if (!armed || done.current) return;
    const t = setTimeout(() => {
      done.current = true;
      setOn(true);
    }, AFTER_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (!on) return;
    subThud(0.2);
    const el = video();
    const ctx = canvas.current?.getContext("2d");
    const live = tracker.state.source === "camera" && !!el?.srcObject && !!ctx;
    let raf = 0;
    const draw = () => {
      if (!el || !ctx) return;
      const c = ctx.canvas;
      c.width = GHOST.w;
      c.height = GHOST.h;
      ctx.setTransform(-1, 0, 0, 1, c.width, 0); // a mirror
      // cover: the reflection fills the glass
      const vr = el.videoWidth / el.videoHeight || 16 / 9;
      const w = Math.max(c.width, c.height * vr);
      ctx.drawImage(el, (c.width - w) / 2, 0, w, w / vr);
      raf = requestAnimationFrame(draw);
    };
    if (live) raf = requestAnimationFrame(draw);
    const tl = gsap.timeline();
    tl.fromTo(layer.current, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.in" });
    tl.fromTo(glare.current, { xPercent: -30 }, { xPercent: 30, duration: HOLD_MS / 1000 + 0.6, ease: "none" }, 0);
    const off = setTimeout(() => {
      gsap.to(layer.current, { opacity: 0, duration: 0.6, ease: "power1.out", onComplete: () => setOn(false) });
    }, HOLD_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(off);
      tl.kill();
    };
  }, [on, tracker, video]);

  if (!on) return null;
  return (
    <div ref={layer} className={styles.mirror} aria-hidden="true">
      <canvas ref={canvas} className={styles.you} />
      <i ref={glare} className={styles.glare} />
    </div>
  );
}
