"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import gsap from "gsap";
import { recordVoice, ring } from "@/lib/audio/call";
import { spokenPace, startCaption } from "@/lib/audio/captions";
import { playCallLine, type CallLine } from "@/lib/audio/voices";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import Transcript from "./views/Transcript";
import styles from "./call.module.css";

// The interlude, live: E.V.'s phone has just come back on, and Mara calls it. The player
// answers on E.V.'s laptop. Mara hopes it's Ev, asks her to say something, and the laptop
// really listens: a few seconds of the player's microphone are recorded (memory only,
// lib/audio/call.ts) while a meter shows it. Then Mara hears a voice that is not Ev's, and
// the line dies mid-word. Declined or left ringing, she gives up and writes instead.
// When the call is over, `call_done` lets the interlude go on to Find My (Desktop.tsx).
export const CALL_EVENT = "recovery:call";
const RING_MS = 22_000;
const LISTEN_MS = 4500;

type Step = "ringing" | "talking" | "listening" | "reply" | "ended";

// What Mara says, word for word (scripts/make-voices.mjs). Written while she speaks; the
// last word stays cut, like the line.
const CAPTIONS: Record<CallLine, string> = {
  "mara-call-1":
    "Ev? Ev, is that you? Oh my god. Your phone just came on. It says you're across the road, in 4A. In the empty flat. Ev, say something. Please. Just say something, so I know it's you.",
  "mara-call-2": "That's not your voice. That's not Ev. Who is this? Why have you got her phone? Who's there with h",
  "mara-call-silent": "Ev? I can't hear you. I can hear someone breathing. Ev, who's there? Who's there with y",
};

export default function IncomingCall() {
  const { state, dispatch } = useStory();
  const [step, setStep] = useState<Step | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const [saying, setSaying] = useState<CallLine | null>(null);
  const stopRing = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const mic = state.session.mic === "granted";

  const finish = (after: "answered" | "declined" | "missed") => {
    stopRing.current?.();
    stopRing.current = null;
    dispatch({ type: "clue", id: `call_${after}` }); // the case file remembers how it went
    if (after === "declined") dispatch({ type: "notify", from: "mara", text: "pick up. please. PLEASE." });
    if (after === "missed") dispatch({ type: "notify", from: "mara", text: "why aren't you picking up" });
    setStep("ended");
    setTimeout(() => {
      if (!alive.current) return;
      gsap.to(panel.current, {
        opacity: 0,
        y: -8,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => setStep(null),
      });
      dispatch({ type: "clue", id: "call_done" });
    }, after === "answered" ? 1600 : 400);
  };

  // the interlude starts the call
  useEffect(() => {
    alive.current = true;
    const start = () => {
      setStep("ringing");
      stopRing.current = ring();
    };
    window.addEventListener(CALL_EVENT, start);
    return () => {
      alive.current = false;
      window.removeEventListener(CALL_EVENT, start);
      stopRing.current?.();
    };
  }, []);

  useEffect(() => {
    if (step !== "ringing") return;
    gsap.fromTo(panel.current, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" });
    const t = setTimeout(() => finish("missed"), RING_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // the call clock, from the moment it is answered
  useEffect(() => {
    if (step !== "talking" && step !== "listening" && step !== "reply") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const answer = async () => {
    stopRing.current?.();
    stopRing.current = null;
    setStep("talking");
    const first = playCallLine("mara-call-1");
    setSaying("mara-call-1");
    startCaption("mara-call-1", first?.speech ?? spokenPace(10));
    await (first?.done ?? wait(11000));
    if (!alive.current) return;
    setStep("listening");
    const heard = mic ? await recordVoice(LISTEN_MS, setLevel) : (await wait(LISTEN_MS), null);
    if (!alive.current) return;
    setStep("reply");
    const reply: CallLine = heard ? "mara-call-2" : "mara-call-silent";
    const second = playCallLine(reply, { cut: true });
    setSaying(reply);
    startCaption(reply, second?.speech ?? spokenPace(6));
    await (second?.done ?? wait(7000));
    if (!alive.current) return;
    glitchNow(0.9);
    finish("answered");
  };

  if (!step) return null;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const status: Record<Step, string> = {
    ringing: "mobile · incoming call",
    talking: clock,
    listening: clock,
    reply: clock,
    ended: `call ended · ${clock}`,
  };

  return (
    <div
      ref={panel}
      className={`${styles.call} ${step === "ringing" ? styles.ringing : ""}`}
      role="dialog"
      aria-label="Incoming call from Mara"
    >
      <span className={styles.face}>
        <Image src="/avatars/mara.webp" alt="" width={96} height={96} />
      </span>
      <span className={styles.who}>
        <b>Mara</b>
        <small>{status[step]}</small>
      </span>

      {step === "ringing" && (
        <span className={styles.actions}>
          <button className={styles.decline} onClick={() => finish("declined")}>
            Decline
          </button>
          <button className={styles.accept} onClick={answer}>
            Accept
          </button>
        </span>
      )}

      {step === "listening" && (
        // the laptop is listening, and says so
        <span className={styles.listen}>
          <span className={styles.meter} style={{ "--level": level } as CSSProperties}>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
          <small>{mic ? "● microphone · live" : "microphone off"}</small>
        </span>
      )}

      {saying && (step === "talking" || step === "reply") && (
        <Transcript key={saying} id={saying} className={styles.caption} text={CAPTIONS[saying]} />
      )}
    </div>
  );
}
