"use client";

import { useEffect, useState } from "react";
import { sideWhisper, unlockAudio } from "@/lib/audio/sfx";
import { enterFullscreen } from "@/lib/fullscreen";
import { usePresence } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import styles from "./gate.module.css";

// Before anything else (owner, round 8): camera and microphone are asked the moment the link
// opens, then headphones and full screen, so the case starts already immersive. The stream is
// kept by the tracker for the whole session: S1 never asks again, it only scans.
// Refusing is asked once more, in the case's voice; a second no plays on with the mouse, and
// the story remembers it (S1 log, S9 "You said no at …").

type Step = "camera" | "asking" | "sure" | "sound";

const DENIED_KEY = "recovery.cameraDenied";

async function cameraBlocked(): Promise<boolean> {
  // Firefox and older Safari do not know the "camera" permission name: unknown, not blocked
  if (!navigator.permissions?.query) return false;
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state === "denied";
  } catch (err) {
    console.warn("camera permission state unavailable:", err);
    return false;
  }
}

export default function Gate({ onDone }: { onDone: () => void }) {
  const { dispatch } = useStory();
  const { tracker, video } = usePresence();
  const [step, setStep] = useState<Step>("camera");
  const [blocked, setBlocked] = useState(false);

  const ask = async () => {
    unlockAudio(); // the first click of the session: every sound after this can play
    const el = video();
    if (!el) throw new Error("presence video element missing");
    setStep("asking");
    const ok = await tracker.startCamera(el, { withMic: true });
    if (ok) {
      dispatch({
        type: "session",
        session: { camera: "granted", mic: tracker.micGranted ? "granted" : "denied", verifiedAt: Date.now() },
      });
      setStep("sound");
      return;
    }
    setBlocked(await cameraBlocked());
    setStep("sure");
  };

  const without = () => {
    const at = Date.now();
    dispatch({ type: "session", session: { camera: "denied", mic: "denied", verifiedAt: at } });
    try {
      localStorage.setItem(DENIED_KEY, new Date(at).toISOString());
    } catch (err) {
      console.warn("could not remember the refusal:", err); // still in the story state
    }
    setStep("sound");
  };

  if (step === "camera" || step === "asking")
    return (
      <div className={styles.gate}>
        <p className={styles.kicker}>RECOVERY · before you open the case</p>
        <p className={styles.line}>This case uses your camera and microphone.</p>
        <p className={styles.small}>
          Your face and your room are part of it. Everything is processed on this device.
          <br />
          No frames or audio leave your computer.
        </p>
        <button className={styles.cta} onClick={ask} disabled={step === "asking"} autoFocus>
          {step === "asking" ? "waiting for your browser…" : "allow camera + microphone"}
        </button>
      </div>
    );

  if (step === "sure")
    return (
      <div className={styles.gate}>
        <p className={styles.kicker}>RECOVERY · verification refused</p>
        <p className={styles.line}>Are you sure you don&apos;t want to use the camera?</p>
        <p className={styles.small}>
          No data leaves your computer. Without it the case plays with your mouse.
          <br />
          It will notice.
        </p>
        {blocked && (
          <p className={styles.warn}>
            Your browser has blocked the camera for this site. Allow it from the icon in the address bar, then try
            again.
          </p>
        )}
        <div className={styles.row}>
          <button className={styles.cta} onClick={ask} autoFocus>
            try again
          </button>
          <button className={styles.quiet} onClick={without}>
            continue without
          </button>
        </div>
      </div>
    );

  return <Sound onDone={onDone} />;
}

/** Headphones: a whisper on the left, then on the right, then full screen. */
function Sound({ onDone }: { onDone: () => void }) {
  const [side, setSide] = useState<-1 | 1 | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => {
        setSide(-1);
        sideWhisper(-1);
      }, 700),
      setTimeout(() => {
        setSide(1);
        sideWhisper(1);
      }, 2500),
      setTimeout(() => setSide(null), 4000),
    ];
    return () => t.forEach(clearTimeout);
  }, [round]);

  return (
    <div className={styles.gate}>
      <p className={styles.kicker}>RECOVERY · sound</p>
      <p className={styles.line}>Put your headphones on.</p>
      <div className={styles.ears} aria-live="polite">
        <span data-on={side === -1}>L</span>
        <i aria-hidden="true" />
        <span data-on={side === 1}>R</span>
      </div>
      <p className={styles.small}>
        You should hear a whisper on the left, then on the right.{" "}
        <button className={styles.inline} onClick={() => setRound((r) => r + 1)}>
          play again
        </button>
      </p>
      <button
        className={styles.cta}
        onClick={() => {
          enterFullscreen(); // needs this click: browsers only allow it from a gesture
          onDone();
        }}
      >
        go full screen
      </button>
      <p className={styles.small}>Esc leaves full screen.</p>
    </div>
  );
}
