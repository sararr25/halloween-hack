"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { subThud } from "@/lib/audio/sfx";
import { usePresence } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import styles from "./reflection.module.css";

// The black mirror. Once, a little after the backup opens (stage 3), the screen goes dark
// like a monitor switching off, and in the dark glass there is the player's own reflection:
// the webcam, mirrored, soft, grey, faint, behind a sheen of glare. Three seconds, then the
// desktop comes back as if nothing happened. Without a camera the glass stays empty and
// only the glare moves. The frames are drawn on the page and never kept.
const AFTER_MS = 16_000;
const HOLD_MS = 3200;

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
    subThud(0.6);
    const el = video();
    const ctx = canvas.current?.getContext("2d");
    const live = tracker.state.source === "camera" && !!el?.srcObject && !!ctx;
    let raf = 0;
    const draw = () => {
      if (!el || !ctx) return;
      const c = ctx.canvas;
      c.width = 480;
      c.height = 270;
      ctx.setTransform(-1, 0, 0, 1, c.width, 0); // a mirror
      // cover: the reflection fills the glass
      const vr = el.videoWidth / el.videoHeight || 16 / 9;
      const w = Math.max(c.width, c.height * vr);
      ctx.drawImage(el, (c.width - w) / 2, 0, w, w / vr);
      raf = requestAnimationFrame(draw);
    };
    if (live) raf = requestAnimationFrame(draw);
    const tl = gsap.timeline();
    tl.fromTo(layer.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.in" });
    tl.fromTo(glare.current, { xPercent: -30 }, { xPercent: 30, duration: HOLD_MS / 1000 + 0.6, ease: "none" }, 0);
    const off = setTimeout(() => {
      gsap.to(layer.current, { opacity: 0, duration: 0.5, ease: "power2.out", onComplete: () => setOn(false) });
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
