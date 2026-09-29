"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import PresenceEye, { type EyeHandle } from "@/components/PresenceEye";
import FxOverlay from "@/components/FxOverlay";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./boot.module.css";

gsap.registerPlugin(useGSAP);

type Step = "idle" | "running" | "calibrating" | "done";

// Stage 1 · perfect: subliminal grain and glitch (HANDOVER stage table)
const STAGE1_FX = { grain: 0.25, vignette: 0.35, glitch: 0.1, neon: 0 };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// S1 · Boot: a clinical recovery log. Camera and microphone are asked inside the fiction,
// as operator verification. Refusing changes nothing but the record.
export default function Boot() {
  const { state, dispatch } = useStory();
  const { tracker, video } = usePresence();
  const [step, setStep] = useState<Step>("idle");
  const [lines, setLines] = useState<string[]>(() => [
    "RECOVERY/4 · device image E.V. · 118.4 GB",
    `session opened ${clock(state.openedAt, true)}`,
  ]);
  const root = useRef<HTMLDivElement>(null);
  const eye = useRef<EyeHandle | null>(null);

  const onEye = useCallback(
    (handle: EyeHandle) => {
      eye.current = handle;
      handle.update(tracker.state);
    },
    [tracker],
  );
  usePresenceEvent("change", (s) => eye.current?.update(s));
  usePresenceEvent("blink", () => eye.current?.blink());

  const log = (line: string) => setLines((l) => [...l, line]);

  // Every new line types in, like a log being written (28 ms/char, steps — docs/scenes.md).
  useGSAP(
    () => {
      const items = root.current?.querySelectorAll(`.${styles.log} li`);
      const last = items?.[items.length - 1];
      if (!items || !last) return;
      // lines already written stay whole, even if a new one interrupts their typing
      gsap.killTweensOf(items);
      gsap.set(items, { clipPath: "none" });
      const n = last.textContent?.length ?? 10;
      gsap.fromTo(
        last,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: Math.min(1.1, n * 0.028), ease: `steps(${n})` },
      );
    },
    { scope: root, dependencies: [lines.length] },
  );

  // The eye is out of focus until verification starts, then it finds you.
  useGSAP(
    () => {
      if (step === "idle") return;
      gsap.to(`.${styles.eye}`, { opacity: 1, filter: "blur(0px)", duration: 1.6, ease: "sine.inOut" });
    },
    { scope: root, dependencies: [step === "idle"] },
  );

  useEffect(() => {
    if (step !== "done") return;
    // Fade to the desktop once (600 ms). The phase change runs on a timer, not on the tween,
    // so a throttled tab (no animation frames) still reaches the desktop.
    const t = gsap.to(root.current, { opacity: 0, duration: 0.6, delay: 1.4, ease: "power2.in" });
    const next = setTimeout(() => dispatch({ type: "phase", phase: "desktop" }), 2000);
    return () => {
      t.kill();
      clearTimeout(next);
    };
  }, [step, dispatch]);

  const start = async () => {
    const el = video();
    if (!el) throw new Error("presence video element missing");
    setStep("running");
    log("mounting image ........ ok");
    await wait(500);
    log("integrity ............. 3 sectors unreadable");
    await wait(600);
    log("operator verification required by protocol");
    await wait(500);
    log("camera + microphone · processed on this device only");
    await wait(700);

    const ok = await tracker.startCamera(el, { withMic: true });
    const at = Date.now();
    dispatch({
      type: "session",
      session: {
        camera: ok ? "granted" : "denied",
        mic: ok && tracker.micGranted ? "granted" : "denied",
        verifiedAt: at,
      },
    });

    if (!ok) {
      // Refusal is data too: the story will remember it.
      try {
        localStorage.setItem("recovery.cameraDenied", new Date(at).toISOString());
      } catch {}
      log(`verification refused · ${clock(at, true)}`);
      await wait(900);
      log("access granted anyway");
      setStep("done");
      return;
    }

    setStep("calibrating");
    log("hold still");
    await wait(2000);
    tracker.calibrate();
    log(`operator recognised · ${clock(Date.now(), true)}`);
    await wait(900);
    log("access granted");
    setStep("done");
  };

  return (
    <div ref={root} className={styles.screen}>
      <PresenceEye onReady={onEye} className={styles.eye} />

      <div className={styles.panel}>
        <ol className={styles.log} aria-live="polite">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
        {step === "idle" && (
          <button className={styles.cta} onClick={start}>
            Start recovery
          </button>
        )}
        {step === "calibrating" && <div className={styles.bar} />}
      </div>

      <FxOverlay levels={STAGE1_FX} />
    </div>
  );
}
