"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { key, scanSweep } from "@/lib/audio/sfx";
import { usePresence } from "@/lib/presence/context";
import { scanRive, useMountedRive } from "@/lib/rive/persistent";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./boot.module.css";

gsap.registerPlugin(useGSAP);

type Step = "idle" | "running" | "mapping" | "done";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The operator is not drawn, they are measured: one frame of their real face mesh becomes a
// point cloud in Rive (rive/story, face_cloud.wgsl), acquired by a structured-light sweep and
// then turned slowly, like evidence. Refused: a face is guessed anyway. It never follows the
// user: showing tracking now would spoil it (docs/scenes.md, "the unsaid").
const SWEEP_S = 2.4;
const MESH_POINTS = 478;

// S1 · Boot: a clinical recovery log. Camera and microphone are asked inside the fiction,
// as operator verification. Refusing changes nothing but the record.
export default function Boot() {
  const { state, dispatch } = useStory();
  const { tracker, video } = usePresence();
  const [step, setStep] = useState<Step>("idle");
  const [refused, setRefused] = useState(false);
  const [lines, setLines] = useState<string[]>(() => [
    "RECOVERY/4 · device image E.V. · 118.4 GB",
    `session opened ${clock(state.openedAt, true)}`,
  ]);
  const root = useRef<HTMLDivElement>(null);

  const log = (line: string) => setLines((l) => [...l, line]);

  // Every new line types in, like a log being written, with a keystroke per character.
  useGSAP(
    () => {
      const items = root.current?.querySelectorAll(`.${styles.log} li`);
      const last = items?.[items.length - 1];
      if (!items || !last) return;
      // lines already written stay whole, even if a new one interrupts their typing
      gsap.killTweensOf(items);
      gsap.set(items, { clipPath: "none" });
      if (lines.length <= 2) return; // the first two lines are already there
      const n = last.textContent?.length ?? 10;
      const typed = { n: 0 };
      let shown = 0;
      gsap.to(typed, {
        n,
        duration: Math.min(1.1, n * 0.028),
        ease: "none",
        onUpdate: () => {
          const c = Math.floor(typed.n);
          if (c !== shown) {
            shown = c;
            key();
          }
          (last as HTMLElement).style.clipPath = `inset(0 ${100 - (c / n) * 100}% 0 0)`;
        },
      });
    },
    { scope: root, dependencies: [lines.length] },
  );

  // The mapping: the sweep passes top to bottom and the points fall into a face.
  const viewfinder = useRef<HTMLDivElement>(null);
  useMountedRive(viewfinder, scanRive);
  const [points, setPoints] = useState(0);
  useGSAP(
    () => {
      if (step !== "mapping") return;
      const scan = scanRive();
      const v = { sweep: 1.3, reveal: 0, n: 0 };
      const write = () => {
        scan.set("sweep", v.sweep);
        scan.set("reveal", v.reveal);
      };
      scan.set("spin", 1);
      write();
      scanSweep(SWEEP_S);
      const tl = gsap.timeline({ onUpdate: write });
      tl.to(v, { reveal: 1, duration: 0.5, ease: "power1.out" }, 0);
      tl.to(v, { sweep: -1.3, duration: SWEEP_S, ease: "sine.inOut" }, 0.2);
      tl.to(v, { n: MESH_POINTS, duration: SWEEP_S, ease: "sine.inOut", onUpdate: () => setPoints(Math.round(v.n)) }, 0.2);
    },
    { scope: root, dependencies: [step] },
  );

  useEffect(() => {
    if (step !== "done") return;
    // Fade to the briefing once (600 ms). The phase change runs on a timer, not on the tween,
    // so a throttled tab (no animation frames) still reaches the desktop.
    const t = gsap.to(root.current, { opacity: 0, duration: 0.6, delay: 1.4, ease: "power2.in" });
    const next = setTimeout(() => dispatch({ type: "phase", phase: "briefing" }), 2000);
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
    glitchNow(0.4);
    await wait(700);
    log("operator verification required by protocol");
    await wait(500);
    log("camera + microphone · processed on this device only");
    await wait(700);

    // the gate (Gate.tsx) asked before the premise; only a session that skipped it (dev
    // shortcuts) is asked here
    const asked = state.session.camera !== null;
    const ok = asked ? state.session.camera === "granted" : await tracker.startCamera(el, { withMic: true });
    const at = asked ? (state.session.verifiedAt ?? Date.now()) : Date.now();
    if (!asked)
      dispatch({
        type: "session",
        session: {
          camera: ok ? "granted" : "denied",
          mic: ok && tracker.micGranted ? "granted" : "denied",
          verifiedAt: at,
        },
      });

    if (!ok) {
      // Refusal is data too: the story will remember it. And the mapping happens anyway.
      if (!asked)
        try {
          localStorage.setItem("recovery.cameraDenied", new Date(at).toISOString());
        } catch {
          // storage blocked: the refusal is still in the story state for this session
        }
      setRefused(true);
      scanRive().set("mode", 1);
      glitchNow(0.9);
      log(`verification refused · ${clock(at, true)}`);
      await wait(700);
      log("reconstructing operator from input");
      setStep("mapping");
      await wait(SWEEP_S * 1000 + 200);
      log("access granted anyway");
      setStep("done");
      return;
    }

    log("hold still");
    await wait(600);
    // one frame of the face mesh; no face in view = the scan guesses, like a refusal
    const face = await tracker.capturePoints();
    const scan = scanRive();
    if (face) {
      scan.set("points", face);
      scan.set("mode", 0);
    } else {
      scan.set("mode", 1);
      setRefused(true);
    }
    setStep("mapping");
    await wait(SWEEP_S * 1000 + 200);
    tracker.calibrate();
    log(`operator mapped · ${face ? MESH_POINTS : 0} points · ${clock(Date.now(), true)}`);
    glitchNow(0.5);
    await wait(900);
    log("access granted");
    setStep("done");
  };

  return (
    <div ref={root} className={styles.screen} data-glitch>
      <div className={styles.viewfinder} aria-hidden="true">
        {/* hidden until the scan runs: a fresh Rive canvas shows its loading mark first */}
        <div ref={viewfinder} className={styles.cloud} data-on={step === "mapping" || step === "done"} />
        {step !== "idle" && step !== "running" && (
          <div className={styles.readout}>
            <span>{refused ? "operator · reconstructed" : "operator · mapping"}</span>
            <span>{refused ? "confidence 0.31" : `${String(points).padStart(3, "0")} / ${MESH_POINTS} pts`}</span>
          </div>
        )}
      </div>

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
      </div>
    </div>
  );
}
