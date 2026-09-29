"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import PresenceEye, { type EyeHandle } from "@/components/PresenceEye";
import FxOverlay from "@/components/FxOverlay";
import { PresenceTracker, type Gesture, type PresenceState } from "@/lib/presence/tracker";
import styles from "./lab.module.css";

type Phase = "idle" | "requesting" | "calibrating" | "watching";

gsap.registerPlugin(useGSAP);

// Stage 1 · perfect: subliminal grain and glitch (see HANDOVER stage table)
const STAGE1_FX = { grain: 0.25, vignette: 0.35, glitch: 0.1, neon: 0, pulse: 0 };

// The system answers a gesture it was never told to watch for. Placeholder lines, to be written.
const GESTURE_LINES: Partial<Record<Gesture, string>> = {
  palm: "non serve coprirti",
  fist: "calma",
  point: "ti vedo anche io",
  victory: "due. come la volta scorsa",
  thumbUp: "lo sappiamo",
  thumbDown: "non dipende da te",
  love: "anche noi",
};

// S1 · Boot: the camera is asked for inside the fiction, as operator identity verification.
export default function Boot() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [line, setLine] = useState("recupero dati · sessione in attesa");
  const [debug, setDebug] = useState(false);
  const [snap, setSnap] = useState<PresenceState | null>(null);
  const [lastEvent, setLastEvent] = useState("");

  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const eye = useRef<EyeHandle | null>(null);
  const tracker = useRef<PresenceTracker | null>(null);

  const onEye = useCallback((handle: EyeHandle) => {
    eye.current = handle;
  }, []);

  useEffect(() => {
    let lastSnap = 0;
    const t = new PresenceTracker({
      onChange: (s) => {
        eye.current?.update(s);
        const now = performance.now();
        if (now - lastSnap > 100) {
          lastSnap = now;
          setSnap({ ...s, debug: { ...s.debug } });
        }
      },
      onBlink: () => {
        eye.current?.blink();
        setLastEvent("blink");
      },
      onGesture: (g) => {
        setLastEvent(`gesture: ${g}`);
        const reply = GESTURE_LINES[g];
        if (reply) {
          eye.current?.blink();
          setLine(reply);
        }
      },
    });
    t.startMouse();
    tracker.current = t;
    (window as unknown as { __presence: PresenceTracker }).__presence = t;

    const key = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") setDebug((v) => !v);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      t.stop();
    };
  }, []);

  // Status line: every new line types in, like a log being written.
  useGSAP(
    () => {
      gsap.fromTo(
        `.${styles.status}`,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: Math.min(1.2, line.length * 0.03), ease: `steps(${line.length})` },
      );
    },
    { scope: root, dependencies: [line] },
  );

  useGSAP(
    () => {
      if (phase === "watching") {
        gsap.fromTo(`.${styles.eye}`, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: "sine.inOut" });
      }
    },
    { scope: root, dependencies: [phase] },
  );

  const start = async () => {
    if (!tracker.current || !video.current) return;
    setPhase("requesting");
    setLine("protocollo di recupero · verifica identità operatore richiesta");
    const ok = await tracker.current.startCamera(video.current);
    if (!ok) {
      // Refusal is data too: the story will remember it.
      try {
        localStorage.setItem("recovery.cameraDenied", new Date().toISOString());
      } catch {}
      setLine("verifica rifiutata · accesso concesso comunque");
      setPhase("watching");
      return;
    }
    setPhase("calibrating");
    setLine("mantieni la posizione");
    await new Promise((r) => setTimeout(r, 2000));
    tracker.current.calibrate();
    setLine("operatore riconosciuto");
    setPhase("watching");
  };

  return (
    <div ref={root} className={styles.screen}>
      <video ref={video} className={styles.video} />

      <PresenceEye onReady={onEye} className={`${styles.eye} ${phase === "watching" ? "" : styles.dim}`} />

      <div className={styles.panel}>
        <p className={styles.status}>{line}</p>
        {phase === "idle" && (
          <button className={styles.cta} onClick={start}>
            Avvia recupero
          </button>
        )}
        {phase === "calibrating" && <div className={styles.bar} />}
      </div>

      <FxOverlay levels={STAGE1_FX} />

      {debug && snap && (
        <pre className={styles.debug}>
          {`source      ${snap.source}
headX       ${snap.headX.toFixed(2)}
headY       ${snap.headY.toFixed(2)}
lookingAway ${snap.lookingAway}
faceLost    ${snap.faceLost}
gesture     ${snap.gesture}
hands       ${snap.debug.hands}
raw         ${snap.debug.rawGesture}
last        ${lastEvent}`}
        </pre>
      )}
    </div>
  );
}
