"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { blip, glitchSound, key, subThud, tubeOff } from "@/lib/audio/sfx";
import { dread, jumpStinger, ringNotify, slam } from "@/lib/audio/dread";
import { casefileRive, useMountedRive } from "@/lib/rive/persistent";
import { inviterOf } from "@/lib/story/registry";
import styles from "./invite.module.css";

gsap.registerPlugin(useGSAP);

// The Ring, as a DM (docs/plan-round6.md, "pass it on"). Someone who finished passed the
// case on; whoever opens their link is met, before anything else, by a message from them.
//  (Sound is already unlocked: the gate before it, Gate.tsx, took the first click.)
//  1. The lock screen. The notification rings like the phone in The Ring, in time with the
//     buzz on screen, until it is opened.
//  2. Opening it: a figure lunges out of a white flash (the one jump scare), then black.
//  3. The thread, under a score in the spirit of The Shining. Two lines from the sender,
//     then the screen is taken over by the case file (rive/casefile, round 8: the old shouted
//     lines were off brand): fields that type themselves, the stamp, a held silence, "find
//     her. / or you're next." Then the sender again, small and close: sorry, forgive me, love you.
//  4. "seen". A countdown from 12:00:00 runs in the header. The name scrambles into E.V.
//     for a breath, the thread collapses like an old tube and the story starts as usual.
// An unknown or broken link skips all of it.

type Bubble = { kind: "bubble"; text: string; typing: number; style?: "case" };
type Card = { kind: "case"; hold: number };
type Line = Bubble | Card;

const script = (from: string): Line[] => [
  { kind: "bubble", text: "it's me.", typing: 1300 },
  { kind: "bubble", text: "don't close this. please. read all of it.", typing: 2000 },
  { kind: "case", hold: 13_500 },
  { kind: "bubble", text: "i'm sorry. i had to pass it to you.", typing: 2600 },
  { kind: "bubble", text: "it was the only way to save myself.", typing: 2000 },
  { kind: "bubble", text: "if you survive this, i hope one day you'll forgive me.", typing: 2900 },
  { kind: "bubble", text: `love you. ${from}`, typing: 1900 },
  { kind: "bubble", text: "case 0420", typing: 1100, style: "case" },
];

// The case file's beats in seconds, mirrored from scripts/gen-casefile-rml.py: when each line
// types on [start, end], when the stamp lands, when the countdown row appears.
const CASE_TYPED: [number, number][] = [
  [0, 0.7], [0.4, 0.9], [1.2, 1.6], [1.35, 1.95], [2.2, 2.6], [2.35, 2.95], [3.2, 3.6], [3.35, 3.95], [4.2, 4.6], [4.35, 4.95],
];
const CASE_ROWS = [1.2, 2.2, 3.2, 4.2];
const CASE_REMAINING = 4.35;
const CASE_STAMP = 5.4;
const CASE_LINES: [number, number][] = [[7.4, 8.4], [9.4, 10.6]];

const SCRAMBLE = "▓▒░#%&@$ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RING_EVERY_MS = 3400;
const DEADLINE_MS = 12 * 3600 * 1000;
// the figure is on screen this long, then black this long before the thread
const SCARE_MS = 380;
const SCARE_BLACK_MS = 900;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

type Step = "lock" | "scare" | "thread";

export default function InviteDM({ token, onDone }: { token: string; onDone: () => void }) {
  const [from, setFrom] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("lock");
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

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

  // the score starts on the black after the scare and outlives the thread by a fade
  const stopScore = useRef<((fade?: number) => void) | null>(null);
  useEffect(() => () => stopScore.current?.(0.3), []);

  // stable, so a parent re-render cannot restart a timeline
  const scareDone = useCallback(() => {
    stopScore.current = dread();
    setStep("thread");
  }, []);
  const threadDone = useCallback(() => {
    stopScore.current?.(2.5);
    done.current();
  }, []);

  if (!from) return <div className={styles.stage} />;
  if (step === "lock") return <Notice from={from} onOpen={() => setStep("scare")} />;
  if (step === "scare") return <Scare onDone={scareDone} />;
  return <Thread from={from} onDone={threadDone} />;
}

function Notice({ from, onOpen }: { from: string; onOpen: () => void }) {
  const el = useRef<HTMLButtonElement>(null);
  const [now] = useState(() => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  // the ring and the buzz on one clock, so the sound and the tremor land together
  useEffect(() => {
    const ring = () => {
      ringNotify();
      if (!el.current || reduced()) return;
      gsap
        .timeline()
        .to(el.current, { keyframes: { x: [0, -4, 4, -4, 4, -3, 3, 0] }, duration: 0.42, ease: "none" })
        .to(el.current, { keyframes: { x: [0, -4, 4, -3, 3, 0] }, duration: 0.36, ease: "none" }, "+=0.14");
    };
    const first = setTimeout(ring, 1300);
    const again = setInterval(ring, RING_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  }, []);
  return (
    <div className={styles.stage}>
      <p className={styles.clock}>{now}</p>
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

/** The one jump scare: a white flash, a figure lunging out of it, torn colour, then black. */
function Scare({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      jumpStinger();
      // timers, not the tween, end it: a throttled tab must never be left on the figure
      const hide = setTimeout(() => root.current && (root.current.style.visibility = "hidden"), SCARE_MS);
      const next = setTimeout(onDone, SCARE_MS + SCARE_BLACK_MS);
      const q = gsap.utils.selector(root);
      const flash = q(`.${styles.scareFlash}`);
      const tl = gsap.timeline();
      if (reduced()) {
        tl.set(flash, { opacity: 1 }).to(flash, { opacity: 0, duration: 0.3 });
        return () => [hide, next].forEach(clearTimeout);
      }
      tl.fromTo(q(`.${styles.scareFigure}`), { scale: 0.55, y: 60 }, { scale: 1.9, y: -30, duration: 0.34, ease: "power4.in" }, 0)
        .fromTo(
          q(`.${styles.scareGhost}`),
          { scale: 0.6, x: (i: number) => (i ? 26 : -26) },
          { scale: 2, x: (i: number) => (i ? -40 : 40), duration: 0.34, ease: "power4.in" },
          0,
        )
        .to(root.current, { keyframes: { x: [0, -18, 14, -10, 8, 0], y: [0, 10, -12, 6, -4, 0] }, duration: 0.34, ease: "none" }, 0)
        .to(flash, { keyframes: { opacity: [1, 0.2, 1, 0, 0.8, 0] }, duration: 0.34, ease: "none" }, 0);
      return () => [hide, next].forEach(clearTimeout);
    },
    { scope: root },
  );
  return (
    <div className={styles.blackStage}>
      <div ref={root} className={styles.scare} aria-hidden="true">
        <div className={styles.scareFlash} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.scareGhost} ${styles.ghostA}`} src="/figure/body.webp" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.scareGhost} ${styles.ghostB}`} src="/figure/body.webp" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.scareFigure} src="/figure/body.webp" alt="" />
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
function Countdown({ from }: { from: number }) {
  const [left, setLeft] = useState(DEADLINE_MS);
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, DEADLINE_MS - (Date.now() - from))), 250);
    return () => clearInterval(t);
  }, [from]);
  const s = Math.floor(left / 1000);
  return (
    <span className={styles.countdown} aria-label="time left">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}

function Thread({ from, onDone }: { from: string; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [lines] = useState(() => script(from));
  const bubbles = lines.filter((l): l is Bubble => l.kind === "bubble");
  const [shown, setShown] = useState(0); // bubbles on screen
  const [typing, setTyping] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [clockFrom, setClockFrom] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  const [name, setName] = useState(from);
  const [status, setStatus] = useState("online");

  // the conversation, on timers: typing, a bubble; or the screen taken over by a line
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    let scramble: ReturnType<typeof setInterval> | undefined;
    let at = 900;
    let n = 0;
    lines.forEach((line) => {
      if (line.kind === "bubble") {
        t.push(setTimeout(() => setTyping(true), at));
        at += line.typing;
        const i = ++n;
        t.push(
          setTimeout(() => {
            setTyping(false);
            setShown(i);
            blip();
          }, at),
        );
        at += 650;
      } else {
        t.push(
          setTimeout(() => {
            setTyping(false);
            setCard(line);
          }, at),
        );
        // the countdown in the header starts when the case file says it, and stays
        t.push(setTimeout(() => setClockFrom(Date.now()), at + CASE_REMAINING * 1000));
        at += line.hold;
        t.push(setTimeout(() => setCard(null), at));
        at += 500;
      }
    });
    at += 1000;
    t.push(setTimeout(() => setSeen(true), at));
    // the name comes apart, reads E.V. for a breath, and comes back
    at += 1300;
    t.push(
      setTimeout(() => {
        glitchSound(0.7);
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
    at += 2200;
    t.push(
      setTimeout(() => {
        setName(from);
        setStatus("online");
      }, at),
    );
    // then the thread switches off like an old screen
    at += 1600;
    t.push(
      setTimeout(() => {
        tubeOff();
        gsap.to(root.current, { scaleY: 0.004, duration: 0.5, ease: "power2.in" });
        gsap.to(root.current, { scaleX: 0, duration: 0.4, delay: 0.5, ease: "power2.in" });
      }, at),
    );
    t.push(setTimeout(onDone, at + 1400));
    return () => {
      t.forEach(clearTimeout);
      clearInterval(scramble);
    };
  }, [from, lines, onDone]);

  // each new bubble is torn in: an RGB split, a jolt sideways, a blur that clears
  useGSAP(
    () => {
      const b = root.current?.querySelector(`[data-bubble="${shown - 1}"]`);
      if (!b) return;
      if (reduced()) {
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
    <div className={`${styles.stage} ${styles.dread}`}>
      <div className={styles.grain} aria-hidden="true" />
      <div ref={root} className={styles.thread} data-dim={!!card}>
        <header className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">
            {(name[0] ?? "?").toUpperCase()}
          </span>
          <span>
            <b data-ev={name === "E.V."}>{name}</b>
            <small>{status}</small>
          </span>
          {clockFrom && <Countdown from={clockFrom} />}
        </header>
        <div className={styles.messages} aria-live="polite">
          {bubbles.slice(0, shown).map((b, i) => (
            <p key={i} data-bubble={i} className={b.style === "case" ? styles.caseBubble : styles.bubble}>
              {b.text}
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
      {card && <CaseFile from={from} />}
    </div>
  );
}

/**
 * The case file, full screen (rive/casefile): Rive types every field on, slams the stamp and
 * holds the silence; this adds the sound on the same beats and keeps the countdown live.
 */
function CaseFile({ from }: { from: string }) {
  const host = useRef<HTMLDivElement>(null);
  useMountedRive(host, casefileRive);
  useEffect(() => {
    const r = casefileRive();
    r.set("from", `${from} · released`);
    r.set("remaining", "12:00:00");
    r.set("play", 1);
    const at = (s: number, fn: () => void) => setTimeout(fn, s * 1000);
    const t: ReturnType<typeof setTimeout>[] = [];
    // a keystroke for every few letters while a line types on
    CASE_TYPED.forEach(([a, b]) => {
      for (let s = a; s < b; s += 0.06) t.push(at(s, key));
    });
    CASE_ROWS.forEach((s) => t.push(at(s, () => subThud(0.35))));
    t.push(
      at(CASE_STAMP, () => {
        slam(1);
        glitchSound(0.6);
      }),
    );
    // the last two lines type slower, the second ends on a hit
    CASE_LINES.forEach(([a, b]) => {
      for (let s = a; s < b; s += 0.11) t.push(at(s, key));
    });
    t.push(at(CASE_LINES[1][1] + 0.1, () => slam(0.6)));
    // the countdown, live, from the moment its row appears
    let clock: ReturnType<typeof setInterval> | undefined;
    t.push(
      at(CASE_REMAINING, () => {
        const start = Date.now();
        clock = setInterval(() => {
          const s = Math.floor(Math.max(0, DEADLINE_MS - (Date.now() - start)) / 1000);
          r.set("remaining", `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
        }, 250);
      }),
    );
    return () => {
      t.forEach(clearTimeout);
      clearInterval(clock);
    };
  }, [from]);
  return <div ref={host} className={styles.card} role="alert" aria-label="case 0420. assigned to you. find her, or you're next." />;
}
