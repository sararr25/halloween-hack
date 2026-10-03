"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { blip, creepyMessage, glitchSound, tubeOff, unlockAudio } from "@/lib/audio/sfx";
import { inviterOf } from "@/lib/story/registry";
import styles from "./invite.module.css";

gsap.registerPlugin(useGSAP);

// The Ring, as a DM (docs/plan-round6.md, "pass it on"). Someone who finished passed the
// case on; whoever opens their link is met, before anything else, by a message from them.
//  1. Black. A lock-screen notification, "1 new message", buzzing now and then. Silent:
//     browsers keep sound locked until a click, so the click that opens it is the one that
//     unlocks the creepy tone.
//  2. The thread: typing dots, then three bubbles, each torn in by an RGB split.
//  3. "seen". The sender's name scrambles and for a moment reads E.V. (the loop), then the
//     thread collapses like an old tube and the story starts as usual.
// An unknown or broken link skips all of it.

const BUBBLES = ["i opened it.", "now it's yours.", "case 0420"];
const TYPING_MS = [1400, 1700, 2100];
const SCRAMBLE = "▓▒░#%&@$ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function InviteDM({ token, onDone }: { token: string; onDone: () => void }) {
  const [from, setFrom] = useState<string | null>(null);
  const [step, setStep] = useState<"notice" | "thread">("notice");
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  // stable, so a parent re-render cannot restart the thread's timeline
  const finish = useCallback(() => done.current(), []);

  useEffect(() => {
    let live = true;
    inviterOf(token).then(
      (name) => {
        if (!live) return;
        if (name) setFrom(name);
        else done.current();
      },
      (err: unknown) => {
        console.error(err);
        if (live) done.current();
      },
    );
    return () => {
      live = false;
    };
  }, [token]);

  if (!from) return <div className={styles.stage} />;
  return step === "notice" ? (
    <Notice
      from={from}
      onOpen={() => {
        unlockAudio(); // the gesture that lets the tone play
        creepyMessage();
        setStep("thread");
      }}
    />
  ) : (
    <Thread from={from} onDone={finish} />
  );
}

function Notice({ from, onOpen }: { from: string; onOpen: () => void }) {
  const el = useRef<HTMLButtonElement>(null);
  useGSAP(() => {
    if (!el.current) return;
    // the entrance is CSS (invite.module.css .notice); GSAP only buzzes it
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // a phone buzzing on a table: a short tremor, then nothing, then again
    gsap
      .timeline({ repeat: -1, repeatDelay: 2.6, delay: 2.2 })
      .to(el.current, { keyframes: { x: [0, -3, 3, -3, 3, -2, 2, 0] }, duration: 0.42, ease: "none" })
      .to(el.current, { keyframes: { x: [0, -3, 3, -2, 2, 0] }, duration: 0.32, ease: "none" }, "+=0.18");
  });
  return (
    <div className={styles.stage}>
      <p className={styles.clock}>{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
      <button ref={el} className={styles.notice} onClick={onOpen} autoFocus>
        <span className={styles.app} aria-hidden="true">
          <i />
        </span>
        <span className={styles.noticeText}>
          <span className={styles.noticeHead}>
            <b>{from}</b>
            <small>now</small>
          </span>
          <span className={styles.blurred}>sent you something. don&apos;t show anyone.</span>
        </span>
      </button>
      <p className={styles.tap}>1 new message · click to read</p>
    </div>
  );
}

function Thread({ from, onDone }: { from: string; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(true);
  const [seen, setSeen] = useState(false);
  const [name, setName] = useState(from);
  const [status, setStatus] = useState("online");

  // the conversation, on timers: typing, a bubble, typing, a bubble...
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    let scramble: ReturnType<typeof setInterval> | undefined;
    let at = 400;
    BUBBLES.forEach((_, i) => {
      at += TYPING_MS[i];
      t.push(
        setTimeout(() => {
          setShown(i + 1);
          setTyping(i < BUBBLES.length - 1);
          if (i > 0) blip();
        }, at),
      );
      at += 500;
    });
    at += 1100;
    t.push(setTimeout(() => setSeen(true), at));
    // the name comes apart, reads E.V. for a breath, and comes back
    at += 900;
    t.push(
      setTimeout(() => {
        glitchSound(0.5);
        const stop = Date.now() + 700;
        scramble = setInterval(() => {
          if (Date.now() > stop) {
            clearInterval(scramble);
            setName("E.V.");
            setStatus("last seen 7 days ago");
            return;
          }
          setName(Array.from(from, () => SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]).join(""));
        }, 45);
      }, at),
    );
    at += 1700;
    t.push(
      setTimeout(() => {
        setName(from);
        setStatus("online");
      }, at),
    );
    // then the thread switches off like an old screen
    at += 1400;
    t.push(
      setTimeout(() => {
        tubeOff();
        gsap.to(root.current, { scaleY: 0.004, duration: 0.5, ease: "power2.in" });
        gsap.to(root.current, { scaleX: 0, duration: 0.4, delay: 0.5, ease: "power2.in" });
      }, at),
    );
    t.push(setTimeout(onDone, at + 1300));
    return () => {
      t.forEach(clearTimeout);
      clearInterval(scramble);
    };
  }, [from, onDone]);

  // each new bubble is torn in: an RGB split, a jolt sideways, a blur that clears
  useGSAP(
    () => {
      const b = root.current?.querySelector(`[data-bubble="${shown - 1}"]`);
      if (!b) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.from(b, { opacity: 0, duration: 0.2 });
        return;
      }
      gsap
        .timeline()
        .from(b, { opacity: 0, scale: 0.7, y: 14, filter: "blur(8px)", duration: 0.28, ease: "power3.out" })
        .to(
          b,
          {
            keyframes: {
              x: [-7, 5, -3, 2, 0],
              skewX: [8, -5, 3, 0, 0],
              textShadow: [
                "3px 0 rgba(255,0,60,0.9), -3px 0 rgba(0,240,255,0.9)",
                "-4px 0 rgba(255,0,60,0.9), 4px 0 rgba(0,240,255,0.9)",
                "2px 0 rgba(255,0,60,0.7), -2px 0 rgba(0,240,255,0.7)",
                "0 0 rgba(0,0,0,0)",
                "0 0 rgba(0,0,0,0)",
              ],
            },
            duration: 0.32,
            ease: "none",
          },
          "<0.05",
        );
    },
    { scope: root, dependencies: [shown] },
  );

  return (
    <div className={styles.stage}>
      <div ref={root} className={styles.thread}>
        <header className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">
            {(name[0] ?? "?").toUpperCase()}
          </span>
          <span>
            <b data-ev={name === "E.V."}>{name}</b>
            <small>{status}</small>
          </span>
        </header>
        <div className={styles.messages} aria-live="polite">
          {BUBBLES.slice(0, shown).map((text, i) => (
            <p key={i} data-bubble={i} className={i === BUBBLES.length - 1 ? styles.caseBubble : styles.bubble}>
              {text}
            </p>
          ))}
          {typing && (
            <p className={styles.typing} aria-label={`${from} is typing`}>
              <i />
              <i />
              <i />
            </p>
          )}
          {seen && <small className={styles.seen}>seen just now</small>}
        </div>
      </div>
    </div>
  );
}
