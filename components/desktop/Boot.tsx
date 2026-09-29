"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { key } from "@/lib/audio/sfx";
import { usePresence } from "@/lib/presence/context";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import styles from "./boot.module.css";

gsap.registerPlugin(useGSAP);

type Step = "idle" | "running" | "mapping" | "done";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Head-and-shoulders outline, drawn while the operator "holds still". Nothing here
// follows the user: showing tracking now would spoil it (docs/scenes.md, "the unsaid").
const OUTLINE =
  "M150 46 C 112 46 92 76 92 114 C 92 150 108 182 128 196 L 128 222 C 96 232 58 246 40 270 C 26 290 20 318 18 340 M150 46 C 188 46 208 76 208 114 C 208 150 192 182 172 196 L 172 222 C 204 232 242 246 260 270 C 274 290 280 318 282 340";
const POINTS: [number, number][] = [
  [128, 112], [172, 112], [150, 138], [136, 162], [164, 162], [150, 176], [150, 72], [110, 128], [190, 128],
];

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

  // The mapping: the outline is traced, a scan line passes, reference points tick in.
  useGSAP(
    () => {
      if (step !== "mapping") return;
      const path = root.current?.querySelector<SVGPathElement>(`.${styles.outline}`);
      if (!path) return;
      const len = path.getTotalLength();
      const tl = gsap.timeline();
      tl.set(`.${styles.figure}`, { opacity: 1 });
      tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "power1.inOut" });
      tl.fromTo(`.${styles.scan}`, { y: 20, opacity: 0.9 }, { y: 340, opacity: 0, duration: 1.4, ease: "sine.inOut" }, 0.2);
      tl.from(`.${styles.point}`, { opacity: 0, scale: 0, transformOrigin: "center", duration: 0.08, stagger: { each: 0.09, onStart: key } }, 1.2);
    },
    { scope: root, dependencies: [step] },
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
    glitchNow(0.4);
    await wait(700);
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
      // Refusal is data too: the story will remember it. And the mapping happens anyway.
      try {
        localStorage.setItem("recovery.cameraDenied", new Date(at).toISOString());
      } catch {
        // storage blocked: the refusal is still in the story state for this session
      }
      setRefused(true);
      glitchNow(0.9);
      log(`verification refused · ${clock(at, true)}`);
      await wait(700);
      log("reconstructing operator from input");
      setStep("mapping");
      await wait(2400);
      log("access granted anyway");
      setStep("done");
      return;
    }

    log("hold still");
    setStep("mapping");
    await wait(2000);
    tracker.calibrate();
    log(`operator mapped · ${clock(Date.now(), true)}`);
    glitchNow(0.5);
    await wait(900);
    log("access granted");
    setStep("done");
  };

  return (
    <div ref={root} className={styles.screen} data-glitch>
      <div className={styles.viewfinder} aria-hidden="true">
        <svg viewBox="0 0 300 360" className={styles.figure}>
          <path className={styles.outline} d={OUTLINE} />
          {POINTS.map(([x, y], i) => (
            <circle key={i} className={styles.point} cx={x} cy={y} r="2.2" />
          ))}
          <line className={styles.scan} x1="0" x2="300" y1="0" y2="0" />
        </svg>
        {step === "mapping" && (
          <span className={styles.caption}>{refused ? "operator · reconstructed" : "operator · mapping"}</span>
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
