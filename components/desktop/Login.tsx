"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { key, tubeOff } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { downloadCaseFile } from "@/lib/story/casefile";
import { crtOff } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { SignGlyph } from "./Decor";
import styles from "./login.module.css";

// S10 · Login. An empty field and a caret. With the camera, the caret stops while the
// user's face is gone and starts again when it comes back; without it, it stops when the
// mouse has been still for 5 s. One quiet line under the field says what it wants
// ("stay in frame.") and, when nobody is there, that it noticed. Enter → the case list, with the
// user's name on the open case, then the screen switches off like an old tube.
// docs/desktop.md supersedes docs/scenes.md S10.
const STILL_MS = 5000;
// the case list types in over ~1.8 s; it then holds long enough to read the open case
const CASES_HOLD_MS = 7000;
const CASES_BLACK_MS = 8600;
export const CASE_KEY = "recovery.case0418";

type Step = "login" | "cases" | "off" | "credits";

export default function Login() {
  const { state } = useStory();
  const { tracker } = usePresence();
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("login");
  const [waiting, setWaiting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const camera = tracker.state.source === "camera";

  // the caret waits for the face (camera) or for the hand (mouse)
  usePresenceEvent("change", (s) => {
    if (s.source === "camera") setWaiting(s.faceLost);
  });
  useEffect(() => {
    if (tracker.state.source === "camera") return;
    let t = setTimeout(() => setWaiting(true), STILL_MS);
    const move = () => {
      setWaiting(false);
      clearTimeout(t);
      t = setTimeout(() => setWaiting(true), STILL_MS);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", move);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", move);
    };
  }, [tracker]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const typed = name.trim();
    if (!typed) return;
    try {
      localStorage.setItem(CASE_KEY, typed);
    } catch {
      // storage blocked: the case still opens for this session
    }
    setStep("cases");
  };

  // the case list, then the tube switches off; timers, not tweens, move the steps
  useEffect(() => {
    if (step !== "cases") return;
    const rows = screen.current?.querySelectorAll("li");
    if (rows) gsap.from(rows, { opacity: 0, duration: 0.01, stagger: { each: 0.45, onStart: key } });
    const off = setTimeout(() => {
      tubeOff();
      crtOff(1.4);
      gsap.to(screen.current, { scaleY: 0.004, duration: 0.6, ease: "power2.in" });
      gsap.to(screen.current, { scaleX: 0, duration: 0.5, delay: 0.6, ease: "power2.in" });
    }, CASES_HOLD_MS);
    const black = setTimeout(() => {
      setStep("off");
      crtOff(0);
    }, CASES_BLACK_MS);
    return () => [off, black].forEach(clearTimeout);
  }, [step]);

  // its own effect: the one above is cleaned up the moment the step becomes "off"
  useEffect(() => {
    if (step !== "off") return;
    const credits = setTimeout(() => setStep("credits"), 2200);
    return () => clearTimeout(credits);
  }, [step]);

  const [saving, setSaving] = useState(false);
  const download = async () => {
    const { openedAt, session, clues, wrongCodes, interruptions, blinks } = state;
    setSaving(true);
    try {
      await downloadCaseFile({
        name: name.trim(),
        openedAt,
        closedAt: Date.now(),
        camera: session.camera,
        verifiedAt: session.verifiedAt,
        figureMs: clues.photo_figure ?? null,
        backupMs: clues.backup_open ?? null,
        wrongCodes,
        lookedAway: interruptions.length,
        blinks,
        call: "call_answered" in clues ? "answered" : "call_declined" in clues ? "declined" : "call_missed" in clues ? "missed" : null,
      });
    } finally {
      setSaving(false);
    }
  };

  // each screen gets its own element: the switch-off leaves a squash on the one before
  if (step === "off") return <div key="off" className={styles.black} />;
  if (step === "credits")
    return (
      <div key="credits" className={styles.black}>
        <div className={styles.end}>
          <SignGlyph size={56} />
          <p className={styles.credits}>No frames or audio left your device.</p>
          {/* the keepsake: the session as a case file, made here (lib/story/casefile.ts) */}
          <button className={styles.download} onClick={download} disabled={saving}>
            {saving ? "writing case file…" : "download case file 0418"}
          </button>
        </div>
      </div>
    );

  return (
    <div key="screen" className={styles.screen} ref={screen} data-waiting={step === "login" && waiting}>
      {step === "login" ? (
        <form className={styles.form} onSubmit={submit} onClick={() => input.current?.focus()}>
          <p className={styles.brand}>RECOVERY/4</p>
          <label className={styles.field}>
            <span className={styles.label}>operator</span>
            <span className={styles.typed}>
              {name}
              <span className={styles.caret} data-waiting={waiting} aria-hidden="true" />
            </span>
            <input
              ref={input}
              className={styles.hidden}
              value={name}
              autoFocus
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-label="operator name"
              onChange={(e) => {
                key();
                setName(e.target.value);
              }}
            />
          </label>
          {/* the one thing the screen asks: be seen. Away, it notices, and waits. */}
          <p className={styles.presence} data-waiting={waiting}>
            {waiting ? "operator absent · the case is waiting" : camera ? "stay in frame." : "stay with the screen."}
          </p>
        </form>
      ) : (
        <ol className={styles.cases}>
          <li>RECOVERY/4 · cases</li>
          <li><span>#0415</span><span>E.V.</span><span>missing · 7 days</span></li>
          <li><span>#0416</span><span>redacted</span><span>closed</span></li>
          <li><span>#0417</span><span>redacted</span><span>closed · operator unresponsive</span></li>
          <li className={styles.open}><span>#0418</span><span>{name.trim()}</span><span>open</span></li>
        </ol>
      )}
    </div>
  );
}
